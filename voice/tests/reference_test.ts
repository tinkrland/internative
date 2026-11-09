// the reference set is the asset, so it is the thing that has to be refused well.

import { assertEquals } from "jsr:@std/assert@1";
import {
  MIN_TOTAL_SECONDS,
  pitchSpan,
  referenceProblems,
  sungSeconds,
  totalSeconds,
  trainingPlan,
  vowelCoverage,
  type ReferenceSet,
  type ReferenceTake,
} from "../reference.ts";

const DIGEST = "voice-digest-1";
const opts = { speech_digest: DIGEST, for_release: true };

function take(over: Partial<ReferenceTake> = {}): ReferenceTake {
  return {
    id: "t1", path: "/tmp/t1.wav", seconds: 12, sample_rate: 48000, channels: 1,
    source: "tts", tts: "fake", sung: false, language: "en",
    text: "a line of ordinary words, usually sunny", ...over,
  };
}

function set(takes: ReferenceTake[], digest = DIGEST): ReferenceSet {
  return { voice_id: "voice-1", identity_digest: digest, takes };
}

Deno.test("a batch of short takes is a voice, and the total is what counts", () => {
  const takes = Array.from({ length: 55 }, (_, i) => take({ id: `t${i}`, seconds: 12 }));
  assertEquals(totalSeconds(takes), 660);
  assertEquals(referenceProblems(set(takes), opts), []);
});

Deno.test("a human voice with no consent is refused, and consent is a name and a date", () => {
  const takes = Array.from({ length: 55 }, (_, i) => take({ id: `o${i}`, source: "owner" }));
  const problems = referenceProblems(set(takes), opts);
  assertEquals(problems.some((p) => p.includes("consent on file")), true);
  const consented = takes.map((t) => ({ ...t, consent: { by: "anne", on: "2026-11-09" } }));
  assertEquals(referenceProblems(set(consented), opts), []);
});

Deno.test("a voice cannot be half borrowed", () => {
  const takes = [
    ...Array.from({ length: 50 }, (_, i) => take({ id: `o${i}`, source: "owner", consent: { by: "anne", on: "2026-11-09" } })),
    take({ id: "borrowed", source: "licensed", licence: "cc-by-4.0" }),
  ];
  const problems = referenceProblems(set(takes), opts);
  assertEquals(problems.some((p) => p.includes("half borrowed")), true);
});

Deno.test("the chorus has to be the same voice as the podcast", () => {
  const takes = Array.from({ length: 55 }, (_, i) => take({ id: `t${i}` }));
  const problems = referenceProblems(set(takes, "some-other-digest"), opts);
  assertEquals(problems.some((p) => p.includes("would not be her")), true);
});

Deno.test("a mono take at a proper rate is what the trainer wants, and the rest is drift", () => {
  const stereo = Array.from({ length: 55 }, (_, i) => take({ id: `s${i}`, channels: 2 }));
  assertEquals(referenceProblems(set(stereo), opts).some((p) => p.includes("mono take")), true);
  const low = Array.from({ length: 55 }, (_, i) => take({ id: `l${i}`, sample_rate: 22050 }));
  assertEquals(referenceProblems(set(low), opts).some((p) => p.includes("sibilance")), true);
  const long = Array.from({ length: 55 }, (_, i) => take({ id: `g${i}`, seconds: 90 }));
  assertEquals(referenceProblems(set(long), opts).some((p) => p.includes("drift")), true);
});

Deno.test("a spoken reference trains conversion and says what it cannot do", () => {
  const takes = Array.from({ length: 55 }, (_, i) => take({ id: `t${i}` }));
  const plan = trainingPlan(set(takes));
  assertEquals(plan.steps.map((s) => s.vendor), ["rvc"]);
  assertEquals(plan.notes.some((n) => n.includes("cannot invent one")), true);
});

Deno.test("a sung reference trains singing, with the span and the minutes named", () => {
  const takes = Array.from({ length: 60 }, (_, i) =>
    take({ id: `s${i}`, seconds: 30, sung: true, pitch_range: [55, 62] }));
  const plan = trainingPlan(set(takes));
  assertEquals(plan.steps.map((s) => s.vendor), ["diffsinger"]);
  assertEquals(sungSeconds(takes), 1800);
  assertEquals(pitchSpan(takes), 7);
  assertEquals(plan.notes.some((n) => n.includes("septitone") || n.includes("7 semitone")), true);
});

Deno.test("the vowel check reads the transcript, because it runs before a render exists", () => {
  const thin = Array.from({ length: 55 }, (_, i) => take({ id: `t${i}`, text: "the cat sat" }));
  assertEquals(vowelCoverage(thin), ["a", "e"]);
  const problems = referenceProblems(set(thin), opts);
  assertEquals(problems.some((p) => p.includes("stop mumbling")), true);
});

Deno.test("an empty set is refused before anything else is measured", () => {
  assertEquals(referenceProblems(set([]), opts), ["voice-1: no takes, so there is no voice to train"]);
  assertEquals(MIN_TOTAL_SECONDS, 600);
});
