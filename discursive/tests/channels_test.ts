import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { CHANNELS, channelSpec, foldPreview, graphemeLength, graphemes } from "../channels.ts";

Deno.test("length is counted in graphemes, the way a reader counts", () => {
  // a joined family emoji is seven code points and one character
  assertEquals("👨‍👩‍👧‍👦".length, 11);
  assertEquals(graphemeLength("👨‍👩‍👧‍👦"), 1);
  assertEquals(graphemeLength("e\u0301"), 1); // e + combining acute
  assertEquals(graphemes("ab👨‍👩‍👧‍👦c").length, 4);
  assertEquals(graphemeLength("plain ascii"), 11);
});

Deno.test("the six networks each carry a usable ceiling", () => {
  const expected: Record<string, number> = {
    x: 280,
    bluesky: 300,
    threads: 500,
    instagram: 2200,
    linkedin: 3000,
    discord: 2000,
  };
  for (const [channel, ceiling] of Object.entries(expected)) {
    assertEquals(CHANNELS[channel as keyof typeof CHANNELS].maxGraphemes, ceiling);
  }
});

Deno.test("confidence is attached, not implied", () => {
  for (const spec of Object.values(CHANNELS)) {
    assertEquals(typeof spec.verified, "boolean");
    if (!spec.verified) assertEquals(typeof spec.confirm, "string", spec.channel);
  }
  assertEquals(CHANNELS.bluesky.verified, true);
  assertEquals(CHANNELS.threads.verified, false);
  assertEquals(CHANNELS.linkedin.verified, false);
});

Deno.test("unknown networks refuse rather than guess a limit", () => {
  assertThrows(() => channelSpec("myspace"), Error, "unknown text channel");
});

Deno.test("instagram says what it does about links", () => {
  assertEquals(CHANNELS.instagram.linksInBody, false);
  assertEquals(CHANNELS.x.linksInBody, true);
});

Deno.test("the fold preview is the first lines only", () => {
  assertEquals(foldPreview("first\nsecond\nthird"), "first\nsecond");
});
