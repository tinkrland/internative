import { assertEquals } from "jsr:@std/assert@1";
import { captionFor, chunkText, ON_FRAME_MAX_CHARS, onFrameCues } from "../caption.ts";
import { clipSpec } from "../clip_specs.ts";
import { LINE_PAUSE_SEC, planClip, WORDS_PER_SECOND } from "../clip.ts";
import { resolveRegister } from "../../persona/registers.ts";
import { loadPersonaFile } from "../../persona/loader.ts";

const EXAMPLE = new URL("../../personas/example.persona.jsonc", import.meta.url).pathname;
const persona = await loadPersonaFile(EXAMPLE);
const register = resolveRegister(persona, "shortform", "tiktok");
const spec = clipSpec("tiktok");

const PLAN = planClip({
  idea: "one idea",
  lines: [
    "your background is a lie",
    "this one is geometry",
    "that is why it never drifts",
  ],
});

Deno.test("text breaks at words, never inside them", () => {
  const chunks = chunkText("the quick brown fox jumps over the lazy dog", 12);
  for (const chunk of chunks) assertEquals(chunk.length <= 12, true);
  assertEquals(chunks.join(" "), "the quick brown fox jumps over the lazy dog");
  assertEquals(chunkText("short", 40).length, 1);
});

Deno.test("the persona's hashtag policy wins over the caller", () => {
  // the example persona says hashtags: none on shortform
  const caption = captionFor(PLAN, register, spec, { tags: ["plates", "geometry"] });
  assertEquals(caption.hashtags.length, 0);
  assertEquals(caption.droppedHashtags.length, 2);
  assertEquals(caption.text.includes("#"), false);
});

Deno.test("a sparing policy keeps three and drops the rest", () => {
  const sparing = { ...register, hashtags: "sparing" as const };
  const caption = captionFor(PLAN, sparing, spec, { tags: ["a", "b", "c", "d"] });
  assertEquals(caption.hashtags.length, 3);
  assertEquals(caption.droppedHashtags, ["#d"]);
});

Deno.test("the network ceiling is never exceeded", () => {
  const tight = clipSpec("tiktok");
  const shortRegister = { ...register, max_chars: 60 };
  const caption = captionFor(PLAN, shortRegister, { ...tight, captionMaxChars: 50 });
  assertEquals(caption.chars <= 50, true);
  assertEquals(caption.withinCeiling, true);
  assertEquals(caption.truncated, true);
});

Deno.test("the description leads with the hook, not the setup", () => {
  const caption = captionFor(PLAN, register, spec);
  assertEquals(caption.text.startsWith(PLAN.hook), true);
  assertEquals(caption.text.includes(PLAN.payoff), true);
});

Deno.test("a source line is optional and survives the ceiling", () => {
  const withSource = captionFor(
    { ...PLAN, source: { uri: "https://example.com/v/1", kind: "stream" } },
    register,
    spec,
    { includeSource: true },
  );
  assertEquals(withSource.text.includes("source: https://example.com/v/1"), true);
});

Deno.test("on frame cues are chunked, ordered, and end with the clip", () => {
  const cues = onFrameCues(PLAN, { wordsPerSecond: WORDS_PER_SECOND, linePauseSec: LINE_PAUSE_SEC });
  assertEquals(cues.length >= 3, true);
  for (const cue of cues) {
    assertEquals(cue.text.length <= ON_FRAME_MAX_CHARS, true, cue.text);
    assertEquals(cue.endSec >= cue.startSec, true);
  }
  for (let i = 1; i < cues.length; i++) {
    assertEquals(cues[i].startSec >= cues[i - 1].startSec, true);
  }
  const text = cues.map((c) => c.text).join(" ");
  assertEquals(text.includes("geometry"), true);
});
