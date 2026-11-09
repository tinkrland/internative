// assembling the episode: plan to timeline to a manifest a renderer follows.
//
// the timeline is where chapter marks come from, and the manifest is the
// contract with whatever renders pixels. keeping both as data means the
// whole structure of a twenty minute video can be reviewed in a diff, which
// is the only way it gets reviewed at all.

import { chapterLabel, checkChapterMarks, type ChapterMark, type EpisodePlan } from "./episode.ts";
import { longTarget, thumbnailSafeArea, type LongTarget } from "./targets.ts";

export type SegmentKind = "cold_open" | "chapter" | "turn" | "close";

export interface TimelineSegment {
  kind: SegmentKind;
  title: string;
  startSec: number;
  endSec: number;
  // what the renderer should show, decided in the plan and carried forward
  shot?: string;
  // the words spoken over it, when the segment is narration
  narration?: string;
}

export interface Timeline {
  segments: TimelineSegment[];
  chapters: ChapterMark[];
  durationSec: number;
}

export function assemble(plan: EpisodePlan): Timeline {
  const segments: TimelineSegment[] = [];
  const chapters: ChapterMark[] = [];
  let clock = 0;

  const push = (kind: SegmentKind, title: string, seconds: number, extra: Partial<TimelineSegment> = {}) => {
    const start = clock;
    segments.push({ kind, title, startSec: Number(start.toFixed(2)), endSec: Number((start + seconds).toFixed(2)), ...extra });
    clock += seconds;
    return start;
  };

  // the cold open is the first chapter: viewers land mid scroll, and a
  // video whose first chapter starts at 0:07 has no chapters at all
  const openSeconds = Math.max(10, Math.round(plan.coldOpen.length / 15));
  push("cold_open", "cold open", openSeconds, { narration: plan.coldOpen, shot: "bust, authored set" });
  chapters.push({ title: "cold open", startSec: 0, label: chapterLabel(0) });

  for (const chapter of plan.chapters) {
    const start = push("chapter", chapter.title, chapter.seconds, { narration: chapter.claim, shot: chapter.evidence });
    chapters.push({ title: chapter.title, startSec: Number(start.toFixed(2)), label: chapterLabel(start) });
  }

  const turnSeconds = Math.max(10, Math.round(plan.turn.length / 15) || 10);
  const turnStart = push("turn", "the turn", turnSeconds, { narration: plan.turn });
  chapters.push({ title: "the turn", startSec: Number(turnStart.toFixed(2)), label: chapterLabel(turnStart) });

  const closeSeconds = Math.max(10, Math.round(plan.close.length / 15) || 10);
  push("close", "close", closeSeconds, { narration: plan.close });

  return {
    segments,
    chapters,
    durationSec: Number(clock.toFixed(2)),
  };
}

export interface RenderManifest {
  target: LongTarget;
  frame: { width: number; height: number };
  // where burned captions live, as a fraction of frame height
  captionBand: { top: number; bottom: number };
  timeline: Timeline;
  thumbnail: { target: LongTarget; safe: { x: number; y: number; width: number; height: number } };
  chapters: ChapterMark[];
  // every gate that passed, so a reviewer can see what was enforced
  checks: { plan: string[]; marks: string[] };
}

export function renderManifest(plan: EpisodePlan, targetKey = "youtube_1080"): RenderManifest {
  const target = longTarget(targetKey);
  const timeline = assemble(plan);
  return {
    target,
    frame: { width: target.width, height: target.height },
    captionBand: { top: 1 - target.safeBottom, bottom: 1 },
    timeline,
    thumbnail: { target: longTarget("thumbnail"), safe: thumbnailSafeArea() },
    chapters: timeline.chapters,
    checks: { plan: [], marks: checkChapterMarks(timeline.chapters) },
  };
}
