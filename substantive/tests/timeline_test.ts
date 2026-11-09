import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { assemble, renderManifest } from "../assemble.ts";
import { chapterLabel, checkChapterMarks, type EpisodePlan } from "../episode.ts";
import { longTarget, thumbnailSafeArea } from "../targets.ts";

function plan(): EpisodePlan {
  return {
    title: "the plate is the product",
    promise: "a real render survives a second visit",
    coldOpen: "every generated background drifts, and the drift is the tell",
    turn: "the point is repeatability, not realism",
    close: "next month, the light rig",
    targetRuntimeSeconds: 900,
    chapters: [
      { title: "the drift", claim: "generated backgrounds drift", evidence: "two frames", seconds: 240 },
      { title: "the lens", claim: "a pinned camera repeats", evidence: "eight renders", seconds: 300 },
      { title: "the trade", claim: "repeatability costs time", evidence: "render logs", seconds: 240 },
    ],
  };
}

Deno.test("segments are contiguous and the timeline knows its own length", () => {
  const timeline = assemble(plan());
  assertEquals(timeline.segments[0].startSec, 0);
  for (let i = 1; i < timeline.segments.length; i++) {
    assertEquals(timeline.segments[i].startSec, timeline.segments[i - 1].endSec);
  }
  assertEquals(timeline.durationSec, timeline.segments.at(-1)!.endSec);
});

Deno.test("the cold open is the first chapter, at zero", () => {
  const timeline = assemble(plan());
  assertEquals(timeline.chapters[0].startSec, 0);
  assertEquals(timeline.chapters[0].title, "cold open");
  assertEquals(timeline.chapters[0].label, "0:00");
});

Deno.test("the assembled marks satisfy the chapter rules", () => {
  const timeline = assemble(plan());
  assertEquals(checkChapterMarks(timeline.chapters), []);
  assertEquals(timeline.chapters.length, 5); // cold open, three chapters, the turn
});

Deno.test("the chapter rules catch a bad list", () => {
  const bad = [
    { title: "a", startSec: 5, label: "0:05" },
    { title: "b", startSec: 12, label: "0:12" },
    { title: "c", startSec: 30, label: "0:30" },
  ];
  const errors = checkChapterMarks(bad);
  assertEquals(errors.some((e) => e.includes("must start at 0:00")), true);
  assertEquals(errors.some((e) => e.includes("10s minimum")), true);
});

Deno.test("a manifest carries the frame, the caption band and the thumbnail", () => {
  const manifest = renderManifest(plan(), "youtube_4k");
  assertEquals(manifest.frame.width, 3840);
  assertEquals(manifest.frame.height, 2160);
  assertEquals(manifest.captionBand.top, 0.9);
  assertEquals(manifest.thumbnail.target.width, 3840);
  assertEquals(manifest.checks.marks, []);
});

Deno.test("the thumbnail keeps its badge corner clear", () => {
  const target = longTarget("thumbnail");
  const safe = thumbnailSafeArea(target);
  assertEquals(safe.width, target.width - Math.round(target.width * 0.12));
  assertEquals(safe.height, target.height - Math.round(target.height * 0.05));
});

Deno.test("an unknown target refuses rather than guessing a frame", () => {
  assertThrows(() => longTarget("imax"), Error, "unknown long form target");
});

Deno.test("chapter labels read like timestamps", () => {
  assertEquals(chapterLabel(0), "0:00");
  assertEquals(chapterLabel(65), "1:05");
  assertEquals(chapterLabel(3725), "1:02:05");
});
