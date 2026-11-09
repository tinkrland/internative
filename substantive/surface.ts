// the longform surface, wired to the head.
//
// long form is where the persona argues rather than reacts, so it borrows
// the register (hooks, structure), the narration voice, and the memory: an
// episode that came out of a stream should be remembered as having come
// from that stream, which is what makes the next episode able to refer to
// the last one.

import { loadPersona } from "../persona/loader.ts";
import { defineSurface, type Surface } from "../core/surface.ts";
import type { PersonaManifest } from "../persona/schema.ts";
import { canPublishTo } from "../core/publishing.ts";
import { checkPlan, plannedSeconds, type EpisodePlan } from "./episode.ts";
import { renderManifest, type RenderManifest } from "./assemble.ts";
import { longTarget } from "./targets.ts";

export function longformSurface(persona: PersonaManifest, platform = "youtube"): Surface {
  return defineSurface("longform", { persona, platform });
}

export interface PreparedEpisode {
  manifest: RenderManifest;
  surface: Surface;
  planSeconds: number;
  publishable: { ok: boolean; reason: string };
  warnings: string[];
}

export function prepareEpisode(
  persona: PersonaManifest,
  plan: EpisodePlan,
  opts: { target?: string; audioUrl?: string } = {},
): PreparedEpisode {
  const check = checkPlan(plan);
  if (!check.ok) {
    throw new Error(`longform: plan refused\n  ${check.errors.join("\n  ")}`);
  }
  const manifest = renderManifest(plan, opts.target ?? "youtube_1080");
  if (manifest.checks.marks.length) {
    throw new Error(`longform: chapter marks refused\n  ${manifest.checks.marks.join("\n  ")}`);
  }
  const surface = longformSurface(persona);
  const decision = surface.publishing();
  const gate = canPublishTo(decision, { token: opts.audioUrl ?? null, approved: false });
  return {
    manifest,
    surface,
    planSeconds: plannedSeconds(plan),
    publishable: { ok: gate.ok, reason: gate.reason },
    warnings: check.warnings,
  };
}

// the two targets an upload needs, so a caller cannot ship a 1080p master
// with a thumbnail sized for a different frame family.
export function uploadPair(): { video: string; thumbnail: string } {
  return { video: longTarget("youtube_1080").key, thumbnail: longTarget("thumbnail").key };
}

// the persona comes from CLAWBUZZ_PERSONA when no id is passed, so a deploy
// never hardcodes whose mouth this is.
export async function currentSurface(platform = "youtube", personaId?: string): Promise<Surface> {
  return longformSurface(await loadPersona(personaId), platform);
}
