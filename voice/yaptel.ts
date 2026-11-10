// yaptel is a separate project (github.com/yaptel): research that measures how one person
// actually sounds, in three layers, and ships a voice profile anyone's stack can consume.
// this file is the consuming side, and nothing else. we do not measure here and we do not
// train here: we take a profile that claims measurements and decide what it may drive.
//
// the split matters. yaptel decomposes a voice into
//
//   lingvist  the language substrate: code-switching, borrowing, diglossia, script
//   lexica    the vocabulary: slang, jargon, fillers, hedges, idiom
//   lingvica  the delivery: register, prosody, cadence, tone, punctuation as tone
//
// and the point of a profile is that it is measured, not vibed. so the rules here are
// mostly refusals: a room the profile has no real data for is a guess, timbre is not in a
// profile at all (it is in the trained voice and its digest), and a field nobody can point
// at a real linguistic term for does not get to drive a surface.

import { digestOf } from "../lock.ts";
import { SURFACE_MEDIUM } from "../persona/registers.ts";
import type { SurfaceName } from "../persona/schema.ts";

export type Coverage = "real" | "sandbox" | "absent";

export interface YaptelProfile {
  id: string;
  version: string;
  // whose voice this measures. one profile describes one person, and a compiler that ignores
  // this can rent a voice out to anybody, which is an impression rather than a reconstruction.
  subject?: string;
  // measured at, by what, and against how much material
  measured_from: { minutes: number; sources: string[]; method: "real_sample_comparison" | "llm_judge" };
  lingvist?: {
    code_switch_triggers?: string[];
    transliteration_habits?: string;
    loanword_defaults?: string[];
  };
  lexica?: {
    generational_markers?: string[];
    slang_inventory?: string[];
    fillers?: string[];
    hedges?: string[];
    idiom_preferences?: string[];
  };
  lingvica: {
    register_by_medium: Record<string, string>;
    tone_defaults: {
      warmth: number;
      sarcasm_level: number;
      playfulness: number;
      confidence: number;
    };
    punctuation_as_tone?: string[];
    channel_shift_corrections?: Record<string, Record<string, string>>;
  };
  coverage: {
    mediums_with_real_data: string[];
    mediums_sandbox_only: string[];
    mediums_absent: string[];
  };
  scoring: { method: string; confidence_by_medium: Record<string, number> };
}

// our medium names are the rooms she speaks in; yaptel's are channels it has data for
export const MEDIUM_TO_YAPTEL: Record<string, string[]> = {
  call: ["voice"],
  stream: ["voice"],
  clip: ["voice"],
  narration: ["voice"],
  podcast: ["voice"],
  caption: ["twitter", "instagram"],
  post: ["twitter", "instagram"],
  // sung delivery comes from the arrangement and the melody, never from a spoken profile
  song: [],
};

const LINGVIST_KEYS = ["code_switch_triggers", "transliteration_habits", "loanword_defaults"];
const LEXICA_KEYS = ["generational_markers", "slang_inventory", "fillers", "hedges", "idiom_preferences"];
const LINGVICA_KEYS = ["register_by_medium", "tone_defaults", "punctuation_as_tone", "channel_shift_corrections"];

// a profile key nobody can trace to a real term is a vibe wearing a measurement's clothes
export function unknownKeys(profile: YaptelProfile): string[] {
  const unknown: string[] = [];
  for (const key of Object.keys(profile.lingvist ?? {})) {
    if (!LINGVIST_KEYS.includes(key)) unknown.push(`lingvist.${key}`);
  }
  for (const key of Object.keys(profile.lexica ?? {})) {
    if (!LEXICA_KEYS.includes(key)) unknown.push(`lexica.${key}`);
  }
  for (const key of Object.keys(profile.lingvica ?? {})) {
    if (!LINGVICA_KEYS.includes(key)) unknown.push(`lingvica.${key}`);
  }
  return unknown;
}

