import { assertEquals, assertRejects, assert } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../persona/loader.ts";
import { lockOutfit, type GarmentItem } from "../wardrobe/module.ts";
import { lockAccessory, type Accessory } from "../wardrobe/accessory.ts";
import { lockJewelry, type JewelryPiece } from "../wardrobe/jewelry.ts";
import { lockWorn, type WornItem } from "../wardrobe/worn.ts";
import { lockHair, type Hairstyle } from "../wardrobe/hair.ts";
import { identityDrift, identityProblems, lookProblems, planLook, seriesLookProblems } from "../wardrobe/look.ts";
import { lockPlace, type Place } from "../environment/module.ts";
import { planDressedShot } from "../scene.ts";

const plates = (id: string) => [
  { id: `${id}-flat`, uri: `assets/wardrobe/${id}-flat.jpg`, role: "flat" as const },
  { id: `${id}-worn`, uri: `assets/wardrobe/${id}-worn.jpg`, role: "worn" as const },
];

const shirt = (over: Partial<GarmentItem> = {}): GarmentItem => ({
  id: "linen-shirt", name: "the linen shirt", slot: "base", kind: "shirt", fabric: "washed linen",
  colour: { name: "chalk", hex: "#f2efe8" }, fit: "loose, sleeves pushed up",
  details: ["mother of pearl buttons", "single chest pocket", "soft collar"],
  avoid: ["stiff collar", "slim fit", "prints"], season: "any", source: "authored", plates: plates("shirt"), ...over,
});

const coat = (over: Partial<GarmentItem> = {}): GarmentItem => ({
  id: "oatmeal-coat", name: "the oatmeal coat", slot: "outer", kind: "wool overcoat", fabric: "heavy brushed wool",
  colour: { name: "oatmeal", hex: "#c8b89a" }, fit: "relaxed, below the knee",
  details: ["double breasted", "horn buttons", "patch pockets"],
  avoid: ["belted waist", "synthetic sheen", "logos"], season: "cold", source: "authored", plates: plates("coat"), ...over,
});

const phone = (over: Partial<Accessory> = {}): Accessory => ({
  id: "her-phone", name: "her phone", carries: "phone",
  device: { make: "apple", model: "iphone 13", colour: "graphite", size: "6.1 inch" },
  worn: "right hip, under the coat",
  dressings: [
    { id: "walnut-case", slot: "case", name: "walnut brown leather" },
    { id: "clear-case", slot: "case", name: "clear polycarbonate" },
  ],
  avoid: ["stickers", "pop sockets"], plates: plates("phone"), ...over,
});

const band = (over: Partial<JewelryPiece> = {}): JewelryPiece => ({
  id: "wedding-band", name: "the band", piece: "plain court band, 2mm",
  site: "hands", slot: "ring", side: "left",
  material: "18k yellow gold", style: ["minimal"], worn: "left ring finger",
  persistence: "fixed", avoid: ["stones", "engraving"], plates: plates("band"), ...over,
});

const hoops = (over: Partial<JewelryPiece> = {}): JewelryPiece => ({
  id: "huggie-hoops", name: "the hoops", piece: "huggie hoops, 8mm",
  site: "ears/piercings", slot: "lobe", side: "both",
  material: "sterling silver", style: ["minimal"], worn: "both earlobes",
  persistence: "styling", avoid: ["pearls"], plates: plates("hoops"), ...over,
});

const beanie = (over: Partial<WornItem> = {}): WornItem => ({
  id: "the-beanie", name: "black ribbed beanie", kind: "beanie", site: "hair", slot: "beanie",
  material: "merino wool", style: ["minimal", "matte"], colour: { name: "black", hex: "#101010" },
  worn: "pulled to the brow", persistence: "styling", avoid: ["pom pom"], plates: plates("beanie"), ...over,
});

const bob = (over: Partial<Hairstyle> = {}): Hairstyle => ({
  id: "the-bob", name: "the bob", hair: "chin length blunt bob, heavy fringe", parting: "centre",
  texture: "fine, straight, no body", finish: "air dried, no product", updo: "low twisted knot, same fringe",
  avoid: ["layers", "curls"], plates: plates("hair"), ...over,
});

