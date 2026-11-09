import { assertEquals, assertRejects, assert } from "jsr:@std/assert@1";
import {
  itemBlock,
  itemProblems,
  lockOutfit,
  outfitBlock,
  outfitDrift,
  outfitLockProblems,
  outfitProblems,
  palette,
  type GarmentItem,
} from "../wardrobe/module.ts";
import { replaceProblems, seedFrom } from "../lock.ts";

const plates = (id: string) => [
  { id: `${id}-flat`, uri: `assets/wardrobe/${id}-flat.jpg`, role: "flat" as const },
  { id: `${id}-worn`, uri: `assets/wardrobe/${id}-worn.jpg`, role: "worn" as const },
];

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

Deno.test("a locked outfit emits verbatim text, a digest and a seed", async () => {
  const lock = await lockOutfit("tuesday-outfit", [shirt(), coat()]);
  assertEquals(outfitLockProblems(lock), []);
  assertEquals(lock.digest.length, 64);
  assertEquals(lock.seed, seedFrom(lock.digest));
  assert(lock.block.includes("outer: oatmeal heavy brushed wool wool overcoat"));
  // the base layer is described before the coat, because it sits against the body
  assert(lock.block.indexOf("base:") < lock.block.indexOf("outer:"));
});

Deno.test("the same world digests the same, so a re-run is a re-run", async () => {
  const a = await lockOutfit("tuesday-outfit", [shirt(), coat()]);
  const b = await lockOutfit("tuesday-outfit", [shirt(), coat()]);
  assertEquals(a.digest, b.digest);
  assertEquals(a.seed, b.seed);
  assertEquals(a.block, b.block);
});

Deno.test("letter order is meaning: reordered details are a different seal", async () => {
  const a = await lockOutfit("tuesday-outfit", [shirt(), coat()]);
  const b = await lockOutfit("tuesday-outfit", [
    shirt(),
    coat({ details: ["horn buttons", "double breasted", "patch pockets"] }),
  ]);
  assert(a.digest !== b.digest);
});

Deno.test("a hand-edited block is refused, because the block must be derived", async () => {
  const lock = await lockOutfit("tuesday-outfit", [shirt(), coat()]);
  const tampered = { ...lock, block: lock.block.replace("oatmeal", "cream") };
  const problems = outfitLockProblems(tampered);
  assert(problems.some((p) => p.includes("does not match the value")));
});

Deno.test("a restyle under the same version is refused by name", async () => {
  const before = await lockOutfit("tuesday-outfit", [shirt(), coat()]);
  const restyled = await lockOutfit("tuesday-outfit", [
    shirt(),
    coat({ colour: { name: "camel", hex: "#b08d57" } }),
  ]);
  const problems = replaceProblems(before, restyled);
  assertEquals(problems.length, 1);
  assert(problems[0].includes("a changed lock is a new version"));
});

Deno.test("a real change with a version is accepted, and an empty version is refused", async () => {
  const v1 = await lockOutfit("tuesday-outfit", [shirt(), coat()]);
  const v2 = await lockOutfit("tuesday-outfit", [shirt(), coat({ fabric: "boiled wool" })], 2);
  assertEquals(replaceProblems(v1, v2), []);
  const empty = await lockOutfit("tuesday-outfit", [shirt(), coat()], 2);
  const emptyProblems = replaceProblems(v1, empty);
  assert(emptyProblems.some((p) => p.includes("changes nothing")));
});

Deno.test("drift names the garment and the field, not a boolean", async () => {
  const before = await lockOutfit("tuesday-outfit", [shirt(), coat()]);
  const after = await lockOutfit("tuesday-outfit", [
    shirt(),
    coat({ colour: { name: "camel", hex: "#b08d57" }, fit: "oversized" }),
  ]);
  const moved = outfitDrift(before, after);
  assertEquals(moved, ["changed:oatmeal-coat(colour,fit)"]);
});

Deno.test("a garment added or removed is named as such", async () => {
  const before = await lockOutfit("tuesday-outfit", [shirt()]);
  const after = await lockOutfit("tuesday-outfit", [shirt({ id: "oxford-shirt", name: "the oxford" }), coat()]);
  const moved = outfitDrift(before, after);
  assert(moved.includes("added:oatmeal-coat"));
  assert(moved.includes("removed:linen-shirt"));
});

Deno.test("a garment with two details is refused: it would be invented on the day", () => {
  const problems = itemProblems(coat({ details: ["double breasted", "horn buttons"] }));
  assert(problems.some((p) => p.includes("needs 3")));
});

Deno.test("text alone cannot hold a lapel: no plate needs a stated reason", () => {
  const bare = itemProblems(coat({ plates: [] }));
  assert(bare.some((p) => p.includes("no reference plate")));
  const promised = itemProblems(coat({ plates: [], plates_missing_reason: "bought today, photographed tomorrow" }));
  assertEquals(promised, []);
});

Deno.test("a colour without a hex is a word", () => {
  const problems = itemProblems(coat({ colour: { name: "oatmeal", hex: "oatmeal" } }));
  assert(problems.some((p) => p.includes("colour hex must be #rrggbb")));
});

Deno.test("two base layers are refused, and an outfit with no base is refused", () => {
  const twoBase = outfitProblems([shirt(), shirt({ id: "second-shirt", name: "the other" })]);
  assert(twoBase.some((p) => p.includes("2 base garments")));
  const noBase = outfitProblems([coat()]);
  assert(noBase.some((p) => p.includes("no base layer")));
});

Deno.test("the lock carries the garments, so it can be read without the closet", async () => {
  const lock = await lockOutfit("tuesday-outfit", [shirt(), coat()]);
  assertEquals(lock.block, outfitBlock(lock.value.items));
  assertEquals(lock.value.items.length, 2);
  assertEquals(palette(lock), ["#f2efe8", "#c8b89a"]);
});

Deno.test("locking an invalid outfit throws rather than sealing a mistake", async () => {
  await assertRejects(
    () => lockOutfit("tuesday-outfit", [coat({ details: ["one"] })]),
    Error,
    "cannot lock",
  );
});
