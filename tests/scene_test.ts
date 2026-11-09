import { assertEquals, assertRejects, assert } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../persona/loader.ts";
import { characterBlock, consistencySeed, CONSISTENCY_AXES } from "../persona/consistency.ts";
import { lockOutfit, type GarmentItem } from "../wardrobe/module.ts";
import { lockPlace, type Place } from "../environment/module.ts";
import { consistencyView, headSeed, planShot, seriesProblems, SHOT_AXES, shotDrift, type Framing } from "../scene.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");

const plates = (id: string) => [
  { id: `${id}-flat`, uri: `assets/wardrobe/${id}-flat.jpg`, role: "flat" as const },
  { id: `${id}-worn`, uri: `assets/wardrobe/${id}-worn.jpg`, role: "worn" as const },
];

const shirt = (over: Partial<GarmentItem> = {}): GarmentItem => ({
  id: "linen-shirt",
  name: "the linen shirt",
  slot: "base",
  kind: "shirt",
  fabric: "washed linen",
  colour: { name: "chalk", hex: "#f2efe8" },
  fit: "loose, sleeves pushed up",
  details: ["mother of pearl buttons", "single chest pocket", "soft collar"],
  avoid: ["stiff collar", "slim fit", "prints"],
  season: "any",
  source: "authored",
  plates: plates("shirt"),
  ...over,
});

const coat = (over: Partial<GarmentItem> = {}): GarmentItem => ({
  id: "oatmeal-coat",
  name: "the oatmeal coat",
  slot: "outer",
  kind: "wool overcoat",
  fabric: "heavy brushed wool",
  colour: { name: "oatmeal", hex: "#c8b89a" },
  fit: "relaxed, below the knee",
  details: ["double breasted", "horn buttons", "patch pockets"],
  avoid: ["belted waist", "synthetic sheen", "logos"],
  season: "cold",
  source: "authored",
  plates: plates("coat"),
  ...over,
});

const kitchen = (over: Partial<Place> = {}): Place => ({
  id: "kitchen-flat",
  name: "the kitchen",
  kind: "kitchen",
  invariants: [
    "the window is on the left wall, above the sink",
    "the counter runs the length of that wall and stops at the fridge",
    "one loose tile two rows above the drainer",
  ],
  surfaces: [
    { surface: "wall", material: "painted plaster", hex: "#efe9df" },
    { surface: "counter", material: "pale oak", hex: "#d8c4a4" },
  ],
  light: { direction: "left", quality: "soft daylight, no fill", time: "mid-morning" },
  plates: [{ id: "kitchen-wide", uri: "assets/places/kitchen-wide.jpg", role: "wide", ours: true }],
  props: ["copper kettle", "two mugs on the drainer"],
  avoid: ["open plan", "stainless everywhere"],
  recurring: true,
  ...over,
});

const framing = (over: Partial<Framing> = {}): Framing => ({
  composition: "medium shot from the doorway, her weight on one hip",
  magnification: "waist up, hands out of frame",
  ...over,
});

const world = async () => ({
  outfit: await lockOutfit("tuesday-outfit", [shirt(), coat()]),
  place: await lockPlace(kitchen()),
});

Deno.test("a shot carries the head's character line plus the wardrobe and the room", async () => {
  const { outfit, place } = await world();
  const shot = await planShot(persona, outfit, place, framing());
  assertEquals(Object.keys(shot.axes), [...SHOT_AXES]);
  assertEquals(shot.axes.character, characterBlock(persona));
  assertEquals(shot.axes.wardrobe, outfit.block);
  assertEquals(shot.axes.location, place.block);
  // the lock text is what reaches the model, byte for byte
  assert(shot.prompt.includes(outfit.block));
  assert(shot.prompt.includes(place.block));
  assert(shot.prompt.startsWith("character:"));
});

Deno.test("the same world and the same framing give the same seed; a different coat does not", async () => {
  const { outfit, place } = await world();
  const one = await planShot(persona, outfit, place, framing());
  const two = await planShot(persona, outfit, place, framing());
  assertEquals(one.seed, two.seed);
  const other = await lockOutfit("tuesday-outfit", [shirt(), coat({ fabric: "boiled wool" })], 2);
  const three = await planShot(persona, other, place, framing());
  assert(three.seed !== one.seed);
});

Deno.test("a different framing is a deliberate new seed, not a silent one", async () => {
  const { outfit, place } = await world();
  const a = await planShot(persona, outfit, place, framing());
  const b = await planShot(persona, outfit, place, framing({ composition: "wide from the hall, the door frame in shot" }));
  assert(a.seed !== b.seed);
});

Deno.test("framing may not restate the outfit: that is how a coat drifts", async () => {
  const { outfit, place } = await world();
  await assertRejects(
    () => planShot(persona, outfit, place, framing({ composition: "medium shot, her wool overcoat centred" })),
    Error,
    "repeats the world",
  );
});

Deno.test("framing may not restate the room either", async () => {
  const { outfit, place } = await world();
  await assertRejects(
    () => planShot(persona, outfit, place, framing({ magnification: "tight on her hands in the kitchen" })),
    Error,
    "repeats the world",
  );
});

Deno.test("an empty framing line is a default, so it is refused", async () => {
  const { outfit, place } = await world();
  await assertRejects(
    () => planShot(persona, outfit, place, framing({ magnification: "  " })),
    Error,
    "magnification: empty",
  );
});

Deno.test("the head's four axes survive intact, with the room in the location slot", async () => {
  const { outfit, place } = await world();
  const shot = await planShot(persona, outfit, place, framing());
  const view = consistencyView(shot);
  assertEquals(Object.keys(view), [...CONSISTENCY_AXES]);
  assertEquals(view.location, place.block);
  assertEquals(view.character, characterBlock(persona));
  // the wardrobe is its own axis here, so the character line is not polluted by it
  assert(!view.character.includes("oatmeal"));
  // and the head's seed function over the head's axes is reproducible from the shot
  assertEquals(headSeed(shot), consistencySeed(view));
});

Deno.test("the structure source rides on the shot, taken from the place's wide plate", async () => {
  const { outfit, place } = await world();
  const shot = await planShot(persona, outfit, place, framing());
  assertEquals(shot.structure.plate, "kitchen-wide");
  assertEquals(shot.structure.place, "kitchen-flat");
});

Deno.test("a series may vary the framing and may not vary the clothes or the room", async () => {
  const { outfit, place } = await world();
  const a = await planShot(persona, outfit, place, framing());
  const b = await planShot(persona, outfit, place, framing({ composition: "low angle from the table" , magnification: "three quarter, hands in frame" }));
  assertEquals(seriesProblems([a, b]), []);
  const other = await lockOutfit("tuesday-outfit", [shirt({ colour: { name: "grey", hex: "#9a9a96" } })], 2);
  const c = await planShot(persona, other, place, framing());
  const problems = seriesProblems([a, c]);
  assert(problems.some((p) => p.includes("a different wardrobe")));
});

Deno.test("shot drift names the axis, which is what an auditor actually needs", async () => {
  const { outfit, place } = await world();
  const a = await planShot(persona, outfit, place, framing());
  const b = await planShot(persona, outfit, place, framing({ composition: "wide from the hall" }));
  assertEquals(shotDrift(a, b), ["composition"]);
});
