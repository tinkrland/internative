// replies: the difference between a broadcast and a personality.
//
// a post reaches everyone; a reply reaches one person. that is why the
// scope matters here and not on the posting path: the head holds back
// what a public surface may know about a private conversation, and this
// module declares the surface and the person before anything is drafted.
//
// the reply text itself comes from whatever the persona uses to think. what
// this module owns is who is being answered, what the persona remembers of
// them, and whether that memory was withheld by the scope rules.

import type { PersonaManifest } from "../persona/schema.ts";
import { resolveRegister, type ResolvedRegister } from "../persona/registers.ts";
import type { Connection } from "../core/connections.ts";
import { platformClass } from "../core/connections.ts";
import { scopeFor, type BuiltScope } from "../core/memory_scope.ts";
import { memoryConfigured, queryMemory } from "../core/memory.ts";
import { composePost, type Composed } from "./compose.ts";
import { channelSpec, graphemeLength, type TextChannel } from "./channels.ts";

export interface InboundEvent {
  channel: TextChannel;
  authorHandle: string;
  authorDisplay?: string;
  text: string;
  threadId?: string;
  receivedAt?: string;
}

export interface ReplyPlan {
  event: InboundEvent;
  scope: BuiltScope;
  // private room or public thread: the register and the memory rules both
  // key off this, so it is decided once, here.
  privacy: "private" | "public_social";
  register: ResolvedRegister;
  memory: { enabled: boolean; nodes: number; withheld: number; titles: string[] };
  composed: Composed;
}

export async function planReply(
  persona: PersonaManifest,
  event: InboundEvent,
  opts: {
    replyText: string;
    connections?: Connection[];
    topK?: number;
  },
): Promise<ReplyPlan> {
  const spec = channelSpec(event.channel);
  const personaId = persona.memory.persona_id;
  const scope = scopeFor(spec.platform, event.authorHandle, {
    personaId,
    connections: opts.connections,
  });
  const privacy = platformClass(spec.platform) === "private" ? "private" : "public_social";
  const register = resolveRegister(persona, "text", spec.platform);

  // a reply to a stranger is written without memory, and says so. a reply
  // to someone the persona knows is grounded in what it remembers, scoped
  // to this surface and this person.
  let memory = { enabled: memoryConfigured(), nodes: 0, withheld: 0, titles: [] as string[] };
  if (scope.connection_id) {
    const result = await queryMemory(
      `what does ${persona.display_name} know about ${scope.connection_id}`,
      scope,
      { topK: opts.topK ?? 5 },
    );
    if (result) {
      memory = {
        enabled: true,
        nodes: result.nodes.length,
        withheld: result.dropped.length,
        titles: result.nodes.map((n) => n.title),
      };
    }
  }

  const composed = composePost({
    text: opts.replyText,
    channel: event.channel,
    register,
  });

  // a reply is one post on every network here. a reply that needs a thread
  // is not a reply, it is a post with a target.
  if (composed.parts.length > 1) {
    throw new Error(
      `reply: ${graphemeLength(opts.replyText)} graphemes does not fit one ${spec.channel} reply (${spec.maxGraphemes})`,
    );
  }

  return { event, scope, privacy, register, memory, composed };
}

// what the drafting side is allowed to be told. this is the honest seam
// between memory and writing: a stranger gets no memory, an anchored
// person gets the kept nodes, and drops are counted rather than hidden.
export function groundingFor(plan: ReplyPlan): {
  who: string;
  known: boolean;
  titles: string[];
  withheld: number;
  note: string;
} {
  const known = plan.scope.anchor === "anchored" || plan.scope.anchor === "owner";
  return {
    who: plan.event.authorDisplay ?? plan.event.authorHandle,
    known,
    titles: plan.memory.titles,
    withheld: plan.memory.withheld,
    note: known
      ? `${plan.memory.nodes} remembered item(s), ${plan.memory.withheld} withheld by the scope rules`
      : `unknown person on ${plan.scope.platform}: reply without assuming history`,
  };
}
