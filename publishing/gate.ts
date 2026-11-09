// the gate a post has to pass: approved, inside the limits, and only once.

import { DESTINATIONS, type Destination } from "./destinations.ts";
import { planKey, planProblems, type PublishPlan } from "./plan.ts";

export interface PublishReceipt {
  plan_key_digest: string;
  destination: Destination;
  posted_at: string;
  external_id: string;
  url?: string;
}

export interface Publisher {
  readonly destination: Destination;
  publish(plan: PublishPlan): Promise<PublishReceipt>;
}

export interface ReceiptStore {
  find(key: string): Promise<PublishReceipt | undefined>;
  record(key: string, receipt: PublishReceipt): Promise<void>;
}

export function memoryReceiptStore(): ReceiptStore {
  const receipts = new Map<string, PublishReceipt>();
  return {
    async find(key) {
      return receipts.get(key);
    },
    async record(key, receipt) {
      receipts.set(key, receipt);
    },
  };
}

async function digest(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface RateGate {
  allow(destination: Destination, at: string): Promise<{ ok: boolean; reason?: string; retry_after_ms?: number }>;
  record(destination: Destination, at: string): Promise<void>;
}

const DAY = 86_400_000;

// a sliding window per destination. the caps are the conservative defaults in the
// destination table, so the fuse is visible next to the platform it protects.
export function memoryRateGate(): RateGate {
  const sent = new Map<Destination, number[]>();
  const within = (destination: Destination, at: number) =>
    (sent.get(destination) ?? []).filter((t) => at - t < DAY);
  return {
    async allow(destination, at) {
      const spec = DESTINATIONS[destination];
      if (!spec) return { ok: false, reason: `"${destination}" is not a destination this head knows` };
      if (spec.route === "no-api") return { ok: false, reason: spec.note };
      const time = Date.parse(at);
      if (Number.isNaN(time)) return { ok: false, reason: "the clock is not a date" };
      const recent = within(destination, time);
      if (recent.length >= spec.daily_cap) {
        const oldest = Math.min(...recent);
        return {
          ok: false,
          reason: `${destination} has taken ${recent.length} in the last 24 hours and the cap is ${spec.daily_cap}`,
          retry_after_ms: DAY - (time - oldest),
        };
      }
      return { ok: true };
    },
    async record(destination, at) {
      const time = Date.parse(at);
      if (Number.isNaN(time)) return;
      sent.set(destination, [...within(destination, time), time]);
    },
  };
}

export interface PublishAttempt {
  receipt?: PublishReceipt;
  duplicate?: PublishReceipt;
  problems: string[];
}

// the only path a post takes. approved or refused, inside the fuse, and never twice.
export async function publishOnce(
  publisher: Publisher,
  store: ReceiptStore,
  gate: RateGate,
  plan: PublishPlan,
  at: string,
): Promise<PublishAttempt> {
  const problems = planProblems(plan);
  if (plan.destination !== publisher.destination) {
    problems.push(`the plan is for ${plan.destination} and the publisher is ${publisher.destination}`);
  }
  if (problems.length) return { problems };

  const key = await digest(planKey(plan));
  const existing = await store.find(key);
  if (existing) return { problems: [], duplicate: existing };

  const allowed = await gate.allow(plan.destination, at);
  if (!allowed.ok) return { problems: [allowed.reason ?? "refused by the rate gate"] };

  const receipt = await publisher.publish(plan);
  await gate.record(plan.destination, at);
  await store.record(key, receipt);
  return { problems: [], receipt };
}
