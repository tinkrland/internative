import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { buildCarousel, carouselSpec, checkCarousel, SLIDE_WORD_CEILING, type CarouselPlan } from "../stills/carousel.ts";
import { loadPersonaFile } from "../../persona/loader.ts";
import { resolveRegister } from "../../persona/registers.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");
const register = resolveRegister(persona, "static", "instagram");

function plan(): CarouselPlan {
  return {
    target: "portrait",
    cover: "the plate is the product",
    slides: [
      { claim: "a generated background drifts by the second visit", evidence: "two frames, one prompt", alt: "two nearly identical rooms with a shifted shadow" },
      { claim: "a pinned camera repeats the frame exactly", evidence: "eight renders, one lens", alt: "eight frames of the same room from the same lens" },
      { claim: "repeatability is a budget, not a prompt", evidence: "render logs", alt: "a column of render times" },
    ],
  };
}

Deno.test("a carousel with one idea per slide builds", () => {
  const carousel = buildCarousel(plan(), register, "instagram");
  assertEquals(carousel.slides.length, 3);
  assertEquals(carousel.slides[0].index, 0);
  assertEquals(carousel.slides[0].target.key, "portrait");
  assertEquals(carousel.platform.chromeBottom, 0.08);
});

Deno.test("padding is refused: a word ceiling per slide", () => {
  const padded = plan();
  padded.slides[0].claim = Array.from({ length: SLIDE_WORD_CEILING + 2 }, (_, i) => `word${i}`).join(" ");
  const check = checkCarousel(padded, register, carouselSpec("instagram"));
  assertEquals(check.ok, false);
  assertEquals(check.errors.some((e) => e.includes("one idea is")), true);
});

Deno.test("alt text is not optional", () => {
  const bad = plan();
  bad.slides[1].alt = "";
  assertThrows(() => buildCarousel(bad, register, "instagram"), Error, "alt text is required");
});

Deno.test("a close with a call to action is refused by this register", () => {
  const bad = { ...plan(), close: "follow for part two" };
  assertEquals(checkCarousel(bad, register, carouselSpec("instagram")).errors.some((e) => e.startsWith("close:")), true);
});

Deno.test("emoji policy is enforced on slide text", () => {
  const bad = plan();
  bad.slides[0].claim = "a generated background drifts 🔍";
  assertEquals(checkCarousel(bad, register, carouselSpec("instagram")).errors.some((e) => e.startsWith("emoji:")), true);
});

Deno.test("a single slide is not a carousel", () => {
  const bad = plan();
  bad.slides = bad.slides.slice(0, 1);
  assertEquals(checkCarousel(bad, register, carouselSpec("instagram")).errors.some((e) => e.startsWith("slides:")), true);
});

Deno.test("the platform ceiling is enforced, not assumed", () => {
  const spec = carouselSpec("instagram");
  const tooMany = plan();
  tooMany.slides = Array.from({ length: spec.maxSlides + 1 }, () => ({
    claim: "one idea",
    alt: "a described frame",
  }));
  assertEquals(checkCarousel(tooMany, register, spec).errors.some((e) => e.includes("ceiling")), true);
});

Deno.test("unverified platform facts say so", () => {
  assertEquals(carouselSpec("instagram").verified, false);
  assertEquals(typeof carouselSpec("linkedin").confirm, "string");
  assertThrows(() => carouselSpec("myspace"), Error, "unknown carousel platform");
});
