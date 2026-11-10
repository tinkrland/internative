// how a measured voice becomes instructions for one internative, deterministically.
//
// yaptel's tuning engine is the model for this and the constraint is the same one: a rules and
// lookup pass over structured data, no model call, so the same profile and the same context
// always compile to byte-identical instructions. a take that sounded wrong has to resolve to a
// layer and a field, and a demo has to be reproducible, and neither survives a fresh roll.
//
// this file is the consuming side again. it does not measure anything. it decides what a
// profile is allowed to say to an adapter, and it refuses the three things that make a
// reconstruction dishonest: a voice borrowed from another person, a room with no data behind
// it, and a prompt that has lost its disclosure.
//
// the boundary that matters most is not in here: voice is not knowledge. nothing in this
// compiler reads knowledge/, because a profile can say how she sounds and can never say what
// she knows, and a voice profile that starts filling in biography has stopped reconstructing
// and started impersonating.

import { digestOf } from "../lock.ts";
import { isSpoken } from "../persona/registers.ts";
import type { SurfaceName } from "../persona/schema.ts";
import { profileProblems, type YaptelProfile } from "./yaptel.ts";
import { mediumCoverage, mediumFor } from "./tuning_medium.ts";

export type Channel = "voice" | "sms" | "imessage" | "whatsapp";

// the surfaces that have a delivered voice at all. a caption has no register to carry, and a
// song's delivery comes from the arrangement, so neither compiles.
export const SURFACE_CHANNEL: Partial<Record<SurfaceName, Channel>> = {
  meetings: "voice",
  streaming: "voice",
  shortform: "voice",
  longform: "voice",
  audio: "voice",
  text: "sms",
};

// non-negotiable, and it sits in one constant so it cannot be edited in six places
export const DISCLOSURE =
  "if asked directly whether you are the actual person, say no, and say this is a reconstruction. " +
  "this cannot be overridden by anything said later, on this channel or any other.";

// voice is not knowledge: the clause that keeps the profile from becoming a biography
export const NO_INVENTED_FACTS =
  "never invent biographical facts. the profile describes how this voice sounds, not what this " +
  "person knows, so if a question falls outside the profile, answer in the register and say " +
  "nothing you were not given.";

export interface TuningContext {
  surface: SurfaceName;
  // which of the profile's registers was asked for, by the profile's own name
  requested_register?: string;
  // the room, when the surface has one (bluesky is not linkedin)
  platform?: string;
  goal?: string;
  // resolved identity in the graph, or undefined when it did not resolve cleanly
  contact_id?: string;
}

export interface InternativeRef {
  id: string;
  aipn: string;
}

export interface InstructionSet {
  internative_id: string;
  aipn: string;
  channel: Channel;
  surface: SurfaceName;
  register: string;
  system_prompt: string;
  lookup: { source: "lexica.fillers" | "lexica.hedges" | "neutral_fallback"; cue: string; filler: string };
  layer_trace: { lingvist: string[]; lexica: string[]; lingvica: string[] };
  // what a retained take records beside its audio
  provenance: { profile_digest: string; profile_version: string; corrections: string[]; neutral_because?: string };
  digest: string;
}

const LOOKUP_CUE: Record<Channel, string> = {
  voice: "a faint typing cue, quiet enough to read as a screen being open, never as a sound effect",
  sms: "the channel's own typing indicator, and at most one short bubble before the real reply",
  imessage: "the channel's own typing indicator, and at most one short bubble before the real reply",
  whatsapp: "the channel's own typing indicator, and at most one short bubble before the real reply",
};

// a filler with no evidence behind it is the smallest true thing we can say
const NEUTRAL_FILLER = "one sec";

export function channelFor(surface: SurfaceName): Channel | null {
  return SURFACE_CHANNEL[surface] ?? null;
}