export function profileProblems(profile: YaptelProfile): string[] {
  const problems: string[] = [...unknownKeys(profile).map((k) => `vocabulary: ${k} is not a term the research defines`)];

  if (!profile.id?.trim() || !profile.version?.trim()) {
    problems.push("profile: an id and a version, or nothing downstream can pin it");
  }
  if (!profile.lingvica) {
    problems.push("profile: no lingvica, so it describes vocabulary and not delivery");
  }
  if (!profile.lingvist && !profile.lexica) {
    problems.push("profile: neither lingvist nor lexica, so delivery is all it has");
  }
  if (!(profile.measured_from?.minutes > 0)) {
    problems.push("measured_from: no minutes of material, so this profile was written rather than measured");
  }
  if (!profile.measured_from?.sources?.length) {
    problems.push("measured_from: name the sources, because a profile nobody can audit is an opinion");
  }
  const tone = profile.lingvica?.tone_defaults ?? ({} as YaptelProfile["lingvica"]["tone_defaults"]);
  for (const key of ["warmth", "sarcasm_level", "playfulness", "confidence"]) {
    const v = (tone as Record<string, number>)[key];
    if (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 1) {
      problems.push(`tone: ${key} must be a number 0..1, since a default with no scale is a mood`);
    }
  }
  if (!Object.keys(profile.lingvica?.register_by_medium ?? {}).length) {
    problems.push("register: a profile with no register per medium cannot answer how this room sounds");
  }
  for (const [medium, confidence] of Object.entries(profile.scoring?.confidence_by_medium ?? {})) {
    if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
      problems.push(`scoring: ${medium} confidence is not a 0..1 number`);
    }
  }
  const allMediums = new Set([
    ...(profile.coverage?.mediums_with_real_data ?? []),
    ...(profile.coverage?.mediums_sandbox_only ?? []),
    ...(profile.coverage?.mediums_absent ?? []),
  ]);
  for (const medium of Object.keys(profile.lingvica?.register_by_medium ?? {})) {
    if (!allMediums.has(medium)) {
      problems.push(`coverage: ${medium} has a register but no coverage claim, so nothing says whether it is measured`);
    }
  }
  return problems;
}

export function coverageFor(profile: YaptelProfile, yaptelMedium: string): Coverage {
  if (profile.coverage?.mediums_with_real_data?.includes(yaptelMedium)) return "real";
  if (profile.coverage?.mediums_sandbox_only?.includes(yaptelMedium)) return "sandbox";
  return "absent";
}

export interface DeliveryCues {
  profile: string;
  version: string;
  surface: SurfaceName;
  medium: string;
  coverage: Coverage;
  register: string;
  prosody: string[];
  vocabulary: { fillers: string[]; hedges: string[]; slang: string[] };
  warnings: string[];
}

// what a surface gets to act on. everything here is either measured, or labelled as a guess
// and left out of the brief.
export function cuesFor(profile: YaptelProfile, surface: SurfaceName): DeliveryCues | { refused: string } {
  const medium: string = SURFACE_MEDIUM[surface];
  const candidates = MEDIUM_TO_YAPTEL[medium] ?? [];
  if (!candidates.length) {
    return { refused: `yaptel: ${surface} is ${medium}, and delivery for it comes from the arrangement, not a profile` };
  }
  const usable = candidates.find((c) => coverageFor(profile, c) !== "absent");
  if (!usable) {
    return {
      refused: `yaptel: the profile has no data for ${candidates.join(" or ")}, and ${surface} would be a guess in measured clothing`,
    };
  }
  const coverage = coverageFor(profile, usable);
  const corrections = profile.lingvica.channel_shift_corrections?.[usable] ?? {};
  const warnings: string[] = [];
  if (coverage === "sandbox") {
    warnings.push("sandbox only: preview, never a live surface");
  }
  // timbre is the trained voice's, and a profile that tries to set it is trying to be a model
  const timbreish = Object.keys(profile.lingvica.channel_shift_corrections ?? {}).length
    ? []
    : [];
  if ((profile as unknown as Record<string, unknown>).timbre) {
    warnings.push("timbre ignored: the trained voice and its digest own that, not a profile");
  }
  const register = profile.lingvica.register_by_medium[usable];
  return {
    profile: profile.id,
    version: profile.version,
    surface,
    medium: usable,
    coverage,
    register,
    prosody: Object.entries(corrections).map(([from, to]) => `${from} -> ${to}`),
    vocabulary: {
      fillers: profile.lexica?.fillers ?? [],
      hedges: profile.lexica?.hedges ?? [],
      slang: profile.lexica?.slang_inventory ?? [],
    },
    warnings: [...warnings, ...timbreish],
  };
}

// the profile is pinned in the persona pack, so a retained take and the profile that shaped
// it can be shown to belong together
export async function profileDigest(profile: YaptelProfile): Promise<string> {
  return await digestOf({ kind: "yaptel", id: profile.id, version: profile.version, profile });
}
