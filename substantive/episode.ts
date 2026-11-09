// a long form episode, written as video.
//
// the difference from a stream republish is the plan: this exists before
// the camera does. a promise, a cold open that earns the promise, chapters
// that each carry a claim and the evidence for it, a turn, and a close.
//
// chapters are not decoration. they are the audience's map, and youtube
// enforces its own rules about them, so the plan computes them and the
// rules are checked before a second of video is rendered.

export interface ChapterPlan {
  title: string;
  // the claim this chapter makes
  claim: string;
  // what proves it: a demo, a number, a source, a build
  evidence: string;
  // how long the chapter is budgeted
  seconds: number;
}

export interface EpisodePlan {
  title: string;
  // the promise, in one line. the cold open must deliver it.
  promise: string;
  coldOpen: string;
  chapters: ChapterPlan[];
  // the turn: what the episode reframes before it closes
  turn: string;
  close: string;
  targetRuntimeSeconds: number;
  // where the material came from. a republish is refused unless the caller
  // says they mean it, because that is a different artifact.
  source?: { kind: "written" | "stream_vod" | "meeting" | "research"; uri?: string };
  allowRepublish?: boolean;
}

export const MIN_CHAPTER_SEC = 10;
export const MIN_CHAPTERS = 3;

export interface PlanCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
  plannedSeconds: number;
}

export function plannedSeconds(plan: EpisodePlan): number {
  return plan.chapters.reduce((total, chapter) => total + chapter.seconds, 0);
}

export function checkPlan(plan: EpisodePlan): PlanCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan.title.trim()) errors.push("title: required");
  if (!plan.promise.trim()) errors.push("promise: a video without one is a recording");
  if (!plan.coldOpen.trim()) errors.push("cold_open: required, it is what the promise is made of");
  if (!plan.close.trim()) errors.push("close: required");
  if (!plan.turn.trim()) warnings.push("turn: no reframe, the video may read as a list");

  if (plan.chapters.length < MIN_CHAPTERS) {
    errors.push(`chapters: ${plan.chapters.length}, and youtube chapters need at least ${MIN_CHAPTERS}`);
  }
  for (const chapter of plan.chapters) {
    if (!chapter.title.trim()) errors.push("chapter: title required");
    if (!chapter.claim.trim()) errors.push(`chapter "${chapter.title}": a claim is required`);
    if (!chapter.evidence.trim()) errors.push(`chapter "${chapter.title}": evidence is required, otherwise it is an assertion`);
    if (chapter.seconds < MIN_CHAPTER_SEC) {
      errors.push(`chapter "${chapter.title}": ${chapter.seconds}s is under the ${MIN_CHAPTER_SEC}s minimum`);
    }
  }

  if (plan.source?.kind === "stream_vod" && !plan.allowRepublish) {
    errors.push(
      "source: this is a stream vod. long form here is written as video; a republish is a different artifact and must be asked for explicitly",
    );
  }

  const total = plannedSeconds(plan);
  if (total > plan.targetRuntimeSeconds * 1.15) {
    errors.push(`runtime: ${Math.round(total)}s planned against a ${plan.targetRuntimeSeconds}s target`);
  }
  if (total < plan.targetRuntimeSeconds * 0.7) {
    warnings.push(`runtime: ${Math.round(total)}s planned, well under the ${plan.targetRuntimeSeconds}s target`);
  }

  return { ok: errors.length === 0, errors, warnings, plannedSeconds: total };
}

export interface ChapterMark {
  title: string;
  startSec: number;
  label: string;
}

export function chapterLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// youtube's rules, as code: the first chapter is at 0:00, there are at
// least three, each is at least ten seconds, and the list only ever moves
// forward. checked on the marks, not on the plan, so a rendered timeline is
// held to the same standard as the plan it came from.
export function checkChapterMarks(marks: ChapterMark[]): string[] {
  const errors: string[] = [];
  if (marks.length < MIN_CHAPTERS) errors.push(`marks: ${marks.length}, at least ${MIN_CHAPTERS} required`);
  if (marks.length && marks[0].startSec !== 0) errors.push("marks: the first chapter must start at 0:00");
  for (let i = 0; i < marks.length; i++) {
    if (i > 0) {
      const gap = marks[i].startSec - marks[i - 1].startSec;
      if (gap <= 0) errors.push(`marks: "${marks[i].title}" does not start after "${marks[i - 1].title}"`);
      else if (gap < MIN_CHAPTER_SEC) {
        errors.push(`marks: "${marks[i - 1].title}" is ${Math.round(gap)}s, under the ${MIN_CHAPTER_SEC}s minimum`);
      }
    }
    if (!marks[i].title.trim()) errors.push("marks: a chapter with no title");
  }
  return errors;
}
