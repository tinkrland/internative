import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../persona/loader.ts";
import { loadPlaces, loadWardrobe } from "../tools/libraries.ts";
import { planShot, SHOOT_LOCKED, shotDrift } from "../persona/shot.ts";
import { characterBlock } from "../persona/consistency.ts";
import { ADAPTERS, checkReferences, planGeneration, referencesForShot } from "../generation/adapters.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");
const wardrobe = await loadWardrobe("example");
const places = await loadPlaces("example");
const libs = { wardrobe, places };

const base = {
  place_id: "bathroom-mirror",
  outfit_id: "plain-tee",
  composition: "mirror selfie, phone held at chest height, shoulders square to the glass",
  magnification: "medium, waist up, mirror fills the frame",
};

Deno.test("a shot prompt carries the four axes and the wardrobe", () => {
  const shot = planShot(persona, libs, base);
  const lines = shot.prompt.split("\n");
  assertEquals(lines.length, 5);
  assertEquals(lines[0].startsWith("character: "), true);
  assertEquals(lines[1].startsWith("location: "), true);
  assertEquals(lines[3].startsWith("magnification: "), true);
  assertEquals(lines[4].startsWith("wardrobe: "), true);
  // identity is the head's, never improvised per shot
  assertEquals(shot.blocks.character, characterBlock(persona));
});

Deno.test("the room is the room: same place gives the same location block", () => {
  const a = planShot(persona, libs, base);
  const b = planShot(persona, libs, { ...base, composition: "slightly wider, phone lower" });
  assertEquals(a.blocks.location, b.blocks.location);
  assertEquals(shotDrift(a, b), ["composition"]);
});

Deno.test("a new day is a new outfit, and the drift says so by name", () => {
  const monday = planShot(persona, libs, { ...base, day: "2026-11-09" });
  const other = planShot(persona, libs, { ...base, outfit_id: "cold-out" });
  assertEquals(monday.blocks.character, other.blocks.character);
  assertEquals(shotDrift(monday, other), ["wardrobe"]);
  assertEquals(monday.seed === other.seed, false, "a different outfit is a different image");
});

Deno.test("the same setup is the same image twice", () => {
  const a = planShot(persona, libs, base);
  const b = planShot(persona, libs, base);
  assertEquals(a.seed, b.seed);
  assertEquals(shotDrift(a, b), []);
});

Deno.test("a shoot locks character, location and wardrobe, not the framing", () => {
  assertEquals(SHOOT_LOCKED.includes("character"), true);
  assertEquals(SHOOT_LOCKED.includes("location"), true);
  assertEquals(SHOOT_LOCKED.includes("wardrobe"), true);
  assertEquals(SHOOT_LOCKED.includes("composition"), false);
});

Deno.test("a place that was never authored is refused, not improvised", () => {
  assertThrows(() => planShot(persona, libs, { ...base, place_id: "some-cafe" }), Error, "no place");
});

Deno.test("generation combines the parts: her, then the room", () => {
  const shot = planShot(persona, libs, base);
  const refs = referencesForShot(shot, { characterImage: "assets/character/front.png" });
  assertEquals(refs.map((r) => r.role), ["character", "place_wide", "place_mirror", "place_detail"]);
});

Deno.test("an adapter that cannot take the parts says so before it runs", () => {
  const shot = planShot(persona, libs, base);
  const refs = referencesForShot(shot, { characterImage: "assets/character/front.png" });
  const problems = checkReferences(
    { id: "tiny", name: "too small", kind: "reference-to-video", licence: "x", accepts: ["character"], max_references: 1, reference_field: "reference_images", evidence: "assumed", source_kind: "catalog", provider: "test", prompt_tags: false, constraints: [], notes: "", verified: false },
    refs,
  );
  assertEquals(problems.some((p) => p.includes("does not take a place_wide")), true);
  assertEquals(problems.some((p) => p.includes("ceiling is 1")), true);
});

Deno.test("image to video without a keyframe is refused", () => {
  const shot = planShot(persona, libs, base);
  assertThrows(() => planGeneration(shot, "first-frame-image-to-video", { characterImage: "assets/character/front.png" }), Error, "keyframe");
});

Deno.test("more references than the endpoint takes is caught by count, before the call", () => {
  const kling = ADAPTERS.find((a) => a.id === "kling-reference-to-video")!;
  const refs = [
    { role: "character" as const, uri: "assets/character/front.png" },
    ...Array.from({ length: 5 }, (_, i) => ({ role: "place_wide" as const, uri: `assets/places/p${i}.png` })),
  ];
  const problems = checkReferences(kling, refs);
  assertEquals(problems.some((p) => p.includes("ceiling is 4")), true);
});

Deno.test("a reference adapter refuses a keyframe it does not accept, rather than dropping it", () => {
  const shot = planShot(persona, libs, base);
  assertThrows(
    () => planGeneration(shot, "wan-reference-to-video", {
      characterImage: "assets/character/front.png",
      keyframe: "assets/shots/mirror/keyframe.png",
    }),
    Error,
    "does not take a keyframe",
  );
});

Deno.test("a full plan fits the adapter and carries the axis prompt unchanged", () => {
  const shot = planShot(persona, libs, { ...base, place_id: "car-interior" });
  const plan = planGeneration(shot, "seedance-2.5-reference", {
    characterImage: "assets/character/front.png",
    keyframe: "assets/shots/car/keyframe.png",
  });
  assertEquals(plan.references.map((r) => r.role), ["character", "place_wide", "place_detail", "keyframe"]);
  assertEquals(plan.prompt, shot.prompt);
  assertEquals(plan.seed, shot.seed);
});
