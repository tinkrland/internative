import { assertEquals, assert, assertRejects } from "jsr:@std/assert@1";
import { disclosureLine, importProblems, planFlatten, plateProblems, type ImportPhoto } from "../wardrobe/flatten.ts";

const pin = (over: Partial<ImportPhoto> = {}): ImportPhoto => ({
  id: "pin-linen-blazer", uri: "assets/import/pin-linen-blazer.jpg", source: "pinterest",
  licence: "unknown", shows_person: true, garment_fully_visible: true, ...over,
});

Deno.test("a pinterest pin cannot claim to be owned", () => {
  const problems = importProblems(pin({ licence: "owned" }));
  assert(problems.some((p) => p.includes("is not owned")));
});

Deno.test("a sleeve is not a garment", () => {
  assert(importProblems(pin({ garment_fully_visible: false })).some((p) => p.includes("sleeve is not a garment")));
});

Deno.test("permission without a credit is permission nobody can check", () => {
  assert(importProblems(pin({ licence: "permitted" })).some((p) => p.includes("permission nobody can check")));
  assertEquals(importProblems(pin({ licence: "permitted", credit: "@theshop" })), []);
});

Deno.test("the cutout removes the person, the face, the hands and the background", async () => {
  const plate = await planFlatten(pin());
  assertEquals(plate.role, "flat");
  assertEquals(plate.derivation.removed, ["background", "person", "face", "hands"]);
  assertEquals(plate.derivation.background, "studio_white");
});

Deno.test("a photo with no person in it only loses its background", async () => {
  const plate = await planFlatten(pin({ source: "shop", shows_person: false }));
  assertEquals(plate.derivation.removed, ["background"]);
});

Deno.test("the same photo flattens to the same plate, every time", async () => {
  const a = await planFlatten(pin());
  const b = await planFlatten(pin());
  assertEquals(a.digest, b.digest);
});

Deno.test("a derived plate can never stand in for the worn plate", async () => {
  const plate = await planFlatten(pin());
  assertEquals(plateProblems(plate, { itemId: "linen-blazer", wants: "flat" }), []);
  const wrong = plateProblems(plate, { itemId: "linen-blazer", wants: "worn" });
  assert(wrong[0].includes("a cutout is not a photograph of her"));
});

Deno.test("an unknown licence owes the caption a line, and the line names the credit when there is one", async () => {
  const plate = await planFlatten(pin());
  assertEquals(plate.disclosure, true);
  assert(disclosureLine(plate)!.includes("not a picture of me wearing it"));
  const credited = await planFlatten(pin({ licence: "permitted", credit: "@theshop" }));
  assertEquals(credited.disclosure, false);
  assertEquals(disclosureLine(credited), null);
});

Deno.test("a pin without a full view is refused rather than flattened into a guess", async () => {
  await assertRejects(() => planFlatten(pin({ garment_fully_visible: false })));
});