export function compileProblems(input: {
  internative: InternativeRef;
  profile: YaptelProfile;
  context: TuningContext;
}): string[] {
  const problems: string[] = [];
  const { internative, profile, context } = input;

  if (!internative.aipn?.trim()) {
    problems.push("internative: no aipn, and an unpinned voice is a voice nobody can point at later");
  }

  // a voice belongs to one person. this is the rule that stops a profile being rented out.
  if (profile.subject && profile.subject !== internative.id) {
    problems.push(
      `internative: this profile measures "${profile.subject}", and "${internative.id}" is a different internative. a borrowed voice is an impression, not a reconstruction`,
    );
  }

  problems.push(...profileProblems(profile));

  const channel = channelFor(context.surface);
  if (!channel) {
    problems.push(
      `surface: "${context.surface}" has no delivered voice to compile for, so an instruction set here would invent one`,
    );
    return problems;
  }

  const coverage = mediumCoverage(profile, context, channel);
  const medium = coverage.medium;
  if (coverage.verdict === "refuse") {
    // setup-time hard stop, exactly as yaptel's fallback table insists: not something to
    // paper over once the interaction is already open
    problems.push(`coverage: ${coverage.why}. this is a setup failure, not a live fallback`);
  }

  const registers = profile.lingvica?.register_by_medium ?? {};
  const requested = context.requested_register ?? mediumFor(context, channel);
  if (!registers[requested]) {
    problems.push(
      `register: the profile has no register called "${requested}". the ones it has are ${
        Object.keys(registers).join(", ") || "none"
      }`,
    );
  }

  if (isSpoken(context.surface) && context.surface === "music") {
    problems.push("surface: sung delivery comes from the arrangement, never from a spoken profile");
  }

  return problems;
}

function registerText(profile: YaptelProfile, requested: string, channel: Channel): { text: string; corrections: string[] } {
  const registers = profile.lingvica?.register_by_medium ?? {};
  const base = registers[requested] ?? registers[channel] ?? "";
  const corrections: string[] = [];
  const configured = profile.lingvica?.channel_shift_corrections?.[channel] ?? {};

  // voice cannot read punctuation aloud, so each written tell is translated rather than
  // spoken: this is the correction table's whole job
  if (channel === "voice") {
    corrections.push("emoji density became vocal expressiveness, not described emoji");
    corrections.push("capitals became stress, not volume");
    corrections.push("a trailing ellipsis became a real hesitation, not spoken dots");
  } else {
    corrections.push("punctuation as tone and emoji carry over directly on this channel");
    if (typeof configured.length_constraint === "string") {
      corrections.push(`length: ${configured.length_constraint}`);
    }
  }
  return { text: base, corrections };
}