const world = async (over: { dressed?: Record<string, string>; up?: boolean } = {}) => ({
  outfit: await lockOutfit("tuesday-outfit", [shirt(), coat()]),
  accessories: [await lockAccessory(phone())],
  jewelry: [await lockJewelry(band()), await lockJewelry(hoops())],
  hair: await lockHair(bob()),
  ...over,
});

Deno.test("a look is outfit, devices, jewelry and hair in one block, in that order", async () => {
  const parts = await world({ dressed: { "her-phone": "walnut-case" } });
  const look = await planLook("tuesday-look", parts);
  assertEquals(lookProblems(look), []);
  assertEquals(await identityProblems(look), []);
  const order = look.value.lines.map((line) => line.part);
  assertEquals(order, ["outfit", "accessory", "jewelry", "jewelry", "hair"]);
  assert(look.block.includes("device: apple iphone 13, graphite, 6.1 inch"));
  assert(look.block.includes("case: walnut brown leather"));
  assert(look.block.includes("up-do") === false, "hair is down unless the shot says up");
});

Deno.test("changing the case changes the look and not the identity", async () => {
  const base = await planLook("tuesday-look", await world({ dressed: { "her-phone": "walnut-case" } }));
  const reCase = await planLook("thursday-look", await world({ dressed: { "her-phone": "clear-case" } }), 2);
  assert(base.digest !== reCase.digest, "a different case is a different picture");
  assertEquals(base.identity_digest, reCase.identity_digest, "and the same person holding it");
  assertEquals(seriesLookProblems([base, reCase]), []);
});

Deno.test("wearing her hair up is styling: the look moves, the identity does not", async () => {
  const down = await planLook("tuesday-look", await world());
  const up = await planLook("tuesday-look", await world({ up: true }), 2);
  assert(down.digest !== up.digest);
  assertEquals(down.identity_digest, up.identity_digest);
  assertEquals(seriesLookProblems([down, up]), []);
});

Deno.test("a new phone in a series is refused by identity, and the message names it", async () => {
  const monday = await planLook("monday-look", await world());
  const thursday = await planLook("thursday-look", {
    ...(await world()),
    accessories: [await lockAccessory(phone({ device: { make: "apple", model: "iphone 15", colour: "graphite", size: "6.1 inch" } }), 2)],
  }, 2);
  const problems = seriesLookProblems([monday, thursday]);
  assertEquals(problems.length, 1);
  assert(problems[0].includes("device her-phone: changed"));
  assert(problems[0].includes("may not replace her"));
});

Deno.test("a coat change is styling: the same series passes", async () => {
  const a = await planLook("monday-look", await world());
  const b = await planLook("tuesday-look", {
    ...(await world()),
    outfit: await lockOutfit("tuesday-outfit", [shirt(), coat({ colour: { name: "camel", hex: "#b08d57" } })], 2),
  }, 2);
  assertEquals(seriesLookProblems([a, b]), []);
  assert(a.identity_digest === b.identity_digest);
});

Deno.test("losing the band between frames is caught, because a fixed piece is not clothing", async () => {
  const before = await planLook("monday-look", await world());
  const after = await planLook("thursday-look", {
    ...(await world()),
    jewelry: [await lockJewelry(hoops())],
  }, 2);
  const moved = identityDrift(before.value.identity, after.value.identity);
  assert(moved.some((entry) => entry.includes("fixed jewelry wedding-band: gone")));
  assert(seriesLookProblems([before, after]).length === 1);
});

Deno.test("a haircut is caught as identity, not as styling", async () => {
  const before = await planLook("monday-look", await world());
  const after = await planLook("thursday-look", {
    ...(await world()),
    hair: await lockHair(bob({ hair: "collarbone length, curtain fringe", restyle: { on: "2026-11-02", why: "growing it out" } }), 2),
  }, 2);
  const moved = identityDrift(before.value.identity, after.value.identity);
  assertEquals(moved, ["hair the-bob: changed"]);
});

