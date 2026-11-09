// a carousel is a still sequence with an argument: the cover makes the
// claim, the middle proves it, the close stops.
//
// the failure mode of a carousel is padding. nine slides that each say a
// little are worse than three that say something, so the rules here are
// about subtraction: one idea per slide, a word ceiling, an alt text that
// actually describes the frame, and no call to action the persona would not
// make.

import type { RegisterSpec } from "../../persona/schema.ts";
import { target, type SocialTarget } from "../stage/sizes.ts";

export interface SlidePlan {
  // the one idea this slide carries
  claim: string;
  // what proves it, when the claim needs proving
  evidence?: string;
  // the description a screen reader gets. required, because a carousel that
  // is only legible to sighted people is a broken carousel
  alt: string;
}

export interface CarouselPlan {
  // the cover line: the whole carousel in one sentence
  cover: string;
  slides: SlidePlan[];
  close?: string;
  target: string;
}

export interface CarouselSpec {
  platform: "instagram" | "linkedin";
  maxSlides: number;
  sizeTarget: string;
  // where the platform's own chrome sits, carried so text never lands under
  // the dot indicator or the "swipe" affordance
  chromeBottom: number;
  verified: boolean;
  confirm?: string;
}

export const CAROUSEL_SPECS: Record<string, CarouselSpec> = {
  instagram: {
    platform: "instagram",
    maxSlides: 20,
    sizeTarget: "portrait",
    chromeBottom: 0.08,
    verified: false,
    confirm: "the slide ceiling has moved before; check it in the composer before scheduling",
  },
  linkedin: {
    platform: "linkedin",
    maxSlides: 20,
    sizeTarget: "portrait",
    chromeBottom: 0.05,
    verified: false,
    confirm: "document posts and native carousels differ; confirm which surface this is going to",
  },
};

export const SLIDE_WORD_CEILING = 18;
export const MIN_SLIDES = 2;

export function carouselSpec(platform: string): CarouselSpec {
  const spec = CAROUSEL_SPECS[platform];
  if (!spec) throw new Error(`unknown carousel platform: ${platform} (known: ${Object.keys(CAROUSEL_SPECS).join(", ")})`);
  return spec;
}

export function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export interface CarouselCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function checkCarousel(plan: CarouselPlan, register: RegisterSpec, spec: CarouselSpec): CarouselCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan.cover.trim()) errors.push("cover: required, it is the whole argument in one line");
  if (plan.slides.length < MIN_SLIDES) errors.push(`slides: ${plan.slides.length}, a carousel is at least ${MIN_SLIDES}`);
  if (plan.slides.length > spec.maxSlides) errors.push(`slides: ${plan.slides.length} is over the ${spec.platform} ceiling of ${spec.maxSlides}`);

  for (const [i, slide] of plan.slides.entries()) {
    if (!slide.claim.trim()) errors.push(`slide ${i + 1}: a claim is required`);
    if (!slide.alt.trim()) errors.push(`slide ${i + 1}: alt text is required`);
    if (words(slide.claim) > SLIDE_WORD_CEILING) {
      errors.push(`slide ${i + 1}: ${words(slide.claim)} words, one idea is ${SLIDE_WORD_CEILING} or fewer`);
    }
    if (words(slide.alt) < 3) warnings.push(`slide ${i + 1}: alt text is thin, describe the frame`);
  }

  if (plan.close && register.cta === false) {
    errors.push("close: this persona's static register carries no call to action");
  }
  if (register.emoji === "none") {
    const all = [plan.cover, plan.close ?? "", ...plan.slides.map((s) => `${s.claim} ${s.evidence ?? ""}`)].join(" ");
    if (/\p{Extended_Pictographic}/u.test(all)) errors.push("emoji: this register carries none");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export interface CarouselSlide {
  index: number;
  claim: string;
  evidence?: string;
  alt: string;
  // the frame this slide is authored at
  target: SocialTarget;
  // the band the dot indicator and swipe affordance own
  chromeBottom: number;
}

export interface Carousel {
  platform: CarouselSpec;
  slides: CarouselSlide[];
  cover: string;
  close?: string;
}

export function buildCarousel(plan: CarouselPlan, register: RegisterSpec, platform = "instagram"): Carousel {
  const spec = carouselSpec(platform);
  const check = checkCarousel(plan, register, spec);
  if (!check.ok) {
    throw new Error(`carousel refused\n  ${check.errors.join("\n  ")}`);
  }
  const social = target(spec.sizeTarget);
  return {
    platform: spec,
    cover: plan.cover,
    close: plan.close,
    slides: plan.slides.map((slide, index) => ({
      index,
      claim: slide.claim,
      evidence: slide.evidence,
      alt: slide.alt,
      target: social,
      chromeBottom: spec.chromeBottom,
    })),
  };
}
