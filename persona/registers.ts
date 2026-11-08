// registers: how one person sounds, per room.
//
// a persona ships a register for every surface (the loader enforces it)
// and may add per-platform overrides on top. the text surface speaks on
// several networks with different manners, so the override is where
// "bluesky is not linkedin" lives: in configuration, not in five
// branches' if-statements.
//
// resolution is deliberately shallow: every register field is a scalar,
// so an override replaces rather than merges. a persona author can read
// one register and know exactly what the platform will get.

import type { PersonaManifest, RegisterSpec, SurfaceName } from "./schema.ts";

// the medium key handed to the voice adapter. calls, streams, long form
// and podcasts are spoken; shortform is spoken but clipped; text and
// static are written and have no delivery cues.
export const SURFACE_MEDIUM: Record<SurfaceName, string> = {
  meetings: "call",
  streaming: "stream",
  shortform: "clip",
  longform: "narration",
  audio: "podcast",
  music: "song",
  static: "caption",
  text: "post",
};

// music is sung rather than spoken: its delivery comes from the arrangement and the
// melody, not from the voice adapter's call and podcast cues, so it stays out of this
// list on purpose.
export const SPOKEN_SURFACES: SurfaceName[] = ["meetings", "streaming", "shortform", "longform", "audio"];

export function isSpoken(surface: SurfaceName): boolean {
  return SPOKEN_SURFACES.includes(surface);
}

// resolve the register actually in force for a surface, optionally on a
// named platform (x, bluesky, linkedin, tiktok, spotify, ...). throws
// when the persona does not enable the surface, because a surface with
// no register is a surface that would improvise.
export function registerFor(
  persona: PersonaManifest,
  surface: SurfaceName,
  platform?: string,
): RegisterSpec {
  if (!persona.surfaces.includes(surface)) {
    throw new Error(`persona ${persona.id}: surface ${surface} is not enabled`);
  }
  const base = persona.voice.register_by_surface[surface];
  if (!base) {
    throw new Error(`persona ${persona.id}: no register for ${surface}`);
  }
  const key = (platform ?? "").trim().toLowerCase();
  const override = key ? persona.voice.register_by_platform?.[key] : undefined;
  if (!override) return { ...base };
  return { ...base, ...override };
}

// the fields a caller can rely on after resolution. defaults live here,
// once, so a generator never has to invent a length or an emoji policy.
export interface ResolvedRegister extends RegisterSpec {
  pace: NonNullable<RegisterSpec["pace"]>;
  energy: number;
  formality: number;
  hooks: boolean;
  cta: boolean;
  emoji: NonNullable<RegisterSpec["emoji"]>;
  hashtags: NonNullable<RegisterSpec["hashtags"]>;
}

export function resolveRegister(
  persona: PersonaManifest,
  surface: SurfaceName,
  platform?: string,
): ResolvedRegister {
  const r = registerFor(persona, surface, platform);
  return {
    ...r,
    pace: r.pace ?? "measured",
    energy: r.energy ?? 0.5,
    formality: r.formality ?? 0.4,
    hooks: r.hooks ?? false,
    cta: r.cta ?? false,
    emoji: r.emoji ?? "none",
    hashtags: r.hashtags ?? "none",
  };
}