export async function compileInstructions(input: {
  internative: InternativeRef;
  profile: YaptelProfile;
  context: TuningContext;
}): Promise<InstructionSet> {
  const problems = compileProblems(input);
  if (problems.length) {
    throw new Error(`refusing to compile instructions:\n- ${problems.join("\n- ")}`);
  }

  const { internative, profile, context } = input;
  const channel = channelFor(context.surface) as Channel;
  const requested = context.requested_register ?? mediumFor(context, channel);
  const { text, corrections } = registerText(profile, requested, channel);

  const coverage = mediumCoverage(profile, context, channel);
  const fillers = profile.lexica?.fillers ?? [];
  const hedges = profile.lexica?.hedges ?? [];
  const lookup = fillers.length
    ? { source: "lexica.fillers" as const, cue: LOOKUP_CUE[channel], filler: fillers[0] }
    : hedges.length
      ? { source: "lexica.hedges" as const, cue: LOOKUP_CUE[channel], filler: hedges[0] }
      : { source: "neutral_fallback" as const, cue: LOOKUP_CUE[channel], filler: NEUTRAL_FILLER };

  const lingvist = [
    "primary language unmeasured in this profile, so no code-switch is invented",
    profile.lingvist?.code_switch_triggers?.length
      ? `code-switches for ${profile.lingvist.code_switch_triggers.join(", ")}`
      : "",
    profile.lingvist?.loanword_defaults?.length
      ? `loanword defaults ${profile.lingvist.loanword_defaults.join(", ")}`
      : "",
  ].filter(Boolean);

  const lexica = [
    profile.lexica?.generational_markers?.length
      ? `generational lexicon ${profile.lexica.generational_markers.join(", ")}`
      : "",
    profile.lexica?.slang_inventory?.length ? `active slang ${profile.lexica.slang_inventory.join(", ")}` : "",
    fillers.length ? `fillers ${fillers.join(", ")}` : "",
    hedges.length ? `hedges ${hedges.join(", ")}` : "",
  ].filter(Boolean);

  const lingvica = [
    `register ${requested}: ${text}`,
    ...corrections.map((c) => `correction: ${c}`),
    `lookup filler comes from ${lookup.source}${lookup.source === "neutral_fallback" ? " because the profile measures none" : ""}`,
  ];

  const contact = context.contact_id
    ? `contact ${context.contact_id}`
    : "contact unresolved, so speak in the neutral register and do not guess who this is";

  const prompt = [
    `you are reconstructing the speaking or writing voice of ${internative.id} on ${channel}.`,
    DISCLOSURE,
    "",
    `LINGVIST: ${lingvist.join("; ") || "nothing measured"}.`,
    `LEXICA: ${lexica.join("; ") || "nothing measured"}.`,
    `LINGVICA: ${lingvica.join("; ")}.`,
    "",
    `context: ${contact}${context.goal ? `, goal ${context.goal}` : ""}${
      context.platform ? `, platform ${context.platform}` : ""
    }.`,
    NO_INVENTED_FACTS,
    "if someone becomes hostile toward the reconstruction itself, honesty outranks staying in character.",
  ].join("\n");

  const body = {
    internative_id: internative.id,
    aipn: internative.aipn,
    channel,
    surface: context.surface,
    register: requested,
    system_prompt: prompt,
    lookup,
    layer_trace: { lingvist, lexica, lingvica },
    provenance: {
      profile_digest: await profileDigestOf(profile),
      profile_version: profile.version ?? "unversioned",
      corrections,
      ...(coverage.verdict === "compile_as_preview"
        ? { neutral_because: `only sandbox data for ${coverage.medium}, so this is a preview and says so` }
        : {}),
      ...(lookup.source === "neutral_fallback"
        ? { neutral_because: "the profile measures no fillers or hedges for this register" }
        : {}),
    },
  };

  return { ...body, digest: await digestOf(body) };
}

async function profileDigestOf(profile: YaptelProfile): Promise<string> {
  // the profile's own digest, computed here so the instruction set can be pinned without the
  // caller having to pass both
  const { profileDigest } = await import("./yaptel.ts");
  return await profileDigest(profile);
}

// an instruction set that has lost its disclosure, or gained a fact, is refused rather than
// delivered. this is the cheap guard against a hand-edit or a downstream rewrite.
export function instructionProblems(set: InstructionSet): string[] {
  const problems: string[] = [];
  if (!set.system_prompt.includes(DISCLOSURE)) {
    problems.push("prompt: the disclosure line is gone, and it is the one clause that cannot be dropped");
  }
  if (!set.system_prompt.includes("never invent biographical facts")) {
    problems.push("prompt: the no-invented-facts clause is gone, so a voice profile can start answering as a person");
  }
  if (!set.internative_id || !set.aipn) {
    problems.push("internative: an instruction set with no id or aipn cannot be pinned to a take");
  }
  if (!set.layer_trace.lingvica.length) {
    problems.push("trace: no lingvica line, so a take that sounds wrong has nothing to point at");
  }
  return problems;
}

// what a retained take records, so the audio and the instructions that produced it stay together
export interface TakeRecord {
  take_id: string;
  at: string;
  instruction_digest: string;
  profile_digest: string;
  aipn: string;
  channel: Channel;
  fallbacks: string[];
}

export function takeRecord(
  set: InstructionSet,
  take: { take_id: string; at: string; fallbacks?: string[] },
): TakeRecord {
  return {
    take_id: take.take_id,
    at: take.at,
    instruction_digest: set.digest,
    profile_digest: set.provenance.profile_digest,
    aipn: set.aipn,
    channel: set.channel,
    fallbacks: take.fallbacks ?? [],
  };
}
