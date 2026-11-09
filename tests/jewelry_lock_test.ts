import { assertEquals, assertRejects, assert } from "jsr:@std/assert@1";
import {
  jewelryBlock,
  jewelryLockProblems,
  jewelryProblems,
  jewelrySeriesProblems,
  jewelrySetProblems,
  lockJewelry,
  type JewelryPiece,
} from "../wardrobe/jewelry.ts";

const plates = (id: string) => [{ id: `${id}-flat`, uri: `assets/wardrobe/${id}-flat.jpg`, role: "flat" as const }];

const band = (over: Partial<JewelryPiece> = {}): JewelryPiece => ({
  id: "wedding-band",
  name: "the band",
  piece: "plain court band, 2mm",
  metal: "18k yellow gold",
  stone: "none",
  site: "finger",
  worn: "left ring finger, under the signet",
  persistence: "fixed",
  avoid: ["stones", "engraving", "rose gold"],
  plates: plates("band"),
  ...over,
});

const hoops = (over: Partial<JewelryPiece> = {}): JewelryPiece => ({
  id: "huggie-hoops",
  name: "the hoops",
  piece: "huggie hoops, 8mm",
  metal: "sterling silver",
  stone: "none",
  site: "ear",
  worn: "both earlobes, first hole",
  persistence: "styling",
  avoid: ["pearls", "gold plating"],
  plates: plates("hoops"),
  ...over,
});

Deno.test("a piece is metal, stone and the place it sits, and nothing else", async () => {
  const lock = await lockJewelry(band());
  assertEquals(jewelryLockProblems(lock), []);
  assertEquals(lock.block, "piece: plain court band, 2mm\nmetal: 18k yellow gold\nstone: none\nworn: left ring finger, under the signet");
  assert(!lock.block.includes("fixed"), "persistence is bookkeeping, not something a renderer draws");
});

Deno.test("a metal has to be named, because gold coloured is not gold (16 CFR 23)", () => {
  assert(jewelryProblems(band({ metal: "" })).some((p) => p.includes("metal required")));
  assert(jewelryProblems(band({ metal: "18k yellow gold" })).length === 0, "a karat is a material description");
  assert(jewelryProblems(band({ metal: "sterling silver" })).length === 0, "an alloy with a standard is one too");
});

Deno.test("gold with no karat is refused, because vermeil and gold plate are different products", () => {
  const bare = jewelryProblems(band({ metal: "gold" }));
  assert(bare.some((p) => p.includes("no karat or alloy")), "gold alone is the vaguest word in the sentence");
  assert(bare.some((p) => p.includes("16 cfr 23.3, 23.4")));
  // and the three surface products are allowed when named, which is the point of the rule
  for (const metal of ["18k gold plated brass", "gold filled overlay", "gold vermeil over sterling silver"]) {
    assert(jewelryProblems(band({ metal })).length === 0, `"${metal}" names a real product`);
  }
});

Deno.test("an appearance is not a material: gold tone and gold coloured are refused", () => {
  for (const metal of ["gold tone", "gold-coloured", "golden", "precious metal"]) {
    assert(jewelryProblems(band({ metal })).some((p) => p.includes("names an appearance, not a material")), `"${metal}"`);
  }
});

Deno.test("a stone is said out loud even when there is none", () => {
  assert(jewelryProblems(band({ stone: "" })).some((p) => p.includes("stone required")));
});

Deno.test("two fixed pieces on one site are refused, and two styling pieces are not", () => {
  const twoFixed = jewelrySetProblems([band(), band({ id: "signet", piece: "signet ring, flat oval" })]);
  assert(twoFixed.some((p) => p.includes("two fixed pieces on the finger")));
  const twoStyling = jewelrySetProblems([hoops(), hoops({ id: "second-hoops", worn: "right earlobe" })]);
  assertEquals(twoStyling, []);
});

Deno.test("a fixed piece cannot leave her between shots without being retired", async () => {
  const before = [await lockJewelry(band()), await lockJewelry(hoops())];
  const after = [await lockJewelry(hoops())];
  const problems = jewelrySeriesProblems(before, after);
  assertEquals(problems.length, 1);
  assert(problems[0].includes("does not leave because the framing changed"));
});

Deno.test("a retired piece is allowed to go, but only with a date and a reason", async () => {
  const before = [await lockJewelry(band())];
  const retired = await lockJewelry(band({ retired: { on: "2026-11-01", why: "sizing changed after the winter" } }), 2);
  assertEquals(jewelrySeriesProblems(before, [retired]), []);
  const vague = jewelryProblems(band({ retired: { on: "2026-11-01", why: "gone" } }));
  assert(vague.some((p) => p.includes("needs a reason")));
});

Deno.test("a fixed piece that changes is a different piece, and it is named", async () => {
  const before = [await lockJewelry(band())];
  const changed = [await lockJewelry(band({ metal: "18k white gold" }), 2)];
  const problems = jewelrySeriesProblems(before, changed);
  assert(problems.some((p) => p.includes("the fixed piece changed (metal)")));
});

Deno.test("styling pieces are free to come and go", async () => {
  const before = [await lockJewelry(band()), await lockJewelry(hoops())];
  const after = [await lockJewelry(band())];
  assertEquals(jewelrySeriesProblems(before, after), []);
});

Deno.test("locking an unusable piece throws instead of sealing it", async () => {
  await assertRejects(() => lockJewelry(hoops({ site: "nose" as never })), Error, "cannot lock");
});
