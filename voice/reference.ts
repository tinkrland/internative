// the reference set: what a singing voice is trained from, and what disqualifies it.
//
// a speech adapter can borrow a voice at call time. a singing voice cannot: the open
// singing models each need their own copy of the timbre, trained from recordings, so
// the recordings are the asset. which makes them the thing worth contracting, and
// the thing whose provenance matters more than its quantity.

export type TakeSource = "owner" | "licensed" | "tts";

export interface ReferenceTake {
  id: string;
  path: string;
  seconds: number;
  // mono at this rate, or it is not a take, it is a file
  sample_rate: number;
  channels: number;
  source: TakeSource;
  // what was actually said, so vowel coverage can be counted rather than assumed
  text?: string;
  // false when the take is spoken word, true when it is sung
  sung: boolean;
  // midi note numbers of the lowest and highest note in a sung take
  pitch_range?: [number, number];
  // a language tag, because a voice trained in one will not pronounce another
  language: string;
  // for a real human voice: consent on file, by name and date
  consent?: { by: string; on: string };
  // for a borrowed voice: the licence that allows training on it
  licence?: string;
  // for our own synthetic voice: which adapter produced it
  tts?: string;
}

export interface ReferenceSet {
  voice_id: string;
  // the digest of the speech voice this must be the same voice as
  identity_digest: string;
  takes: ReferenceTake[];
}

// the numbers are the models' own claims, not a preference: rvc trains on ten
// minutes, and an svs model wants three times that before a vowel sounds like her.
export const MIN_TOTAL_SECONDS = 600;
export const WANTED_TOTAL_SECONDS = 1800;
// an aligner drifts on long clips and starves on short ones
export const TAKE_SECONDS = { min: 3, max: 30 } as const;

// five vowel sounds is where a word stops being a mumble. counted from take text
// rather than from audio, because this check runs before anything is rendered.
const VOWELS = ["a", "e", "i", "o", "u"];

export function vowelCoverage(takes: ReferenceTake[]): string[] {
  const seen = new Set<string>();
  for (const take of takes) {
    for (const ch of (take.text ?? "").toLowerCase()) if (VOWELS.includes(ch)) seen.add(ch);
  }
  return VOWELS.filter((v) => seen.has(v));
}

export function totalSeconds(takes: ReferenceTake[]): number {
  return Math.round(takes.reduce((n, t) => n + t.seconds, 0));
}

export function sungSeconds(takes: ReferenceTake[]): number {
  return Math.round(takes.filter((t) => t.sung).reduce((n, t) => n + t.seconds, 0));
}

// the span the sung takes actually cover, in semitones
export function pitchSpan(takes: ReferenceTake[]): number {
  const sung = takes.filter((t) => t.sung && t.pitch_range);
  if (!sung.length) return 0;
  const low = Math.min(...sung.map((t) => t.pitch_range![0]));
  const high = Math.max(...sung.map((t) => t.pitch_range![1]));
  return high - low;
}

export interface TrainOptions {
  // the digest of the voice the internative already speaks in
  speech_digest: string;
  // a song that goes out needs a voice that is ours or licensed, never borrowed
  for_release: boolean;
}

export function referenceProblems(set: ReferenceSet, opts: TrainOptions): string[] {
  const problems: string[] = [];
  if (!set.takes.length) return [`${set.voice_id}: no takes, so there is no voice to train`];
  if (set.identity_digest !== opts.speech_digest) {
    problems.push(`${set.voice_id}: trained from a different digest than the speech voice, so the chorus would not be her`);
  }
  const total = totalSeconds(set.takes);
  if (total < MIN_TOTAL_SECONDS) {
    problems.push(`${set.voice_id}: ${total}s of reference, and ${MIN_TOTAL_SECONDS}s is the floor before a timbre holds`);
  }
  for (const take of set.takes) {
    if (!take.path) problems.push(`${take.id}: no file, so nothing to align against`);
    if (take.channels !== 1) problems.push(`${take.id}: ${take.channels} channels, and a mono take is what the trainer expects`);
    if (take.sample_rate < 40000) problems.push(`${take.id}: ${take.sample_rate} Hz, and below 40k the sibilance is gone`);
    if (take.seconds < TAKE_SECONDS.min) problems.push(`${take.id}: ${take.seconds}s is too short to align`);
    if (take.seconds > TAKE_SECONDS.max) problems.push(`${take.id}: ${take.seconds}s is long enough for an aligner to drift`);
    if (take.source === "owner" && !take.consent) {
      problems.push(`${take.id}: a real human voice needs consent on file, by name and date`);
    }
    if (take.source === "licensed" && !take.licence) {
      problems.push(`${take.id}: borrowed audio needs the licence that permits training`);
    }
    if (take.source === "tts" && !take.tts) problems.push(`${take.id}: synthetic audio must name the adapter that made it`);
  }
  const sources = new Set(set.takes.map((t) => t.source));
  if (sources.size > 1) {
    problems.push(`${set.voice_id}: takes from ${[...sources].join(" and ")}, and a voice cannot be half borrowed`);
  }
  if (opts.for_release && sources.has("licensed") && !set.takes.every((t) => t.licence)) {
    problems.push(`${set.voice_id}: a release needs every borrowed take covered by a licence`);
  }
  if (vowelCoverage(set.takes).length < 5) {
    problems.push(`${set.voice_id}: ${vowelCoverage(set.takes).join("") || "no"} vowels covered, and five is where words stop mumbling`);
  }
  return problems;
}

export interface TrainingPlan {
  voice_id: string;
  // what the set can actually train, in the order it should happen
  steps: { vendor: string; licence: string; why: string }[];
  notes: string[];
}

// what this set can become. a spoken reference trains conversion, which keeps the
// melody of whatever sang it, so it is honest for a cover and wrong for an original.
export function trainingPlan(set: ReferenceSet): TrainingPlan {
  const sung = sungSeconds(set.takes);
  const span = pitchSpan(set.takes);
  const total = totalSeconds(set.takes);
  const steps: TrainingPlan["steps"] = [];
  const notes: string[] = [];

  if (sung > 0) {
    steps.push({ vendor: "diffsinger", licence: "MIT", why: "melody and syllables in, one vocal out" });
    if (total < WANTED_TOTAL_SECONDS) {
      notes.push(`${total}s of audio, and ${WANTED_TOTAL_SECONDS}s is where an svs vowel stops sounding like a neighbour`);
    }
    if (span < 12) notes.push(`a ${span} semitone span, and a pop melody usually asks for an octave`);
  } else {
    steps.push({ vendor: "rvc", licence: "MIT", why: "timbre conversion of a donor take, no new melodies" });
    notes.push("no sung reference: this voice can cover a melody someone else sang, and cannot invent one");
  }
  return { voice_id: set.voice_id, steps, notes };
}
