// the shortform surface, wired to the head.
//
// this is the whole of what this branch borrows from the persona: the
// brief (so the writer sounds like the persona and not like a template),
// the register (length, emoji, hashtags, hooks per network), and memory
// (so a clip made from a stream can be remembered as made from that
// stream).
//
// nothing here restates identity. if this file ever grows a sentence about
// who the persona is, that sentence belongs on main instead.

import { loadPersona } from "../persona/loader.ts";
import { defineSurface, type Surface } from "../core/surface.ts";
import type { PersonaManifest } from "../persona/schema.ts";
import { canPublishTo } from "../core/publishing.ts";
import { clipSpec, specReadyToPublish, type ClipPlatform } from "./clip_specs.ts";
import { buildClipJob, jobReady, type ClipJob } from "./plan.ts";
import type { CaptionCue } from "./caption.ts";
import type { ClipPlan } from "./clip.ts";

export function shortformSurface(
  persona: PersonaManifest,
  platform: ClipPlatform = "tiktok",
): Surface {
  return defineSurface("shortform", { persona, platform });
}

// the full path a clip takes, with every gate named: plan, job, readiness,
// then the publishing permission. a caller cannot get from a plan to a
// send without passing each one, because the send is not on this branch.
export interface ClipReady {
  job: ClipJob;
  surface: Surface;
  publishable: { ok: boolean; reason: string };
}

export function prepareClip(
  persona: PersonaManifest,
  plan: ClipPlan,
  opts: { platform?: ClipPlatform; placement: { fitHeight: number; anchorY: number; anchorX?: number } },
): ClipReady {
  const platform = opts.platform ?? "tiktok";
  const surface = shortformSurface(persona, platform);
  const job = buildClipJob(plan, platform, opts.placement);
  const ready = jobReady(job);
  const specGate = specReadyToPublish(platform);
  const decision = surface.publishing();
  const gate = canPublishTo(decision, { token: null });

  const reasons = [...ready.reasons, ...(specGate.ready ? [] : [specGate.reason]), gate.reason];
  return {
    job,
    surface,
    publishable: { ok: reasons.length === 0, reason: reasons.join("; ") },
  };
}

// the cue list a renderer burns in, exposed separately because a renderer
// wants the captions and not the whole job.
export function captionsFor(job: ClipJob): CaptionCue[] {
  return job.captions;
}

// the persona this process is running as, for a branch entry point.
export async function currentSurface(platform: ClipPlatform = "tiktok"): Promise<Surface> {
  return shortformSurface(await loadPersona(), platform);
}

export { clipSpec };
