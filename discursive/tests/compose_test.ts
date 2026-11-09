import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { altTextFor, composePost, fitsInOnePost, packParts, splitAtWords, splitSentences } from "../compose.ts";
import { graphemeLength } from "../channels.ts";
import { resolveRegister } from "../../persona/registers.ts";
import { loadPersonaFile } from "../../persona/loader.ts";

const EXAMPLE = new URL("../../personas/example.persona.jsonc", import.meta.url).pathname;
const persona = await loadPersonaFile(EXAMPLE);
const xRegister = resolveRegister(persona, "text", "x");

Deno.test("sentences split where sentences end", () => {
  assertEquals(splitSentences("one. two! three?"), ["one.", "two!", "three?"]);
  assertEquals(splitSentences("  "), []);
});

Deno.test("an over long sentence breaks at words, never inside one", () => {
  const pieces = splitAtWords("alpha beta gamma delta epsilon", 12);
  for (const piece of pieces) assertEquals(graphemeLength(piece) <= 12, true, piece);
  assertEquals(pieces.join(" "), "alpha beta gamma delta epsilon");
});

Deno.test("parts each fit and keep sentence order", () => {
  const sentences = ["a".repeat(100), "b".repeat(100), "c".repeat(100)];
  const parts = packParts(sentences, 280);
  assertEquals(parts.length, 2);
  for (const part of parts) assertEquals(graphemeLength(part) <= 280, true);
  assertEquals(parts[0].startsWith("aaa"), true);
});

Deno.test("an idea that fits is one post, not a thread", () => {
  const composed = composePost({ text: "the plate is a real render. that is the point.", channel: "x", register: xRegister });
  assertEquals(composed.isThread, false);
  assertEquals(composed.parts.length, 1);
});

Deno.test("an idea that does not fit becomes a thread, in order", () => {
  const text = Array.from({ length: 12 }, (_, i) => `this is sentence number ${i} and it has some words in it.`).join(" ");
  const composed = composePost({ text, channel: "x", register: xRegister });
  assertEquals(composed.isThread, true);
  for (const part of composed.parts) assertEquals(graphemeLength(part) <= 280, true);
  assertEquals(composed.parts[0].includes("number 0"), true);
  assertEquals(composed.parts.at(-1)!.includes("number 11"), true);
});

Deno.test("a network without threads refuses instead of truncating", () => {
  const text = Array.from({ length: 120 }, (_, i) => `sentence ${i} with a few words attached.`).join(" ");
  assertThrows(
    () => composePost({ text, channel: "instagram", register: resolveRegister(persona, "text", "instagram") }),
    Error,
    "does not carry threads",
  );
});

Deno.test("the emoji policy is enforced by removal, and reported", () => {
  const composed = composePost({ text: "it works 🎬 and it is fast 🚀", channel: "x", register: xRegister });
  assertEquals(composed.parts[0].includes("🎬"), false);
  assertEquals(composed.dropped.emoji, 2);
  assertEquals(composed.warnings.some((w) => w.startsWith("emoji")), true);
});

Deno.test("hashtags follow the policy, not the caller", () => {
  const none = composePost({ text: "one idea, no tags #plates #render", channel: "x", register: xRegister });
  assertEquals(none.parts[0].includes("#"), false);
  assertEquals(none.dropped.hashtags.length, 2);

  const sparing = composePost({
    text: "one idea",
    channel: "x",
    register: { ...xRegister, hashtags: "sparing" },
    tags: ["a", "b", "c", "d"],
  });
  assertEquals((sparing.parts[0].match(/#/g) ?? []).length, 3);
  assertEquals(sparing.dropped.hashtags, ["#d"]);
});

Deno.test("a register that asks for short posts says so when they are not", () => {
  const plain = { ...xRegister, max_sentences: 2 };
  const composed = composePost({ text: "one. two. three. four.", channel: "x", register: plain });
  assertEquals(composed.warnings.some((w) => w.startsWith("length:")), true);
});

Deno.test("instagram warns about a body link instead of pretending it works", () => {
  const composed = composePost({
    text: "the full episode is at https://example.com/ep",
    channel: "instagram",
    register: resolveRegister(persona, "text", "instagram"),
  });
  assertEquals(composed.warnings.some((w) => w.startsWith("links:")), true);
});

Deno.test("fitsInOnePost answers the thread question without composing", () => {
  assertEquals(fitsInOnePost("short", "x"), true);
  assertEquals(fitsInOnePost("x".repeat(300), "x"), false);
});

Deno.test("alt text is required, and cut at a word when it is too long", () => {
  assertThrows(() => altTextFor("   "), Error, "description is required");
  const long = Array.from({ length: 200 }, () => "word").join(" ");
  const alt = altTextFor(long, 100);
  assertEquals(graphemeLength(alt) <= 101, true);
  assertEquals(alt.endsWith("…"), true);
});