Deno.test("an edited look is refused, and the identity digest is recomputed rather than trusted", async () => {
  const look = await planLook("tuesday-look", await world());
  const tampered = { ...look, block: look.block.replace("oatmeal", "cream") };
  assert(lookProblems(tampered).some((p) => p.includes("does not match the value")));
  const lied = { ...look, identity_digest: "0".repeat(64) };
  assertEquals(await identityProblems(lied), [
    "tuesday-look: the identity digest does not match the identity parts, so somebody has been editing",
  ]);
});

Deno.test("a dressing she does not own fails the look, not the render", async () => {
  const parts = await world({ dressed: { "her-phone": "silicone-sleeve" } });
  await assertRejects(() => planLook("tuesday-look", parts), Error, "not a dressing she owns");
});

Deno.test("site items are in the block, in body order, and fixed ones join the identity", async () => {
  const parts = { ...(await world()), worn: [await lockWorn(beanie({ persistence: "fixed" }))] };
  const look = await planLook("winter-look", parts);
  assertEquals(lookProblems(look), []);
  const order = look.value.lines.map((line) => line.part);
  assertEquals(order, ["outfit", "accessory", "jewelry", "jewelry", "worn", "hair"]);
  assert(look.block.includes("beanie: black ribbed beanie"));
  assertEquals(look.value.identity.fixed_worn.length, 1, "a beanie she wears every winter is identity");
});

Deno.test("two beanies are refused whichever module proposed the second one", async () => {
  const parts = {
    ...(await world()),
    worn: [await lockWorn(beanie()), await lockWorn(beanie({ id: "the-other-beanie", name: "grey ribbed beanie" }))],
  };
  await assertRejects(() => planLook("winter-look", parts), Error, "2 things on the beanie");
});

Deno.test("a lobster earring and an earbud share an ear and not a place", async () => {
  const parts = {
    ...(await world()),
    accessories: [
      await lockAccessory({
        id: "her-earbuds", name: "her earbuds", carries: "audio",
        device: { make: "apple", model: "airpods pro 2", colour: "white" }, worn: "both ears, seated",
        site: "ears/hearing", slot: "earbud", side: "both" as const,
        dressings: [], avoid: ["silicone tips showing"], plates: plates("earbuds"),
      }),
    ],
  };
  const look = await planLook("commute-look", parts);
  assertEquals(lookProblems(look), []);
  assert(look.block.includes("device: apple airpods pro 2"));
  assert(look.block.includes("piece: huggie hoops, 8mm"));
});

Deno.test("an earbud on a wrist is refused, because a device knows where it sits", async () => {
  const earbuds = {
    id: "her-earbuds", name: "her earbuds", carries: "audio" as const,
    device: { make: "apple", model: "airpods pro 2", colour: "white" }, worn: "seated",
    site: "wrists", slot: "earbud", side: "both" as const,
    dressings: [], avoid: ["tips"], plates: plates("earbuds"),
  };
  await assertRejects(() => lockAccessory(earbuds), Error, "does not sit on wrists/earbud");
});

Deno.test("a dressed shot puts the whole look on the wardrobe axis", async () => {
  const persona = await loadPersonaFile("personas/example.persona.jsonc");
  const place = await lockPlace({
    id: "kitchen-flat", name: "the kitchen", kind: "kitchen",
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
    props: ["copper kettle"], avoid: ["open plan", "stainless everywhere"], recurring: true,
  } as Place);
  const look = await planLook("tuesday-look", await world({ dressed: { "her-phone": "walnut-case" } }));
  const shot = await planDressedShot(persona, look, place, {
    composition: "medium shot from the doorway, her weight on one hip",
    magnification: "waist up, hands out of frame",
  });
  assertEquals(shot.axes.wardrobe, look.block);
  assert(shot.prompt.includes("wedding-band") === false, "the block is what ships, not the ids");
  assert(shot.prompt.includes("material: 18k yellow gold"));
  assert(shot.prompt.startsWith("character:"));
});
