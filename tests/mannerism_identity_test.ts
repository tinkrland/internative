import { assertEquals, assert } from "jsr:@std/assert@1";
import { lockOutfit, type GarmentItem } from "../wardrobe/module.ts";
import { lockHair, type Hairstyle } from "../wardrobe/hair.ts";
import { identityDrift, identityProblems, planLook, seriesLookProblems, type LookParts } from "../wardrobe/look.ts";
import type { Mannerism } from "../mannerisms/module.ts";

const plates = (id: string) => [
  { id: `${id}-flat`, uri: `assets/wardrobe/${id}-flat.jpg`, role: "flat" as const },
  { id: `${id}-worn`, uri: `assets/wardrobe/${id}-worn.jpg`, role: "worn" as const },
];

const shirt = (): GarmentItem => ({
  id: "linen-shirt", name: "the linen shirt", slot: "base", kind: "shirt", fabric: "washed linen",
  colour: { name: "chalk", hex: "#f2efe8" }, fit: "loose, sleeves pushed up",
  details: ["mother of pearl buttons", "single chest pocket", "soft collar"],
  avoid: ["stiff collar", "slim fit", "prints"], season: "any", source: "authored", plates: plates("shirt"),
});

const bob = (): Hairstyle => ({
  id: "the-bob", name: "the bob", hair: "chin length blunt bob, heavy fringe", parting: "centre",
  texture: "fine, straight, no body", finish: "air dried, no product", updo: "low twisted knot, same fringe",
  avoid: ["layers"], plates: plates("hair"),
});

// the habit she has in every photograph, and one she only shows under stress.
const tuck = (over: Partial<Mannerism> = {}): Mannerism => ({
  id: "hair-tuck", name: "the tuck", kind: "habit", site: "hair",
  what: "sweeps the fringe behind the right ear with two fingers, then leaves it there",
  frequency: "always", intensity: 2, evidence: "authored", ...over,
});

const knuckle = (over: Partial<Mannerism> = {}): Mannerism => ({
  id: "knuckle-press", name: "the knuckle press", kind: "habit", site: "hands",
  what: "presses the right thumb into the left knuckle while listening",
  frequency: "under_stress", intensity: 1, evidence: "authored", ...over,
});

const world = async (mannerisms: Mannerism[] = []): Promise<LookParts> => ({
  outfit: await lockOutfit("tuesday-outfit", [shirt()]),
  hair: await lockHair(bob()),
  mannerisms,
});

Deno.test("an always-on mannerism is identity, and a situational one is not", async () => {
  const look = await planLook("tuesday-look", await world([tuck(), knuckle()]));
  assertEquals(look.value.identity.mannerisms.map((m) => m.id), ["hair-tuck"]);
});

Deno.test("changing an always-on mannerism changes the identity digest", async () => {
  const before = await planLook("monday-look", await world([tuck()]));
  const after = await planLook("monday-look", await world([tuck({ what: "sweeps the fringe behind the left ear with two fingers, then leaves it there" })]), 2);
  assert(before.digest !== after.digest, "a different movement is a different picture");
  assert(before.identity_digest !== after.identity_digest, "and it is the same body, so it is the same person only if the movement holds");
  const moved = identityDrift(before.value.identity, after.value.identity);
  assertEquals(moved, ["mannerism hair-tuck: changed"]);
});

Deno.test("a situational mannerism may come and go across a series without touching identity", async () => {
  const monday = await planLook("monday-look", await world([tuck()]));
  const thursday = await planLook("thursday-look", await world([tuck(), knuckle()]), 2);
  assertEquals(monday.identity_digest, thursday.identity_digest);
  assertEquals(seriesLookProblems([monday, thursday]), []);
});

Deno.test("a series that drops her always-on habit is refused, and the message names it", async () => {
  const monday = await planLook("monday-look", await world([tuck()]));
  const thursday = await planLook("thursday-look", await world([]), 2);
  const problems = seriesLookProblems([monday, thursday]);
  assert(problems.length === 1);
  assert(problems[0].includes("mannerism hair-tuck: gone"));
});

Deno.test("the identity gate catches a mannerism edited onto a locked look", async () => {
  const look = await planLook("tuesday-look", await world([tuck()]));
  const tampered = { ...look, value: { ...look.value, identity: { ...look.value.identity, mannerisms: [] } } };
  const problems = await identityProblems(tampered);
  assert(problems.length === 1);
  assert(problems[0].includes("somebody has been editing"));
});

Deno.test("no mannerisms at all is a valid look, and adding one is a change of person", async () => {
  const plain = await planLook("monday-look", await world([]));
  assertEquals(plain.value.identity.mannerisms, []);
  const withHabit = await planLook("monday-look", await world([tuck()]), 2);
  assert(plain.identity_digest !== withHabit.identity_digest);
  assert(identityDrift(plain.value.identity, withHabit.value.identity).includes("mannerism hair-tuck: added"));
});
