// the clip job: everything a renderer needs, decided once, without
// rendering anything.
//
// the same shape as the composite plans the other surfaces consume: frame,
// placement already clamped into the safe zone, the timing, the captions,
// the cover. a renderer that understands the composite plan can render
// this; a test can assert on it without ffmpeg, and that is the point.

import type { Placement } from "./frame.ts";
import { captureTarget, placementInSafeZone, target, type SocialTarget } from "./sizes.ts";
import { clipSpec, type ClipSpec } from "./clip_specs.ts";
import { LINE_PAUSE_SEC, plannedSeconds, WORDS_PER_SECOND, type ClipPlan } from "./clip.ts";
import { onFrameCues, type CaptionCue } from "./caption.ts";

export interface ClipJob {
  platform: string;
  // the ratio, with its ui bands
  target: SocialTarget;
  frame: { width: number; height: number };
  // whether the safe zone had to move the authored framing
  safe: boolean;
  placement: Placement;
  // the usable band the person and the text must live inside
  usable: { top: number; bottom: number };
  durationSeconds: number;
  captions: CaptionCue[];
  cover: { target: string; width: number; height: number };
  spec: { verified: boolean; confirm?: string; maxDurationSec: number };
  audio: { kind: "voice"; wordsPerSecond: number; linePauseSec: number };
  source?: ClipPlan["source"];
}

export function buildClipJob(
  plan: ClipPlan,
  platform: string,
  placement: Placement,
  opts: { maxOnFrameChars?: number } = {},
): ClipJob {
  const spec: ClipSpec = clipSpec(platform);
  const capture = captureTarget(spec.target, placement);
  const clamped = placementInSafeZone(placement, capture.rendered);
  const cover = target(spec.coverTarget);
  const cues = onFrameCues(plan, {
    maxChars: opts.maxOnFrameChars,
    wordsPerSecond: WORDS_PER_SECOND,
    linePauseSec: LINE_PAUSE_SEC,
  });
  const spoken = plannedSeconds(plan);

  return {
    platform: spec.platform,
    target: capture.rendered,
    frame: { width: capture.rendered.width, height: capture.rendered.height },
    safe: capture.safe,
    placement: clamped,
    usable: {
      top: capture.rendered.safeTop,
      bottom: 1 - capture.rendered.safeBottom,
    },
    durationSeconds: Math.max(plan.durationSeconds, spoken),
    captions: cues,
    cover: { target: cover.key, width: cover.width, height: cover.height },
    spec: { verified: spec.verified, confirm: spec.confirm, maxDurationSec: spec.maxDurationSec },
    audio: { kind: "voice", wordsPerSecond: WORDS_PER_SECOND, linePauseSec: LINE_PAUSE_SEC },
    source: plan.source,
  };
}

// a job is renderable only when the plan passed its own checks and the
// framing actually fits between the bands. the second condition is
// arithmetic, not taste: a person taller than the usable band is clipped,
// and clipping the persona is never the render we want.
export function jobReady(job: ClipJob): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const usableHeight = job.usable.bottom - job.usable.top;
  if (job.placement.fitHeight > usableHeight) {
    reasons.push(`placement: ${job.placement.fitHeight} does not fit the ${usableHeight} usable band`);
  }
  if (job.placement.anchorY < job.usable.top) {
    reasons.push("placement: the top of the person is under the ui band");
  }
  if (job.placement.anchorY + job.placement.fitHeight > job.usable.bottom + 0.0001) {
    reasons.push("placement: the person runs under the bottom band");
  }
  const last = job.captions.at(-1);
  if (last && last.endSec > job.durationSeconds + 0.5) {
    reasons.push("captions: the last cue ends after the clip does");
  }
  if (!job.spec.verified && job.platform) {
    reasons.push(`spec: ${job.spec.confirm ?? "limits are not verified"}`);
  }
  return { ready: reasons.length === 0, reasons };
}
