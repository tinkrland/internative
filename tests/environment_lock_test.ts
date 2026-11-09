import { assertEquals, assertRejects, assert, assertThrows } from "jsr:@std/assert@1";
import {
  lockPlace,
  placeBlock,
  placeDrift,
  placeLockProblems,
  placeProblems,
  structureSource,
  type Place,
} from "../environment/module.ts";
import { replaceProblems } from "../lock.ts";

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
    { surface: "floor", material: "grey tile", hex: "#8d8b86" },
  ],
  light: { direction: "left", quality: "soft daylight, no fill", time: "mid-morning" },
  plates: [
    { id: "kitchen-wide", uri: "assets/places/kitchen-wide.jpg", role: "wide", ours: true },
    { id: "kitchen-mirror", uri: "assets/places/kitchen-mirror.jpg", role: "mirror", ours: true },
    { id: "kitchen-sink", uri: "assets/places/kitchen-sink.jpg", role: "detail", ours: true },
  ],
  props: ["copper kettle", "two mugs on the drainer"],
  avoid: ["open plan", "stainless everywhere", "overhead strip lights"],
  recurring: true,
  ...over,
});

Deno.test("a locked place emits a block, and the block says where the window is", async () => {
  const lock = await lockPlace(kitchen());
  assertEquals(placeLockProblems(lock), []);
  assertEquals(lock.block, placeBlock(lock.value));
  assert(lock.block.includes("light: soft daylight, no fill, from the left, mid-morning"));
  assertEquals(lock.digest.length, 64);
});

Deno.test("the same room digests the same, and an edited block is refused", async () => {
  const a = await lockPlace(kitchen());
  const b = await lockPlace(kitchen());
  assertEquals(a.digest, b.digest);
  assertEquals(a.seed, b.seed);
  const tampered = { ...a, block: a.block.replace("left wall", "right wall") };
  assert(placeLockProblems(tampered).some((p) => p.includes("does not match the value")));
});

Deno.test("two fixed things is a style, not a place", () => {
  const problems = placeProblems(kitchen({ invariants: ["window left", "counter under it"] }));
  assert(problems.some((p) => p.includes("needs 3")));
});

Deno.test("an invariant has to be a fact: 'white walls' is a mood", () => {
  const problems = placeProblems(kitchen({ invariants: ["white walls", "wood floor", "big window"] }));
  assertEquals(problems.filter((p) => p.includes("too thin to hold")).length, 3);
});

Deno.test("a recurring place with no wide plate has no geometry, only adjectives", () => {
  const problems = placeProblems(kitchen({ plates: [{ id: "kitchen-mirror", uri: "assets/x.jpg", role: "mirror" }] }));
  assert(problems.some((p) => p.includes("no wide plate")));
});

Deno.test("a one-off set may have no plates if it says why", () => {
  const oneOff = kitchen({ recurring: false, plates: [], plates_missing_reason: "built for one shot, then struck" });
  assertEquals(placeProblems(oneOff), []);
});

Deno.test("the structure source is the wide plate, and a place without one cannot offer geometry", async () => {
  const lock = await lockPlace(kitchen());
  const source = structureSource(lock);
  assertEquals(source.plate, "kitchen-wide");
  assertEquals(source.preprocessors, ["depth", "line"]);
  assert(source.why.includes("where"));
  const noWide = await lockPlace(kitchen({ recurring: false, id: "studio-corner", plates: [{ id: "corner", uri: "assets/x.jpg", role: "detail" }] }));
  assertThrows(() => structureSource(noWide), Error, "no wide plate");
});

Deno.test("a surface without a hex is a word, and without a material it is paint", () => {
  const problems = placeProblems(kitchen({ surfaces: [{ surface: "wall", material: "", hex: "cream" }] }));
  assert(problems.some((p) => p.includes("material required")));
  assert(problems.some((p) => p.includes("is not a hex colour")));
});

Deno.test("light is a direction and a time, not a vibe", () => {
  const problems = placeProblems(kitchen({ light: { direction: "nice" as never, quality: "moody", time: "" } }));
  assert(problems.some((p) => p.includes("light direction must be one of")));
  assert(problems.some((p) => p.includes("light time required")));
});

Deno.test("drift names the surface, the light and the plate that moved", async () => {
  const before = await lockPlace(kitchen());
  const after = await lockPlace(
    kitchen({
      surfaces: [
        { surface: "wall", material: "painted plaster", hex: "#e6dfd2" },
        { surface: "counter", material: "pale oak", hex: "#d8c4a4" },
        { surface: "floor", material: "grey tile", hex: "#8d8b86" },
      ],
      light: { direction: "right", quality: "soft daylight, no fill", time: "mid-morning" },
      plates: [{ id: "kitchen-wide", uri: "assets/places/kitchen-wide.jpg", role: "wide" }],
    }),
  );
  const moved = placeDrift(before, after);
  assertEquals(moved.sort(), ["light", "plates", "surfaces"]);
});

Deno.test("a restyle under the same version is refused, a new version is accepted", async () => {
  const v1 = await lockPlace(kitchen());
  const repainted = await lockPlace(
    kitchen({ surfaces: [{ surface: "wall", material: "painted plaster", hex: "#e6dfd2" }, ...kitchen().surfaces.slice(1)] }),
  );
  assert(replaceProblems(v1, repainted).some((p) => p.includes("a changed lock is a new version")));
  const v2 = await lockPlace(
    kitchen({ surfaces: [{ surface: "wall", material: "painted plaster", hex: "#e6dfd2" }, ...kitchen().surfaces.slice(1)] }),
    2,
  );
  assertEquals(replaceProblems(v1, v2), []);
});

Deno.test("locking an invalid place throws rather than sealing a mistake", async () => {
  await assertRejects(() => lockPlace(kitchen({ avoid: [] })), Error, "cannot lock");
});
