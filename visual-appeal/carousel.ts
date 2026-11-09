// a carousel is a series with an argument: the cover makes the claim, the
// middle proves it, the close stops.
//
// every slide shares one location and one magnification, because a carousel
// that jumps rooms reads as five unrelated posts. only the composition moves,
// which is what makes the sequence feel like one shoot instead of a folder.

import type { PersonaManifest } from "../persona/schema.ts";
import { frameFor, textBand, type Frame } from "./frames.ts";
import { generateStill, planStill, type Libraries, type StillPlan, type StillProvider } from "./still.ts";

export const SLIDE_WORD_CEILING = 18;
export const MAX_SLIDES = 10;

export interface Slide {
  claim: string;
  evidence?: string;
  composition: string;
  alt: string;
}

export interface CarouselRequest {
  // one room, one outfit, one magnification for the whole sequence: only the
  // composition moves between slides
  place_id: string;
  outfit_id?: string;
  day?: string;
  magnification: string;
  frameTarget: string;
  slides: Slide[];
}

export interface Problem {
  where: string;
  problem: string;
}

export function checkCarousel(req: CarouselRequest): Problem[] {
  const problems: Problem[] = [];
  if (req.slides.length < 2) problems.push({ where: "slides", problem: "a carousel of one is a post" });
  if (req.slides.length > MAX_SLIDES) problems.push({ where: "slides", problem: `over ${MAX_SLIDES} slides: the tail is never read` });

  req.slides.forEach((slide, i) => {
    const words = `${slide.claim} ${slide.evidence ?? ""}`.trim().split(/\s+/).filter(Boolean);
    if (!slide.claim.trim()) problems.push({ where: `slide ${i + 1}`, problem: "no claim: a slide with nothing to say costs a swipe" });
    if (words.length > SLIDE_WORD_CEILING) {
      problems.push({ where: `slide ${i + 1}`, problem: `${words.length} words, ceiling is ${SLIDE_WORD_CEILING}` });
    }
    if (!slide.alt.trim()) problems.push({ where: `slide ${i + 1}`, problem: "no alt text: half the audience gets nothing" });
    if (!slide.composition.trim()) problems.push({ where: `slide ${i + 1}`, problem: "no composition: the model will centre it and every slide will look alike" });
  });

  const compositions = req.slides.map((s) => s.composition.trim().toLowerCase());
  if (new Set(compositions).size !== compositions.length) {
    problems.push({ where: "slides", problem: "duplicate composition: two slides framed the same read as one" });
  }
  return problems;
}

export interface SlidePlan {
  index: number;
  claim: string;
  alt: string;
  plan: StillPlan;
}

export function planCarousel(persona: PersonaManifest, libraries: Libraries, req: CarouselRequest): SlidePlan[] {
  const problems = checkCarousel(req);
  if (problems.length) {
    throw new Error(`carousel: ${problems.map((p) => `${p.where}: ${p.problem}`).join("; ")}`);
  }
  let reference: StillPlan | null = null;
  return req.slides.map((slide, index) => {
    const plan = planStill(persona, libraries, {
      place_id: req.place_id,
      outfit_id: req.outfit_id,
      day: req.day,
      composition: slide.composition,
      magnification: req.magnification,
      frameTarget: req.frameTarget,
      reference: reference ?? undefined,
    });
    reference = reference ?? plan;
    return { index, claim: slide.claim, alt: slide.alt, plan };
  });
}

export async function generateCarousel(
  provider: StillProvider,
  slides: SlidePlan[],
): Promise<{ uri: string; seed: number; alt: string }[]> {
  const out: { uri: string; seed: number; alt: string }[] = [];
  for (const slide of slides) {
    if (slide.plan.drifted.length) {
      throw new Error(`carousel: slide ${slide.index + 1} drifts in ${slide.plan.drifted.join(", ")}`);
    }
    const made = await generateStill(provider, slide.plan);
    out.push({ uri: made.uri, seed: made.seed, alt: slide.alt });
  }
  return out;
}
