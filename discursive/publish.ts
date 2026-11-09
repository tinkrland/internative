// the send path, and the reasons it refuses.
//
// the interesting property of this file is how little it can do. a draft
// goes out only when three separate things agree: the persona's publishing
// permission allows it, a credential exists for that network, and a
// channel adapter is registered. any one of them missing is a refusal with
// a reason, and a refusal is written onto the draft rather than lost.
//
// no adapter is registered in this repo. that is deliberate: the shape of a
// send is known, the credential handling and the network specific fields
// are the next piece of work, and faking them here would make a green test
// that proves nothing about the real world.

import type { PersonaManifest } from "../persona/schema.ts";
import { canPublishTo, publishingDecision } from "../core/publishing.ts";
import type { Draft, DraftStore } from "./drafts.ts";
import type { TextChannel } from "./channels.ts";

export interface SendResult {
  ok: boolean;
  detail: string;
  externalId?: string;
}

export interface TextAdapter {
  channel: TextChannel;
  // the credential the adapter needs, read at call time, never stored
  credentialEnv: string;
  send(draft: Draft, opts: { token: string }): Promise<SendResult>;
}

const ADAPTERS = new Map<TextChannel, TextAdapter>();

export function registerAdapter(adapter: TextAdapter): void {
  ADAPTERS.set(adapter.channel, adapter);
}

export function adapters(): TextChannel[] {
  return Array.from(ADAPTERS.keys());
}

export interface SendDecision {
  ok: boolean;
  reason: string;
}

// the whole gate, in one place, so a caller cannot check half of it.
export function canSend(
  persona: PersonaManifest,
  draft: Draft,
  opts: { approved?: boolean; token?: string | null } = {},
): SendDecision {
  const decision = publishingDecision(persona);
  if (draft.status === "sent") return { ok: false, reason: "already sent" };
  if (draft.status === "refused") return { ok: false, reason: draft.refusal ?? "refused earlier" };
  if (draft.status === "draft" && !opts.approved) {
    return { ok: false, reason: "draft is not approved yet" };
  }
  const adapter = ADAPTERS.get(draft.channel);
  if (!adapter) return { ok: false, reason: `no adapter registered for ${draft.channel}` };
  const credential = opts.token ?? Deno.env.get(adapter.credentialEnv) ?? null;
  const gate = canPublishTo(decision, { token: credential, approved: opts.approved ?? draft.status === "approved" });
  if (!gate.ok) return { ok: false, reason: gate.reason };
  return { ok: true, reason: "publishing allowed" };
}

// send a draft, or refuse it and say why. the draft record is updated in
// both cases: a refusal that only exists in a log line is a refusal nobody
// can find later.
export async function sendDraft(
  persona: PersonaManifest,
  store: DraftStore,
  draft: Draft,
  opts: { approved?: boolean; token?: string | null } = {},
): Promise<SendResult> {
  const decision = canSend(persona, draft, opts);
  if (!decision.ok) {
    if (draft.status !== "sent") await store.setStatus(draft.id, "refused", decision.reason);
    return { ok: false, detail: decision.reason };
  }
  const adapter = ADAPTERS.get(draft.channel)!;
  const credential = opts.token ?? Deno.env.get(adapter.credentialEnv)!;
  const result = await adapter.send(draft, { token: credential });
  await store.setStatus(draft.id, result.ok ? "sent" : "refused", result.ok ? undefined : result.detail);
  return result;
}
