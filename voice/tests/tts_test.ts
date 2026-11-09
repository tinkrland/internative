// the voice backend lives beside the look, because they are the same problem:
// what the internative sounds and looks like is a provider seam, not a branch.

import { assertEquals } from "jsr:@std/assert@1";
import { fakeTts, getTts, registerTts, ttsAdapters } from "../tts.ts";

Deno.test("a voice adapter registers by name and is found by it", () => {
  registerTts(fakeTts());
  assertEquals(ttsAdapters().includes("fake"), true);
  assertEquals(getTts("fake") !== null, true);
  assertEquals(getTts("nobody"), null);
});
