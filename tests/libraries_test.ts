import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../persona/loader.ts";
import { loadPlaces, loadWardrobe } from "../tools/libraries.ts";
import { outfitForDay, parseWardrobe, wardrobeProblems } from "../persona/wardrobe.ts";
import { placeBlock, placeReferencePlates, placesProblems } from "../persona/places.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");
const wardrobe = await loadWardrobe("example");
const places = await loadPlaces("example");

Deno.test("the example wardrobe and places are valid against their own rules", () => {
  assertEquals(wardrobeProblems(wardrobe), []);
  assertEquals(placesProblems(places), []);
  assertEquals(wardrobe.persona, persona.id);
  assertEquals(places.persona, persona.id);
});

Deno.test("the same day wears the same outfit, and the next day does not", () => {
  const monday = outfitForDay(wardrobe, "2026-11-09");
  assertEquals(outfitForDay(wardrobe, "2026-11-09").id, monday.id);
  const days = ["2026-11-09", "2026-11-10", "2026-11-11"].map((d) => outfitForDay(wardrobe, d).id);
  assertEquals(new Set(days).size, 3, "three days rotate through three outfits");
});

Deno.test("a day that is not a day is refused", () => {
  assertThrows(() => outfitForDay(wardrobe, "november"), Error, "YYYY-MM-DD");
});

Deno.test("an outfit without a palette is not an outfit", () => {
  const broken = structuredClone(wardrobe);
  broken.outfits[0].palette = [];
  assertEquals(wardrobeProblems(broken).some((p) => p.includes("palette")), true);
});

Deno.test("an outfit cannot be invented on the day", () => {
  assertThrows(() => parseWardrobe('{"persona":"x","outfits":[]}'), Error, "at least one");
});

Deno.test("a recurring place needs a wide plate and at least two", () => {
  const broken = structuredClone(places);
  broken.places[1].plates = [{ id: "dash", uri: "assets/x.png", role: "detail" }];
  const problems = placesProblems(broken);
  assertEquals(problems.some((p) => p.includes("wide plate")), true);
  assertEquals(problems.some((p) => p.includes("at least two")), true);
});

Deno.test("the location block carries the fixtures, not the mood", () => {
  const block = placeBlock(places.places[0]);
  assertEquals(block.includes("mirror is a plain rectangle"), true);
  assertEquals(block.includes("light:"), true);
});

Deno.test("plates are offered wide first", () => {
  const plates = placeReferencePlates(places.places[0]);
  assertEquals(plates[0].role, "wide");
});
