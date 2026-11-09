// the static surface, wired to the head.
//
// a still is generated, so this surface's job is to hold the ask steady: one
// frame, four consistencies, a named room and a named outfit, a seed that
// survives a re-run, and a receipt that says which model made which frame.

import { defineSurface, type Surface } from "../core/surface.ts";
import type { PersonaManifest } from "../persona/schema.ts";
import { generateStill, planStill, type Libraries, type StillPlan, type StillProvider, type StillRequest } from "./still.ts";
import { checkCarousel, generateCarousel, planCarousel, type CarouselRequest, type SlidePlan } from "./carousel.ts";

export function staticSurface(persona: PersonaManifest, platform = "instagram"): Surface {
  return defineSurface("static", { persona, platform });
}

export function prepareStill(persona: PersonaManifest, libraries: Libraries, req: StillRequest): StillPlan {
  return planStill(persona, libraries, req);
}

export function prepareCarousel(persona: PersonaManifest, libraries: Libraries, req: CarouselRequest): SlidePlan[] {
  return planCarousel(persona, libraries, req);
}

export interface StillOutput {
  uri: string;
  seed: number;
  provider: string;
  prompt: string;
}

export async function makeStill(
  persona: PersonaManifest,
  libraries: Libraries,
  req: StillRequest,
  providers: StillProvider[],
): Promise<StillOutput> {
  const plan = planStill(persona, libraries, req);
  const provider = providers[0];
  if (!provider) {
    throw new Error("static: no still provider configured, so the frame stays a plan");
  }
  const receipt = await generateStill(provider, plan);
  return { uri: receipt.uri, seed: receipt.seed, provider: receipt.provider, prompt: receipt.prompt };
}

export { checkCarousel, generateCarousel, planCarousel };
export type { CarouselRequest, Libraries, StillPlan, StillProvider, StillRequest };
