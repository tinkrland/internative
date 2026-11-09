import { assertEquals, assertStringIncludes, assertThrows } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../../persona/loader.ts";
import { currentSurface, prepareCarousel, prepareStill, staticSurface } from "../stills/surface.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");

Deno.test("the surface speaks with the persona's static register", () => {
  const surface = staticSurface(persona, "instagram");
  assertEquals(surface.branch, "static");
  assertStringIncludes(surface.brief(), "surface: static (caption)");
  assertStringIncludes(surface.brief(), surface.register().register);
});

Deno.test("a prepared still carries a plate job and a closed gate", () => {
  const prepared = prepareStill(persona, { target: "portrait", withCaptionBand: true });
  assertEquals(prepared.job.frame.width, 1080);
  assertEquals(prepared.job.plate.schema, "proskena-scene-state");
  assertEquals(prepared.publishable.ok, false);
});

Deno.test("a pinterest frame routes the surface to pinterest", () => {
  const prepared = prepareStill(persona, { target: "pin" });
  assertEquals(prepared.surface.platform, "pinterest");
});

Deno.test("a carousel goes through the same gate as a still", () => {
  const prepared = prepareCarousel(persona, {
    target: "portrait",
    cover: "one frame carries the idea",
    slides: [
      { claim: "one idea per slide", alt: "a single line of text on a plate" },
      { claim: "the source goes last", alt: "a short source line at the foot of a plate" },
    ],
  });
  assertEquals(prepared.carousel.slides.length, 2);
  assertEquals(prepared.publishable.ok, false);
});

Deno.test("a refused carousel never reaches a gate", () => {
  assertThrows(
    () => prepareCarousel(persona, { target: "portrait", cover: "", slides: [] }),
    Error,
    "carousel refused",
  );
});

Deno.test("the surface loads by persona id", async () => {
  const surface = await currentSurface("instagram", "example");
  assertEquals(surface.name, "static");
});
