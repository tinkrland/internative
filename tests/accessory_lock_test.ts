import { assertEquals, assertRejects, assert, assertThrows } from "jsr:@std/assert@1";
import {
  accessoryDrift,
  accessoryLockProblems,
  accessoryProblems,
  dressedBlock,
  dressingFor,
  lockAccessory,
  upgradeProblems,
  type Accessory,
} from "../wardrobe/accessory.ts";

const plates = (id: string) => [{ id: `${id}-flat`, uri: `assets/wardrobe/${id}-flat.jpg`, role: "flat" as const }];

const phone = (over: Partial<Accessory> = {}): Accessory => ({
  id: "her-phone",
  name: "her phone",
  carries: "phone",
  device: { make: "apple", model: "iphone 13", colour: "graphite", size: "6.1 inch" },
  worn: "right hip, under the coat",
  dressings: [
    { id: "walnut-case", slot: "case", name: "walnut brown leather", note: "worn at the corners" },
    { id: "clear-case", slot: "case", name: "clear polycarbonate" },
    { id: "brass-charm", slot: "charm", name: "brass tag, engraved" },
  ],
  avoid: ["stickers", "pop sockets", "clear plastic"],
  plates: plates("phone"),
  ...over,
});

Deno.test("the lock is the device, and the block never mentions the case", async () => {
  const lock = await lockAccessory(phone());
  assertEquals(accessoryLockProblems(lock), []);
  assertEquals(lock.block, "device: apple iphone 13, graphite, 6.1 inch\ncarried: right hip, under the coat");
  assert(!lock.block.includes("walnut"), "a dressing is chosen per shot, so it is not in the identity block");
});

Deno.test("a dressing she owns dresses the shot, and the identity digest does not move", async () => {
  const lock = await lockAccessory(phone());
  const dressed = dressedBlock(lock.value, "walnut-case");
  assert(dressed.endsWith("case: walnut brown leather, worn at the corners"));
  assert(dressed.startsWith(lock.block));
  assertEquals(dressedBlock(lock.value, "none"), lock.block);
  assertEquals(lock.digest, (await lockAccessory(phone())).digest);
});

Deno.test("a case she does not own is refused rather than invented", async () => {
  const lock = await lockAccessory(phone());
  assertThrows(() => dressingFor(lock.value, "silicone-sleeve"), Error, "not a dressing she owns");
  assertThrows(() => dressedBlock(lock.value, "silicone-sleeve"), Error, "owned: walnut-case, clear-case, brass-charm");
});

Deno.test("a case does not go on a watch, because that is a rendering bug with a name", () => {
  const watch = phone({
    id: "her-watch",
    carries: "watch",
    device: { make: "omega", model: "seamaster 36mm", colour: "steel" },
    dressings: [{ id: "black-strap", slot: "case", name: "black calf leather" }],
  });
  assert(accessoryProblems(watch).some((p) => p.includes("a case does not go on watch")));
});

Deno.test("a model that names a category is refused: her phone is a phone, not any phone", () => {
  for (const model of ["phone", "device", "unknown"]) {
    const problems = accessoryProblems(phone({ device: { make: "apple", model, colour: "graphite" } }));
    assert(problems.some((p) => p.includes("names a category")), `"${model}" should be refused`);
  }
});

Deno.test("a device change without an upgrade is refused, and the message says why", async () => {
  const before = await lockAccessory(phone());
  const after = await lockAccessory(phone({ device: { make: "apple", model: "iphone 15", colour: "graphite" } }), 2);
  const problems = upgradeProblems(before, after);
  assertEquals(problems.length, 1);
  assert(problems[0].includes("people do not change phones between shots"));
});

Deno.test("a dated upgrade is the way a device changes", async () => {
  const before = await lockAccessory(phone());
  const after = await lockAccessory(
    phone({
      device: { make: "apple", model: "iphone 15", colour: "graphite" },
      upgrade: { on: "2026-11-09", why: "the 13 stopped holding a charge" },
    }),
    2,
  );
  assertEquals(upgradeProblems(before, after), []);
});

Deno.test("an upgrade with no date is refused, and a repeated date is not a new event", async () => {
  const bare = accessoryProblems(phone({ upgrade: { on: "yesterday", why: "wanted a new one" } }));
  assert(bare.some((p) => p.includes("upgrade date must be yyyy-mm-dd")));
  const before = await lockAccessory(phone({ upgrade: { on: "2026-01-05", why: "bought outright" } }));
  const after = await lockAccessory(
    phone({
      device: { make: "apple", model: "iphone 15", colour: "graphite" },
      upgrade: { on: "2026-01-05", why: "bought outright" },
    }),
    2,
  );
  assert(upgradeProblems(before, after).some((p) => p.includes("not a new event")));
});

Deno.test("re-dressing is not drift, and a device change is named as one", async () => {
  const before = await lockAccessory(phone());
  const redressed = await lockAccessory(phone({ dressings: [{ id: "clear-case", slot: "case", name: "clear polycarbonate" }] }), 2);
  assert(accessoryDrift(before, redressed).includes("dressings"));
  const upgraded = await lockAccessory(
    phone({
      device: { make: "apple", model: "iphone 15", colour: "graphite", size: "6.1 inch" },
      upgrade: { on: "2026-11-09", why: "replaced under insurance" },
    }),
    2,
  );
  assertEquals(accessoryDrift(before, upgraded), ["device(model)"]);
});

Deno.test("a switch to a device with no make is refused, because a make is what a viewer knows", () => {
  const problems = accessoryProblems(phone({ device: { make: "", model: "iphone 13", colour: "graphite" } }));
  assert(problems.some((p) => p.includes("device make required")));
});

Deno.test("locking an unusable accessory throws instead of sealing it", async () => {
  await assertRejects(() => lockAccessory(phone({ avoid: [] })), Error, "cannot lock");
});
