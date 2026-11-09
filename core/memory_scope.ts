// memory scope: which surface is speaking, and who is in front of it.
//
// the persona's memory rules live in retelldb (routing/scope.py): what
// may carry from one room to another, and what must be held back. those
// rules are not duplicated here. this file builds the DECLARATION a
// surface sends, so the head has something to enforce against.

import { platformClass, resolveConnection, type Connection } from "./connections.ts";

export interface MemoryScope {
  // the persona in play. undefined = the shared graph only.
  persona_id?: string;
  // the surface. required: a scope without a platform is not a scope.
  platform: string;
  // who is in front of it on THAT surface, once resolved. null is a
  // legitimate answer (a stranger, or only a display name to go on).
  connection_id: string | null;
}

export interface BuiltScope extends MemoryScope {
  // how the connection was decided, for honest logs and receipts
  anchor: "anchored" | "owner" | "stranger" | "no_config" | "ambiguous";
}

// build a scope from the handle a surface actually holds. a display
// name is NOT a handle: callers that only have a name pass undefined and
// get an unanchored scope, which the head treats as a stranger session.
export function scopeFor(
  platform: string,
  handle: string | undefined | null,
  opts: {
    personaId?: string;
    connections?: Connection[];
    // an already-resolved connection (the caller may have found it under
    // another platform's handle, for example a meeting email anchored
    // under email). passing it here keeps one resolution, not a guess.
    resolved?: Connection | null;
    // resolution already happened and was ambiguous: carry that verdict
    // instead of re-resolving into a plain stranger.
    anchorHint?: BuiltScope["anchor"];
  } = {},
): BuiltScope {
  const cls = platformClass(platform);
  if (cls === "unknown") {
    // an unknown surface declares itself honestly; the head drops
    // everything for it, which is the safe direction
    console.warn(`clawbuzz: memory scope on an unknown platform: ${platform}`);
  }
  const resolution = opts.resolved !== undefined
    ? {
      connection: opts.resolved,
      reason: opts.resolved ? "anchored" as const : "unknown_handle" as const,
    }
    : resolveConnection(platform, handle, opts.connections);
  const connection = resolution.connection;
  if (!connection && opts.anchorHint && opts.anchorHint !== "stranger") {
    return {
      persona_id: opts.personaId,
      platform: platform.trim().toLowerCase(),
      connection_id: null,
      anchor: opts.anchorHint,
    };
  }
  return {
    persona_id: opts.personaId,
    platform: platform.trim().toLowerCase(),
    connection_id: connection?.id ?? null,
    anchor: connection
      ? (connection.owner ? "owner" : "anchored")
      : resolution.reason === "ambiguous"
      ? "ambiguous"
      : resolution.reason === "no_config"
      ? "no_config"
      : "stranger",
  };
}

// the tags a write carries so the read rules can hold it back later.
// same vocabulary as the python side: platform:<p>, connection:<id>.
export function provenanceTags(scope: MemoryScope): string[] {
  const tags = [`platform:${scope.platform}`];
  if (scope.connection_id) tags.push(`connection:${scope.connection_id}`);
  return tags;
}

// the query/ingest body fields the retelldb server understands. an
// unanchored scope still declares its platform: "a stream, nobody
// anchored" is a real statement, and the head holds anchored memory
// back from it on purpose.
export function scopePayload(scope: MemoryScope): {
  platform: string;
  connection_id?: string;
  persona_id?: string;
} {
  return {
    platform: scope.platform,
    ...(scope.connection_id ? { connection_id: scope.connection_id } : {}),
    ...(scope.persona_id ? { persona_id: scope.persona_id } : {}),
  };
}
