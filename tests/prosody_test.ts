import { assertEquals, assert } from "jsr:@std/assert@1";
import { prosodyDistance, prosodyLine, prosodyProblems, speechCues, type Prosody } from "../voice/prosody.ts";

const base = (over: Partial<Prosody> = {}): Prosody => ({
  f0_median: { value: 206, unit: "hz", context: "/a/ sustained", method: "praat 6.4 pitch" },
  f0_span: { value: 7, unit: "st", context: "sentence", method: "praat 6.4" },
  rate: { value: 4.4, unit: "syllables_per_second", context: "interview", method: "syllable count / duration" },
  pause_median: { value: 320, unit: "ms", context: "interview", method: "praat" },
  ...over,
});

Deno.test("a full prosody with units and methods passes", () => {
  assertEquals(prosodyProblems(base()), []);
});

Deno.test("the four dimensions are not optional", () => {
  const p = base({ rate: undefined as unknown as Prosody["rate"] });
  assert(prosodyProblems(p).some((x) => x.includes("rate: missing")));
});

Deno.test("a unit has to be the one this dimension is measured in", () => {
  const p = base({ rate: { value: 4.4, unit: "hz", context: "x", method: "y" } });
  assert(prosodyProblems(p).some((x) => x.includes("unit must be one of syllables_per_second")));
});

Deno.test("a number with no method is refused, because the literature disagrees on units", () => {
  const p = base({ shimmer: { value: 0.22, unit: "db", context: "/a/", method: "" } });
  assert(prosodyProblems(p).some((x) => x.includes("no method")));
});

Deno.test("a number with no context is refused, because f0 on one vowel is not f0 on another", () => {
  const p = base({ f0_median: { value: 206, unit: "hz", context: "", method: "praat" } });
  assert(prosodyProblems(p).some((x) => x.includes("no context")));
});

Deno.test("pitch span in hertz was never converted", () => {
  const p = base({ f0_span: { value: 60, unit: "hz", context: "sentence", method: "praat" } });
  assert(prosodyProblems(p).some((x) => x.includes("convert to semitones")));
});

Deno.test("an f0 median outside speaking range is a transcription error", () => {
  const p = base({ f0_median: { value: 40, unit: "hz", context: "/a/", method: "praat" } });
  assert(prosodyProblems(p).some((x) => x.includes("not a speaking voice")));
});

Deno.test("a listener's conclusion is not a measurement", () => {
  const p = base({ notes: "warm, dry delivery with clipped endings" });
  const problems = prosodyProblems(p);
  assert(problems.some((x) => x.includes("is what a listener concludes")));
});

Deno.test("ToBI tones have a shape", () => {
  const p = base({ boundary_tones: ["L*H-H%"] });
  assertEquals(prosodyProblems(p), []);
  const bad = base({ boundary_tones: ["rising"] });
  assert(prosodyProblems(bad).some((x) => x.includes("ToBI tones look like")));
});

Deno.test("distance only compares what both sides measured", () => {
  const a = base();
  const b = base({ hnr: { value: 18, unit: "db", context: "/a/", method: "praat" } });
  const { distance, compared } = prosodyDistance(a, b);
  assertEquals(distance, 0);
  assert(!compared.includes("hnr"));
});

Deno.test("a wider span and a faster rate move the distance", () => {
  const a = base();
  const b = base({
    f0_span: { value: 11, unit: "st", context: "sentence", method: "praat" },
    rate: { value: 5.4, unit: "syllables_per_second", context: "interview", method: "count" },
  });
  assert(prosodyDistance(a, b).distance > 0.2);
});

Deno.test("cues are a small closed set a tts adapter can actually take", () => {
  const { cues } = speechCues(base());
  assertEquals(cues.pitch_span, "moderate");
  assertEquals(cues.rate, "normal");
  assertEquals(cues.pause, "natural");
  const wide = speechCues(base({ f0_span: { value: 10, unit: "st", context: "x", method: "y" } }));
  assertEquals(wide.cues.pitch_span, "wide");
  assertEquals(wide.cues.emphasis, "marked");
});

Deno.test("unmeasured voice quality is reported rather than assumed", () => {
  const { notes } = speechCues(base());
  assert(notes.some((x) => x.includes("voice quality unmeasured")));
});

Deno.test("the line reads like a measurement, not a mood", () => {
  const line = prosodyLine(base({ hnr: { value: 18, unit: "db", context: "/a/", method: "praat" } }));
  assert(line.includes("206 Hz median"));
  assert(line.includes("span 7 st"));
  assert(line.includes("hnr 18 dB"));
});
