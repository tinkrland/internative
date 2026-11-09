import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  chaptersFor,
  checkEpisode,
  episodeSeconds,
  SEGMENT_PAUSE_SEC,
  segmentSeconds,
  spokenSeconds,
  timestamp,
  WORDS_PER_SECOND,
  type EpisodePlan,
} from "../episode.ts";

function plan(): EpisodePlan {
  return {
    title: "the plate is the product",
    promise: "why a real render beats a generated background",
    targetSeconds: 600,
    segments: [
      { kind: "cold_open", title: "cold open", lines: ["generated backgrounds drift, and nobody notices until they do"] },
      { kind: "intro", title: "intro", lines: ["this is the show about showing the work"] },
      { kind: "beat", title: "the argument", lines: ["a prompt cannot hold a room the same way twice"] },
      { kind: "beat", title: "the proof", lines: ["the lens is pinned, so the frame is repeatable"] },
      { kind: "beat", title: "the cost", lines: ["it is slower, and that is the trade"] },
      { kind: "close", title: "close", lines: ["next week, the light"] },
    ],
  };
}

Deno.test("speech is arithmetic, at the persona's unhurried pace", () => {
  assertEquals(spokenSeconds("one two three"), Number((3 / WORDS_PER_SECOND).toFixed(2)));
  assertEquals(spokenSeconds(""), 0);
});

Deno.test("a planned episode passes its own check", () => {
  const check = checkEpisode(plan());
  assertEquals(check.ok, true, check.errors.join("; "));
  assertEquals(check.plannedSeconds > 0, true);
});

Deno.test("the runtime is the sum of the segments plus the beats between them", () => {
  const p = plan();
  const speech = p.segments.reduce((t, s) => t + segmentSeconds(s), 0);
  const expected = speech + SEGMENT_PAUSE_SEC * (p.segments.length - 1);
  assertEquals(Math.abs(episodeSeconds(p) - expected) < 0.05, true);
});

Deno.test("fewer than three beats is not an episode", () => {
  const p = plan();
  p.segments = p.segments.filter((s) => s.kind !== "beat");
  p.segments.push({ kind: "beat", title: "only one", lines: ["a single thought"] });
  const check = checkEpisode(p);
  assertEquals(check.ok, false);
  assertEquals(check.errors.some((e) => e.startsWith("beats")), true);
});

Deno.test("an episode with no close is refused", () => {
  const p = plan();
  p.segments = p.segments.filter((s) => s.kind !== "close");
  assertEquals(checkEpisode(p).errors.some((e) => e.startsWith("close")), true);
});

Deno.test("a script that overruns its target is refused, not trimmed", () => {
  const p = plan();
  p.targetSeconds = 5;
  const check = checkEpisode(p);
  assertEquals(check.ok, false);
  assertEquals(check.errors.some((e) => e.startsWith("runtime")), true);
});

Deno.test("a segment too long to listen to in one go is refused", () => {
  const p = plan();
  p.segments[2].lines = [Array.from({ length: 2000 }, () => "word").join(" ")];
  p.targetSeconds = 100000;
  const check = checkEpisode(p, { maxSegmentMinutes: 2 });
  assertEquals(check.errors.some((e) => e.startsWith("segment")), true);
});

Deno.test("chapters start at zero and never move backwards", () => {
  const chapters = chaptersFor(plan());
  assertEquals(chapters[0].startSec, 0);
  assertEquals(chapters[0].startLabel, "0:00");
  for (let i = 1; i < chapters.length; i++) {
    assertEquals(chapters[i].startSec > chapters[i - 1].startSec, true);
  }
});

Deno.test("timestamps read the way a person reads them", () => {
  assertEquals(timestamp(0), "0:00");
  assertEquals(timestamp(65), "1:05");
  assertEquals(timestamp(3725), "1:02:05");
});

Deno.test("validation catches bad numbering", () => {
  const p = { ...plan(), episode: 0 };
  assertThrows(() => {
    const check = checkEpisode(p);
    if (!check.ok) throw new Error(check.errors.join("; "));
  }, Error, "episode");
});
