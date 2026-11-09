// three lanes, because a song is three decisions that fail in three ways.
//
// the musicality is the vibe: key, tempo, groove, arrangement. the lyric is the
// words. the performance is how those words land on that music in a particular
// voice. a model that does all three at once hides which one went wrong, and a
// re-sing of the same song in the same key is impossible without regenerating the
// melody it was never allowed to separate.
//
// so they are separate artifacts with their own digests, and reassembly is a
// planned step rather than a hoping step. licences are read from each repository,
// not from a blog: a released song may only use what a released song may use.

export type Lane = "musicality" | "lyric" | "performance";
export type Plumbing = "assembly";

export interface LaneVendor {
  id: string;
  lane: Lane | Plumbing;
  licence: string;
  // may the output be sold and streamed
  commercial: boolean;
  // "process" means it runs as a separate service over http, never imported
  isolation: "none" | "process";
  what: string;
}

export const LANE_VENDORS: LaneVendor[] = [
  { id: "score-synth", lane: "musicality", licence: "MIT", commercial: true, isolation: "none", what: "our own render.ts: the score played as arithmetic, no model at all" },
  { id: "ace-step-1.5", lane: "musicality", licence: "MIT", commercial: true, isolation: "none", what: "local music generation with lyric and style conditioning" },
  { id: "ace-step", lane: "musicality", licence: "Apache-2.0", commercial: true, isolation: "none", what: "the first release of the same model" },
  { id: "diffrhythm", lane: "musicality", licence: "Apache-2.0", commercial: true, isolation: "none", what: "full song in one pass, fast, latent diffusion" },
  { id: "yue", lane: "musicality", licence: "Apache-2.0", commercial: true, isolation: "none", what: "lyrics to song with symbolic planning" },
  { id: "musicgen", lane: "musicality", licence: "CC-BY-NC-4.0", commercial: false, isolation: "none", what: "audiocraft code is MIT but the weights are non commercial, so previews and reference only" },
  { id: "diffsinger", lane: "performance", licence: "MIT", commercial: true, isolation: "none", what: "singing from a melody and phonemes, which is the lane written down as a format" },
  { id: "rvc", lane: "performance", licence: "MIT", commercial: true, isolation: "none", what: "voice conversion from about ten minutes of reference audio" },
  { id: "openvoice", lane: "performance", licence: "MIT", commercial: true, isolation: "none", what: "instant voice cloning, tone colour separated from style" },
  { id: "seed-vc", lane: "performance", licence: "GPL-3.0", commercial: true, isolation: "process", what: "zero shot conversion, strong on singing; copyleft, so it is a service not a dependency" },
  { id: "so-vits-svc", lane: "performance", licence: "AGPL-3.0", commercial: true, isolation: "process", what: "singing voice conversion with a trained speaker" },
  { id: "basic-pitch", lane: "performance", licence: "Apache-2.0", commercial: true, isolation: "none", what: "audio to midi, for reading a melody back out of a reference take" },
  { id: "whisperx", lane: "performance", licence: "BSD-2-Clause", commercial: true, isolation: "none", what: "word level timings, for checking a sung line against its words" },
  { id: "demucs", lane: "assembly", licence: "MIT", commercial: true, isolation: "none", what: "stems from a finished mix, for taking a model's one pass apart again" },
];

export function vendorFor(id: string): LaneVendor | null {
  return LANE_VENDORS.find((v) => v.id === id) ?? null;
}

export function laneVendors(lane: Lane | Plumbing): LaneVendor[] {
  return LANE_VENDORS.filter((v) => v.lane === lane);
}

// a preview may use anything. a release may not: a non commercial weight would make
// every stream of that song a breach, and a copyleft runtime imported in process
// would make the whole build one.
export function vendorProblems(vendor: LaneVendor, released: boolean): string[] {
  const problems: string[] = [];
  if (!released) return problems;
  if (!vendor.commercial) problems.push(`${vendor.id}: ${vendor.licence} cannot carry a released song`);
  if (vendor.isolation !== "process" && /GPL/.test(vendor.licence)) {
    problems.push(`${vendor.id}: ${vendor.licence} must run as a separate process, not inside the build`);
  }
  return problems;
}

// the singing voice is the same internative as the speaking voice, or the song is a
// different person. that is a checkable claim, not a vibe: one identity, one digest.
export interface VoiceIdentity {
  id: string;
  digest: string;
}

export function voiceIdentityProblems(speaking: VoiceIdentity, singing: VoiceIdentity): string[] {
  const problems: string[] = [];
  if (!speaking.id || !speaking.digest) problems.push("the internative has no speaking voice to sing in");
  if (singing.id !== speaking.id) {
    problems.push(`the song is in ${singing.id}, but the internative speaks in ${speaking.id}`);
  }
  if (singing.digest !== speaking.digest) {
    problems.push("the singing voice is a different take of the voice, so it is a different timbre");
  }
  return problems;
}
