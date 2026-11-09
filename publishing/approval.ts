// the approval a plan needs before it leaves the building.
//
// planProblems refuses an unapproved plan, which means approval is a real object with
// a real owner rather than a boolean someone sets in a config. two things make it
// worth having: an approval expires, so a stale yes cannot be replayed a fortnight
// later, and a refusal carries a reason, so the next draft knows what to fix.

import { planKey, type PublishPlan } from "./plan.ts";

export type ApprovalState = "queued" | "approved" | "refused";

export interface ApprovalRecord {
  plan_digest: string;
  state: ApprovalState;
  // a human's name. an approval with no reviewer is a rubber stamp
  reviewer: string;
  decided_at: string;
  // an approval is good for a while and then it is not
  expires_at?: string;
  note?: string;
}

export const DEFAULT_APPROVAL_WINDOW_HOURS = 72;

async function digest(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function planDigest(plan: PublishPlan): Promise<string> {
  return digest(planKey(plan));
}

export interface ApprovalStore {
  put(record: ApprovalRecord): Promise<void>;
  get(planDigest: string): Promise<ApprovalRecord | undefined>;
  list(): Promise<ApprovalRecord[]>;
}

export function memoryApprovalStore(): ApprovalStore {
  const records = new Map<string, ApprovalRecord>();
  return {
    async put(record) {
      records.set(record.plan_digest, record);
    },
    async get(planDigest) {
      return records.get(planDigest);
    },
    async list() {
      return [...records.values()];
    },
  };
}

export function approvalProblems(record: ApprovalRecord | undefined, now: string): string[] {
  if (!record) return ["approval: nothing has approved this plan, so it is a draft"];
  const problems: string[] = [];
  if (record.state !== "approved") problems.push(`approval: state is ${record.state}, and only approved posts`);
  if (!record.reviewer?.trim()) problems.push("approval: an approval with no reviewer is a rubber stamp");
  if (Number.isNaN(Date.parse(record.decided_at ?? ""))) problems.push("approval: decided_at is not a date");
  if (record.state === "refused" && !record.note?.trim()) {
    problems.push("approval: a refusal carries a reason, or the next draft repeats it");
  }
  if (record.state === "approved") {
    const expiry = record.expires_at ? Date.parse(record.expires_at) : Number.NaN;
    const at = Date.parse(now);
    if (Number.isNaN(expiry)) problems.push("approval: an approval with no expiry lives forever, and it should not");
    else if (!Number.isNaN(at) && at > expiry) problems.push(`approval: expired at ${record.expires_at}, so approve it again rather than posting last week's yes`);
  }
  return problems;
}

export async function queueForApproval(store: ApprovalStore, plan: PublishPlan, at: string): Promise<ApprovalRecord> {
  const record: ApprovalRecord = { plan_digest: await planDigest(plan), state: "queued", reviewer: "", decided_at: at };
  await store.put(record);
  return record;
}

export async function decide(
  store: ApprovalStore,
  plan: PublishPlan,
  decision: { state: "approved" | "refused"; reviewer: string; note?: string; hours?: number },
  at: string,
): Promise<{ record?: ApprovalRecord; problems: string[] }> {
  const problems: string[] = [];
  if (!decision.reviewer?.trim()) problems.push("reviewer: a decision is a person's");
  if (decision.state === "refused" && !decision.note?.trim()) problems.push("note: a refusal carries a reason");
  if (problems.length) return { problems };
  const hours = decision.hours ?? DEFAULT_APPROVAL_WINDOW_HOURS;
  const expires = new Date(Date.parse(at) + hours * 3_600_000).toISOString();
  const record: ApprovalRecord = {
    plan_digest: await planDigest(plan),
    state: decision.state,
    reviewer: decision.reviewer.trim(),
    decided_at: at,
    expires_at: decision.state === "approved" ? expires : undefined,
    note: decision.note,
  };
  await store.put(record);
  return { problems: [], record };
}

// the approved copy of a plan, which is what a publisher is allowed to see
export async function approvedPlan(store: ApprovalStore, plan: PublishPlan, now: string): Promise<{ plan?: PublishPlan; problems: string[] }> {
  const record = await store.get(await planDigest(plan));
  const problems = approvalProblems(record, now);
  if (problems.length) return { problems };
  return { problems: [], plan: { ...plan, approval: "approved" } };
}
