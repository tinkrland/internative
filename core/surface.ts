// the surface contract: the one interface every branch implements.
//
// a surface is a mouth. it does not own identity, voice, brand or
// memory: it declares where it is and who is in front of it, and asks
// the head for the rest. that is what makes seven branches one person
// instead of seven products sharing a logo.
//
// branch code calls defineSurface("text", { persona }) once and gets:
// brief(), register(), voiceStyle(), scope(), recall(), remember().

import type { PersonaManifest, SurfaceName } from "../persona/schema.ts";
import { crewFor, type ResolvedCrew } from "../persona/crew.ts";
import { resolveRegister, type ResolvedRegister } from "../persona/registers.ts";
import type { Connection } from "./connections.ts";
import type { BuiltScope } from "../memory/scope.ts";
import { provenanceTags, scopeFor } from "../memory/scope.ts";
import { ingestMemory, queryMemory, type MemoryResult } from "../memory/client.ts";
import { personaBrief } from "../persona/brand.ts";
import { voiceStyleForSurface, type VoiceStyle } from "../persona/voice_adapter.ts";
import type { PersonaPublishDecision } from "./publishing.ts";
import { publishingDecision } from "./publishing.ts";

// the branch that owns each surface. one surface, one branch, no
// sharing of code beyond persona/ and core/, which are synced from main.
export const SURFACE_BRANCH: Record<SurfaceName, string> = {
  meetings: "meetings",
  streaming: "streaming",
  shortform: "shortform",
  longform: "longform",
  audio: "audio",
  music: "music",
  static: "static",
  text: "text",
};

// the default platform per surface, so a caller that has not picked a
// destination yet still declares something honest.
export const SURFACE_DEFAULT_PLATFORM: Record<SurfaceName, string> = {
  meetings: "zoom",
  streaming: "twitch",
  shortform: "tiktok",
  longform: "youtube",
  audio: "rss",
  music: "spotify",
  static: "instagram",
  text: "x",
};

export interface SurfaceOptions {
  persona: PersonaManifest;
  // the destination inside the surface. defaults per surface.
  platform?: string;
  // anchors, when a caller already loaded them (the loader is env
  // based, so passing them keeps one read per process).
  connections?: Connection[];
}

export interface Surface {
  name: SurfaceName;
  branch: string;
  platform: string;
  persona: PersonaManifest;
  register(): ResolvedRegister;
  // the operator for this vertical: role, focus, playbooks, escalation
  crew(): ResolvedCrew;
  brief(): string;
  voiceStyle(): VoiceStyle;
  publishing(): PersonaPublishDecision;
  // who is in front of it, from the handle the surface actually holds.
  scope(handle?: string | null): BuiltScope;
  recall(query: string, handle?: string | null, opts?: { topK?: number }): Promise<MemoryResult | null>;
  remember(
    content: string,
    handle?: string | null,
    opts?: { title?: string; sourceUri?: string },
  ): Promise<boolean>;
  tags(): string[];
}

// a surface that is not enabled on the persona is a configuration bug,
// not a runtime condition: throw at construction so a branch can never
// quietly run a mouth the persona never agreed to.
export function defineSurface(name: SurfaceName, opts: SurfaceOptions): Surface {
  const persona = opts.persona;
  if (!persona.surfaces.includes(name)) {
    throw new Error(
      `persona ${persona.id}: surface ${name} is not enabled (enabled: ${persona.surfaces.join(", ")})`,
    );
  }
  const platform = (opts.platform ?? SURFACE_DEFAULT_PLATFORM[name]).trim().toLowerCase();
  const personaId = persona.memory.persona_id;

  const scopeOf = (handle?: string | null) =>
    scopeFor(platform, handle, { personaId, connections: opts.connections });

  return {
    name,
    branch: SURFACE_BRANCH[name],
    platform,
    persona,
    register: () => resolveRegister(persona, name, platform),
    crew: () => crewFor(persona, name),
    brief: () => personaBrief(persona, { surface: name, platform }),
    voiceStyle: () => voiceStyleForSurface(persona, name),
    publishing: () => publishingDecision(persona),
    scope: (handle) => scopeOf(handle),
    recall: (query, handle, recallOpts) => queryMemory(query, scopeOf(handle), recallOpts),
    remember: (content, handle, rememberOpts) => ingestMemory(content, scopeOf(handle), rememberOpts),
    tags: () => provenanceTags(scopeOf()),
  };
}


// the register the branch would use WITHOUT the platform override, for
// templates that are destination-agnostic.
export function baseRegister(persona: PersonaManifest, surface: SurfaceName) {
  return persona.voice.register_by_surface[surface];
}
