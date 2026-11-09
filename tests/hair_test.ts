import { assertEquals, assertRejects, assert, assertThrows } from "jsr:@std/assert@1";
import {
  hairBlock,
  hairLockProblems,
  hairProblems,
  hairVariantBlock,
  lockHair,
  restyleProblems,
  type Hairstyle,
} from "../wardrobe/hair.ts";

const plates = [{ id: "hair-flat", uri: "assets/wardrobe/hair-flat.jpg", role: "flat" as const }];

const bob = (over: Partial<Hairstyle> = {}): Hairstyle => ({
  id: "the-bob",
  name: "the bob",
  hair: "chin length blunt bob, heavy fringe",
  parting: "centre",
  texture: "fine, straight, no body",
  finish: "air dried, no product",
  updo: "low twisted knot, same fringe",
  avoid: ["layers", "curls", "shiny product"],
  plates,
  ...over,
});

Deno.test("her hair is four lines, and the cut comes first", async () => {
  const lock = await lockHair(bob());
  assertEquals(hairLockProblems(lock), []);
  assertEquals(lock.block.split("\n")[0], "hair: chin length blunt bob, heavy fringe");
});

Deno.test("wearing it up is a toggle: same digest, one more line", async () => {
  const lock = await lockHair(bob());
  assertEquals(hairVariantBlock(lock, false), lock.block);
  assert(hairVariantBlock(lock, true).endsWith("up-do: low twisted knot, same fringe"));
  assertEquals(lock.digest, (await lockHair(bob())).digest);
});

Deno.test("an up-do shot with nothing declared is refused, so nobody improvises a chignon", async () => {
  const lock = await lockHair(bob({ updo: undefined }));
  assertThrows(() => hairVariantBlock(lock, true), Error, "no up-do declared");
});

Deno.test("a haircut without an event is refused by name", async () => {
  const before = await lockHair(bob());
  const after = await lockHair(bob({ hair: "collarbone length, curtain fringe" }), 2);
  const problems = restyleProblems(before, after);
  assertEquals(problems.length, 1);
  assert(problems[0].includes("a cut is an event with a date"));
});

Deno.test("a dated restyle is how her hair changes", async () => {
  const before = await lockHair(bob());
  const after = await lockHair(
    bob({ hair: "collarbone length, curtain fringe", restyle: { on: "2026-11-02", why: "growing the fringe out" } }),
    2,
  );
  assertEquals(restyleProblems(before, after), []);
});

Deno.test("parting and texture count as the same rule: a moved centre is a moved cut", async () => {
  const before = await lockHair(bob());
  const parted = await lockHair(bob({ parting: "deep side" }), 2);
  assert(restyleProblems(before, parted).some((p) => p.includes("parting")));
});

Deno.test("texture is strand thickness and pattern, because a stylist means both", () => {
  assert(hairProblems(bob({ texture: "fine, straight, no body" })).length === 0);
  const noStrand = hairProblems(bob({ texture: "lovely and shiny" }));
  assert(noStrand.some((p) => p.includes("how thick the strand is")));
  assert(noStrand.some((p) => p.includes("does not say the pattern")));
  const strandOnly = hairProblems(bob({ texture: "coarse, no body" }));
  assertEquals(strandOnly.filter((p) => p.includes("texture")).length, 1, "strand named, pattern still missing");
  const patternOnly = hairProblems(bob({ texture: "soft waves, no body" }));
  assert(patternOnly.some((p) => p.includes("how thick the strand is")));
});

Deno.test("a hairstyle has to state its length, texture and finish", () => {
  const problems = hairProblems(bob({ hair: "bob", texture: "", finish: "wet" }));
  assert(problems.some((p) => p.includes("length, cut and fringe")));
  assert(problems.some((p) => p.includes("texture required")));
  assert(problems.some((p) => p.includes("finish required")));
});

Deno.test("locking an unusable hairstyle throws instead of sealing it", async () => {
  await assertRejects(() => lockHair(bob({ avoid: [] })), Error, "cannot lock");
});
