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
  site: "hands",
  slot: "ring",
  side: "left",
  material: "18k yellow gold",
  style: ["minimal", "polished"],
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
  site: "ears/piercings",
  slot: "lobe",
  side: "both",
  material: "sterling silver",
  style: ["minimal"],
  worn: "both earlobes, first hole",
  persistence: "styling",
  avoid: ["pearls", "gold plating"],
  plates: plates("hoops"),
  ...over,
});

Deno.test("a piece is what it is, what it is made of, how it is made, and where it sits", async () => {
  const lock = await lockJewelry(band());
  assertEquals(jewelryLockProblems(lock), []);
  assertEquals(
    lock.block,
    [
      "piece: plain court band, 2mm",
      "material: 18k yellow gold",
      "style: minimal, polished",
      "worn: left ring finger, under the signet",
    ].join("\n"),
  );
  assert(!lock.block.includes("fixed"), "persistence is bookkeeping, not something a renderer draws");
});

Deno.test("silver minimalistic and gold chunky are four different objects, and the block says which", async () => {
  const silver = jewelryBlock(hoops({ style: ["minimalistic"], material: "sterling silver" }));
  const gold = jewelryBlock(hoops({ style: ["chunky"], material: "14k yellow gold" }));
  assert(silver.includes("material: sterling silver") && silver.includes("style: minimalistic"));
  assert(gold.includes("material: 14k yellow gold") && gold.includes("style: chunky"));
  assert(silver !== gold);
});

Deno.test("clay and enamel need no fineness, because they have none", () => {
  assertEquals(jewelryProblems(hoops({ material: "bronze clay", style: ["colourful", "chunky"] })), []);
  assertEquals(jewelryProblems(hoops({ material: "enamel on brass", style: ["colourful"] })), []);
});

Deno.test("gold with no karat is refused, and vermeil is a different product from gold plate (16 CFR 23)", () => {
  assert(jewelryProblems(band({ material: "gold" })).some((p) => p.includes("no karat or alloy")));
  for (const material of ["18k gold plated brass", "gold vermeil over sterling silver"]) {
    assertEquals(jewelryProblems(band({ material })), [], `"${material}" names a real product`);
  }
  for (const material of ["gold tone", "gold-coloured", "golden", "precious metal"]) {
    assert(jewelryProblems(band({ material })).some((p) => p.includes("names an appearance, not a material")), material);
  }
});

Deno.test("a style outside the vocabulary is refused, so chunky cannot become chunky-ish", () => {
  assert(jewelryProblems(hoops({ style: ["statement-ish"] })).some((p) => p.includes("not in the vocabulary")));
  assert(jewelryProblems(hoops({ style: [] })).some((p) => p.includes("style required")));
  assert(jewelryProblems(hoops({ style: ["minimal", "chunky", "rustic", "delicate"] })).some((p) => p.includes("three words at most")));
});

Deno.test("a pair needs two sides and a single site refuses one", () => {
  assert(jewelryProblems(hoops({ side: "none" })).some((p) => p.includes("comes in twos")));
  const necklace = band({ id: "thin-chain", site: "neck", slot: "necklace", side: "left", piece: "thin curb chain, 40cm" });
  assert(jewelryProblems(necklace).some((p) => p.includes("not a paired site")), "a necklace has no left");
  assertEquals(jewelryProblems(hoops({ side: "left" })), []);
});

Deno.test("an earring cannot be worn on the neck: the slot has to belong to the site", () => {
  const wrong = jewelryProblems(hoops({ site: "neck", slot: "lobe" }));
  assert(wrong.some((p) => p.includes("a lobe does not go on neck")));
  assert(jewelryProblems(hoops({ site: "ears", slot: "lobe" })).some((p) => p.includes("is not a site")));
});

Deno.test("one piece per hole, and two earrings need two sides", () => {
  const sameSide = jewelrySetProblems([hoops({ id: "hoop-left", side: "left" }), hoops({ id: "stud-left", side: "left" })]);
  assert(sameSide.some((p) => p.includes("2 pieces on ears/piercings/lobe/left")));
  const twoSides = jewelrySetProblems([hoops({ id: "hoop-left", side: "left" }), hoops({ id: "stud-right", side: "right" })]);
  assertEquals(twoSides, []);
});

Deno.test("a lobe hoop and a helix hoop are the same object on different holes", () => {
  const set = jewelrySetProblems([
    hoops({ id: "lobe-left", side: "left" }),
    hoops({ id: "helix-left", slot: "helix", side: "left", piece: "tiny helix hoop, 6mm" }),
  ]);
  assertEquals(set, []);
});

Deno.test("a fixed piece cannot leave her between shots without being retired", async () => {
  const before = [await lockJewelry(band()), await lockJewelry(hoops())];
  const problems = jewelrySeriesProblems(before, [await lockJewelry(hoops())]);
  assertEquals(problems.length, 1);
  assert(problems[0].includes("does not leave because the framing changed"));
});

Deno.test("a retired piece is allowed to go, but only with a date and a reason", async () => {
  const before = [await lockJewelry(band())];
  const retired = await lockJewelry(band({ retired: { on: "2026-11-01", why: "sizing changed after the winter" } }), 2);
  assertEquals(jewelrySeriesProblems(before, [retired]), []);
  assert(jewelryProblems(band({ retired: { on: "2026-11-01", why: "gone" } })).some((p) => p.includes("needs a reason")));
});

Deno.test("a fixed piece that changes is a different piece, and it is named", async () => {
  const before = [await lockJewelry(band())];
  const changed = [await lockJewelry(band({ material: "18k white gold" }), 2)];
  assert(jewelrySeriesProblems(before, changed).some((p) => p.includes("the fixed piece changed (material)")));
});

Deno.test("styling pieces are free to come and go", async () => {
  assertEquals(jewelrySeriesProblems([await lockJewelry(band()), await lockJewelry(hoops())], [await lockJewelry(band())]), []);
});

Deno.test("locking an unusable piece throws instead of sealing it", async () => {
  await assertRejects(() => lockJewelry(hoops({ avoid: [] })), Error, "cannot lock");
});
