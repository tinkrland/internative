// the text surface, wired to the head.
//
// six networks, one brief. the platform override is what makes bluesky and
// linkedin different people than discord, and it comes from the manifest,
// not from this file. all this surface adds is mechanics: composing to the
// ceiling, planning a reply with the right scope, and holding drafts until
// the gate opens.

import { loadPersona } from "../persona/loader.ts";
import { defineSurface, type Surface } from "../core/surface.ts";
import type { PersonaManifest } from "../persona/schema.ts";
import type { TextChannel } from "./channels.ts";
import { channelSpec } from "./channels.ts";
import { composePost, type Composed } from "./compose.ts";
import { planReply, type InboundEvent, type ReplyPlan } from "./replies.ts";
import { DraftStore, type Draft } from "./drafts.ts";
import type { Connection } from "../core/connections.ts";

export function textSurface(persona: PersonaManifest, channel: TextChannel = "x"): Surface {
  return defineSurface("text", { persona, platform: channel });
}

export interface WriteRequest {
  idea: string;
  channel: TextChannel;
  tags?: string[];
  source?: Draft["source"];
}

// one call from an idea to a draft on disk. nothing here sends: the draft
// store is the end of this surface until a human or a schedule approves it.
export async function writeDraft(
  persona: PersonaManifest,
  store: DraftStore,
  req: WriteRequest,
): Promise<{ draft: Draft; composed: Composed; surface: Surface }> {
  const surface = textSurface(persona, req.channel);
  const composed = composePost({
    text: req.idea,
    channel: req.channel,
    register: surface.register(),
    tags: req.tags,
  });
  const draft = await store.append({
    channel: req.channel,
    parts: composed.parts,
    source: req.source,
    dropped: composed.dropped,
    warnings: composed.warnings,
  });
  return { draft, composed, surface };
}

export async function replyTo(
  persona: PersonaManifest,
  event: InboundEvent,
  replyText: string,
  opts: { connections?: Connection[] } = {},
): Promise<ReplyPlan> {
  return await planReply(persona, event, { replyText, connections: opts.connections });
}

// a receipt line for the owner: what went out, where, and what the composer
// changed to make it fit. never a claim that something was posted.
export function receiptFor(draft: Draft): string {
  const spec = channelSpec(draft.channel);
  const parts = draft.parts.length === 1 ? "one post" : `${draft.parts.length} parts`;
  const dropped: string[] = [];
  if (draft.dropped?.emoji) dropped.push(`${draft.dropped.emoji} emoji`);
  if (draft.dropped?.hashtags.length) dropped.push(`${draft.dropped.hashtags.length} hashtags`);
  const changes = dropped.length ? `, dropped ${dropped.join(" and ")}` : "";
  return `${spec.channel}: ${parts}, ${draft.status}${changes}`;
}

export async function currentSurface(channel: TextChannel = "x"): Promise<Surface> {
  return textSurface(await loadPersona(), channel);
}
