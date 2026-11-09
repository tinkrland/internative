import { assertEquals, assertRejects, assert } from "jsr:@std/assert@1";
import { lockWorn, wornBlock, wornLockProblems, wornProblems, wornSeriesProblems, type WornItem } from "../wardrobe/worn.ts";
import { materialProblems, styleBlock, styleProblems } from "../wardrobe/style.ts";

const plates = (id: string) => [{ id: `${id}-flat`, uri: `assets/wardrobe/${id}-flat.jpg`, role: "flat" as const }];

const beanie = (over: Partial<WornItem> = {}): WornItem => ({
  id: "the-beanie",
  name: "black ribbed beanie",
  kind: "beanie",
  site: "hair",
  slot: "beanie",
  material: "merino wool",
  style: ["minimal", "matte"],
  colour: { name: "black", hex: "#101010" },
  worn: "pulled to the brow, ears covered",
  persistence: "fixed",
  avoid: ["pom pom", "logos", "slouch"],
  plates: plates("beanie"),
  ...over,
});

const bandana = (over: Partial<WornItem> = {}): WornItem => ({
  id: "the-bandana",
  name: "cotton bandana",
  kind: "bandana",
  site: "hair",
  slot: "bandana",
  material: "cotton",
  style: ["rustic"],
  worn: "folded to a two inch band, tied at the back",
  persistence: "styling",
  avoid: ["paisley print", "silk"],
  plates: plates("bandana"),
  ...over,
});

const tote = (over: Partial<WornItem> = {}): WornItem => ({
  id: "the-tote",
  name: "bridle leather tote",
  kind: "tote",
  site: "bags",
  slot: "tote",
  material: "bridle leather",
  style: ["minimal"],
  worn: "crook of the elbow",
  persistence: "styling",
  avoid: ["logos", "canvas lining"],
  make: "heritage",
  model: "32cm",
  plates: plates("tote"),
  ...over,
});

Deno.test("a site item is its slot, its substance and how it is made", async () => {
  const lock = await lockWorn(beanie());
  assertEquals(wornLockProblems(lock), []);
  assertEquals(lock.block.split("\n")[0], "beanie: black ribbed beanie, black, beanie");
  assert(lock.block.includes("style: minimal, matte"));
});

Deno.test("the beanie line reads badly on purpose when the name repeats the slot, so say so", () => {
  const problems = wornProblems(beanie({ name: "" }));
  assert(problems.some((p) => p.includes("only repeats the slot")));
});

Deno.test("a bandana does not go on the waist, and the refusal lists what the waist holds", () => {
  const problems = wornProblems(bandana({ site: "waist", slot: "bandana" }));
  assert(problems.some((p) => p.includes("a bandana does not go on waist")));
  assert(problems.some((p) => p.includes("belt")));
});

Deno.test("a belt is waist, and a waist chain is waist", () => {
  assertEquals(wornProblems(bandana({ id: "the-belt", kind: "belt", site: "waist", slot: "belt", name: "black leather belt", material: "leather", style: ["minimal"] })), []);
});

Deno.test("a model without a make is half an object", () => {
  assert(wornProblems(tote({ make: undefined })).some((p) => p.includes("model without a make")));
  assertEquals(wornProblems(tote()), []);
});

Deno.test("a fixed beanie cannot leave her between frames", async () => {
  const before = [await lockWorn(beanie())];
  const problems = wornSeriesProblems(before, []);
  assert(problems[0].includes("a fixed beanie is gone from this shot"));
});

Deno.test("a fixed beanie that changes colour is named as a different object", async () => {
  const before = [await lockWorn(beanie())];
  const after = [await lockWorn(beanie({ colour: { name: "oatmeal", hex: "#c8b89a" } }), 2)];
  assert(wornSeriesProblems(before, after)[0].includes("(colour)"));
});

Deno.test("a styling bandana is free to come and go", async () => {
  assertEquals(wornSeriesProblems([await lockWorn(bandana())], []), []);
});

Deno.test("style vocabulary is shared, so silver minimalistic and clay colourful are the same grammar", () => {
  assertEquals(styleProblems(["minimalistic"]), []);
  assertEquals(styleProblems(["colourful", "chunky"]), []);
  assertEquals(styleProblems(["chunky-ish"]).length, 1);
  assertEquals(materialProblems("bronze clay"), []);
  assertEquals(materialProblems("18k gold").length, 0);
  assert(materialProblems("gold").some((p) => p.includes("no karat")));
  assertEquals(styleBlock("bronze clay", ["Colourful", "chunky"]), "material: bronze clay\nstyle: colourful, chunky");
});

Deno.test("locking an unusable site item throws instead of sealing it", async () => {
  await assertRejects(() => lockWorn(beanie({ avoid: [] })), Error, "cannot lock");
});
