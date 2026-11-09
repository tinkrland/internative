import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../../persona/loader.ts";
import { loadPlaces, loadWardrobe } from "../../tools/libraries.ts";
import { checkCarousel, generateCarousel, MAX_SLIDES, planCarousel, SLIDE_WORD_CEILING, type CarouselRequest } from "../carousel.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");
const libraries = { places: await loadPlaces("example"), wardrobe: await loadWardrobe("example") };

function request(): CarouselRequest {
  return {
    place_id: "bathroom-mirror",
    outfit_id: "desk-day",
    day: "2026-11-07",
    magnification: "medium, one person, the room readable behind her",
    frameTarget: "portrait",
    slides: [
      { claim: "the claim, on slide one", composition: "waist up, eyes to camera", alt: "her, waist up, in the mirror" },
      { claim: "the proof", composition: "close on the phone in her hand", alt: "a phone held up to the mirror" },
      { claim: "the close", composition: "wide, the whole room", alt: "the bathroom, wide, with her at the mirror" },
    ],
  };
}

Deno.test("a carousel is at least two slides and never more than the ceiling", () => {
  const one = { ...request(), slides: request().slides.slice(0, 1) };
  assertEquals(checkCarousel(one).map((p) => p.problem).join(" ").includes("carousel of one"), true);
  const many = { ...request(), slides: Array.from({ length: MAX_SLIDES + 1 }, (_, i) => ({
    claim: `claim ${i}`,
    composition: `composition ${i}`,
    alt: `alt ${i}`,
  })) };
  assertEquals(checkCarousel(many).map((p) => p.problem).join(" ").includes(`over ${MAX_SLIDES}`), true);
});

Deno.test("one idea per slide, an alt for every slide, no repeated framing", () => {
  const words = Array.from({ length: SLIDE_WORD_CEILING + 3 }, () => "word").join(" ");
  const bad = { ...request(), slides: [
    { claim: "fine", composition: "a", alt: "alt a" },
    { claim: words, composition: "a", alt: "" },
  ] };
  const problems = checkCarousel(bad).map((p) => p.problem).join(" | ");
  assertEquals(problems.includes("words"), true, "the ceiling is words");
  assertEquals(problems.includes("alt"), true);
  assertEquals(problems.includes("duplicate composition"), true);
});

Deno.test("every slide is the same room, the same outfit and the same distance", () => {
  const slides = planCarousel(persona, libraries, request());
  assertEquals(slides.length, 3);
  const locations = new Set(slides.map((s) => s.plan.shot.blocks.location));
  const wardrobes = new Set(slides.map((s) => s.plan.shot.outfit.id));
  assertEquals(locations.size, 1);
  assertEquals(wardrobes.size, 1);
  assertEquals(new Set(slides.map((s) => s.plan.seed)).size, 3, "different frames, different seeds");
  assertEquals(slides.every((s) => s.plan.drifted.length === 0), true);
});

Deno.test("a request that breaks the rules never reaches a model", () => {
  assertThrows(
    () => planCarousel(persona, libraries, { ...request(), slides: request().slides.slice(0, 1) }),
    Error,
    "carousel",
  );
});

Deno.test("generation returns one image per slide, with the slide's own alt", async () => {
  const slides = planCarousel(persona, libraries, request());
  const calls: number[] = [];
  const made = await generateCarousel({
    name: "fake-model",
    generate: async (input) => {
      calls.push(input.seed);
      return { uri: `file:///tmp/slide-${input.seed}.png` };
    },
  }, slides);
  assertEquals(made.length, 3);
  assertEquals(calls, slides.map((s) => s.plan.seed));
  assertEquals(made.map((m) => m.alt), request().slides.map((s) => s.alt));
});
