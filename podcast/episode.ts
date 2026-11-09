// an episode, planned before it is spoken.
//
// the podcast surface has one advantage over the others: audio is the only
// medium where the listener gives you their full attention, so structure is
// the product. an episode is a promise at the cold open, three to five
// beats that keep it, and a close that does not beg.
//
// the plan is arithmetic: every segment carries the words it will say, and
// the runtime is the sum of those words at the persona's speaking pace.
// chapters come out of the plan, not out of a guess after the render, which
// is why the chapter rules can be enforced before a single second is
// recorded.

export const WORDS_PER_SECOND = 2.4; // unhurried, conversational: slower than a clip
export const SEGMENT_PAUSE_SEC = 0.8; // the beat between segments

export type SegmentKind = "cold_open" | "intro" | "beat" | "close";

export interface Segment {
  kind: SegmentKind;
  title: string;
  lines: string[];
}

export interface EpisodePlan {
  title: string;
  // what the episode promises, in one line. it becomes the description and
  // the cold open must actually deliver it.
  promise: string;
  segments: Segment[];
  // the runtime the plan was written against
  targetSeconds: number;
  publishedAt?: string;
  season?: number;
  episode?: number;
}

export function spokenSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words ? Number((words / WORDS_PER_SECOND).toFixed(2)) : 0;
}

export function segmentSeconds(segment: Segment): number {
  return Number(segment.lines.reduce((total, line) => total + spokenSeconds(line), 0).toFixed(2));
}

export function episodeSeconds(plan: EpisodePlan): number {
  const speech = plan.segments.reduce((total, segment) => total + segmentSeconds(segment), 0);
  const pauses = SEGMENT_PAUSE_SEC * Math.max(0, plan.segments.filter((s) => s.lines.length).length - 1);
  return Number((speech + pauses).toFixed(2));
}

export interface EpisodeCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
  plannedSeconds: number;
}

export function checkEpisode(plan: EpisodePlan, opts: { maxSegmentMinutes?: number } = {}): EpisodeCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan.title.trim()) errors.push("title: required");
  if (!plan.promise.trim()) errors.push("promise: an episode without one is a conversation with no reason to listen");
  if (!plan.segments.some((s) => s.kind === "cold_open")) {
    warnings.push("cold_open: no cold open, the episode starts explaining itself");
  }
  const beats = plan.segments.filter((s) => s.kind === "beat");
  if (beats.length < 3) errors.push(`beats: ${beats.length}, and an episode needs at least three`);
  if (beats.length > 5) warnings.push(`beats: ${beats.length} is a lot for one episode`);
  if (!plan.segments.some((s) => s.kind === "close")) errors.push("close: an episode needs an end, not a fade");

  const empty = plan.segments.filter((s) => s.lines.filter((l) => l.trim()).length === 0);
  if (empty.length) errors.push(`segments: ${empty.length} segment(s) have no lines`);

  const planned = episodeSeconds(plan);
  if (planned > plan.targetSeconds + 15) {
    errors.push(`runtime: the script runs ${Math.round(planned)}s against a ${plan.targetSeconds}s target`);
  }
  if (plan.targetSeconds - planned > 60) {
    warnings.push(`runtime: ${Math.round(plan.targetSeconds - planned)}s short of the target, the episode may feel thin`);
  }
  const maxSegment = (opts.maxSegmentMinutes ?? 12) * 60;
  for (const segment of plan.segments) {
    const seconds = segmentSeconds(segment);
    if (seconds > maxSegment) {
      errors.push(`segment: "${segment.title}" runs ${Math.round(seconds)}s, over the ${opts.maxSegmentMinutes ?? 12} minute ceiling`);
    }
  }
  if (plan.episode !== undefined && (!Number.isInteger(plan.episode) || plan.episode < 1)) {
    errors.push("episode: must be a positive integer");
  }
  if (plan.season !== undefined && (!Number.isInteger(plan.season) || plan.season < 1)) {
    errors.push("season: must be a positive integer");
  }

  return { ok: errors.length === 0, errors, warnings, plannedSeconds: planned };
}

export interface Chapter {
  title: string;
  startSec: number;
  startLabel: string;
}

export function timestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// chapters straight from the plan: one per segment, starting at zero, in
// order. nothing is invented and nothing is merged, so a chapter that does
// not exist in the plan cannot appear in the file.
export function chaptersFor(plan: EpisodePlan): Chapter[] {
  const chapters: Chapter[] = [];
  let clock = 0;
  for (const segment of plan.segments) {
    if (!segment.lines.filter((l) => l.trim()).length) continue;
    chapters.push({ title: segment.title, startSec: Number(clock.toFixed(2)), startLabel: timestamp(clock) });
    clock += segmentSeconds(segment) + SEGMENT_PAUSE_SEC;
  }
  return chapters;
}
