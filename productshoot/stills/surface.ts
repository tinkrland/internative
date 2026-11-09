// the static surface, wired to the head.
//
// a still is the cheapest thing a personality can post and the easiest to
// get wrong: one frame carries the whole idea, so the frame has to be
// authored rather than generated, and the words have to be few.

import { loadPersona } from "../../persona/loader.ts";
import { defineSurface, type Surface } from "../../core/surface.ts";
import { canPublishTo } from "../../core/publishing.ts";
import type { PersonaManifest } from "../../persona/schema.ts";
import { stillJob, type StillJob, type StillRequest } from "./still.ts";
import { buildCarousel, type Carousel, type CarouselPlan } from "./carousel.ts";

export function staticSurface(persona: PersonaManifest, platform = "instagram"): Surface {
  return defineSurface("static", { persona, platform });
}

export interface PreparedStill {
  job: StillJob;
  surface: Surface;
  publishable: { ok: boolean; reason: string };
}

export function prepareStill(persona: PersonaManifest, request: StillRequest): PreparedStill {
  const surface = staticSurface(persona, request.target === "pin" ? "pinterest" : "instagram");
  const job = stillJob(request);
  const gate = canPublishTo(surface.publishing(), { token: null, approved: false });
  return { job, surface, publishable: { ok: gate.ok, reason: gate.reason } };
}

export interface PreparedCarousel {
  carousel: Carousel;
  surface: Surface;
  publishable: { ok: boolean; reason: string };
}

export function prepareCarousel(
  persona: PersonaManifest,
  plan: CarouselPlan,
  platform = "instagram",
): PreparedCarousel {
  const surface = staticSurface(persona, platform);
  const carousel = buildCarousel(plan, surface.register(), platform);
  const gate = canPublishTo(surface.publishing(), { token: null, approved: false });
  return { carousel, surface, publishable: { ok: gate.ok, reason: gate.reason } };
}

export async function currentSurface(platform = "instagram", personaId?: string): Promise<Surface> {
  return staticSurface(await loadPersona(personaId), platform);
}
