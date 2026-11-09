import { assertEquals } from "jsr:@std/assert@1";
import { timedLines, transcriptText, transcriptVtt } from "../transcript.ts";
import type { EpisodePlan } from "../episode.ts";

const PLAN: EpisodePlan = {
  title: "the plate is the product",
  promise: "why a real render beats a generated background",
  targetSeconds: 300,
  segments: [
    { kind: "cold_open", title: "cold open", lines: ["generated backgrounds drift"] },
    { kind: "beat", title: "the argument", lines: ["a prompt cannot hold a room", "the lens can"] },
    { kind: "beat", title: "the proof", lines: ["same camera, same light"] },
    { kind: "beat", title: "the cost", lines: ["slower, on purpose"] },
    { kind: "close", title: "close", lines: ["next week, the light"] },
  ],
};

Deno.test("lines are timed in order and never overlap", () => {
  const lines = timedLines(PLAN);
  assertEquals(lines.length, 6);
  for (let i = 1; i < lines.length; i++) {
    assertEquals(lines[i].startSec >= lines[i - 1].endSec, true);
  }
});

Deno.test("the transcript carries the promise, the chapters and timestamps", () => {
  const text = transcriptText(PLAN);
  assertEquals(text.startsWith(PLAN.title), true);
  assertEquals(text.includes(PLAN.promise), true);
  assertEquals(text.includes("## the argument"), true);
  assertEquals(text.includes("[0:00] generated backgrounds drift"), true);
});

Deno.test("the vtt is a well formed header plus cues", () => {
  const vtt = transcriptVtt(PLAN);
  assertEquals(vtt.startsWith("WEBVTT\n\n"), true);
  assertEquals(vtt.includes("-->"), true);
  const cues = vtt.trim().split("\n\n").slice(1);
  assertEquals(cues.length, 6);
  for (const cue of cues) {
    assertEquals(/^\d+\n\d\d:\d\d:\d\d\.\d\d\d --> \d\d:\d\d:\d\d\.\d\d\d\n/.test(cue), true, cue);
  }
});

Deno.test("a long cue gets a ceiling instead of owning the timeline", () => {
  const long: EpisodePlan = {
    ...PLAN,
    segments: [
      { kind: "cold_open", title: "open", lines: [Array.from({ length: 200 }, () => "word").join(" ")] },
      { kind: "beat", title: "b1", lines: ["short"] },
      { kind: "beat", title: "b2", lines: ["short"] },
      { kind: "beat", title: "b3", lines: ["short"] },
      { kind: "close", title: "close", lines: ["short"] },
    ],
  };
  const vtt = transcriptVtt(long, { maxCueSeconds: 8 });
  const firstCue = vtt.trim().split("\n\n")[1];
  const [, start, end] = firstCue.match(/(\d\d:\d\d:\d\d\.\d\d\d) --> (\d\d:\d\d:\d\d\.\d\d\d)/) ?? [];
  const toSec = (s: string) => {
    const [h, m, rest] = s.split(":");
    return Number(h) * 3600 + Number(m) * 60 + Number(rest);
  };
  assertEquals(toSec(end) - toSec(start) <= 8.001, true);
});
