import { assertEquals, assert, assertRejects } from "jsr:@std/assert@1";
import {
  captureItem, digestOf, disclosureLine, importProblems, planFlatten, plateProblems, sourceFor,
  type ImportPhoto,
} from "../media/flatten.ts";
import { itemProblems, confirmItem } from "../media/inventory.ts";

const pin = (over: Partial<ImportPhoto> = {}): ImportPhoto => ({
  id: "pin-linen-blazer", uri: "assets/import/pin-linen-blazer.jpg", source: "pinterest",
  licence: "unknown", shows_person: true, garment_fully_visible: true, ...over,
});
const cut = { uri: "assets/import/pin-linen-blazer-cutout.png" };

Deno.test("a pinterest pin cannot claim to be owned", () => {
  assert(importProblems(pin({ licence: "owned" })).some((p) => p.includes("is not owned")));
});

Deno.test("a sleeve is not a garment", () => {
  assert(importProblems(pin({ garment_fully_visible: false })).some((p) => p.includes("sleeve is not a garment")));
});

Deno.test("permission without a credit is permission nobody can check", () => {
  assert(importProblems(pin({ licence: "permitted" })).some((p) => p.includes("permission nobody can check")));
  assertEquals(importProblems(pin({ licence: "permitted", credit: "@theshop" })), []);
});

Deno.test("a screenshot has to name the app it came from", () => {
  const bare = importProblems(pin({ source: "screenshot" }));
  assert(bare.some((p) => p.includes("has to name the app")), "screenshot alone is not a source");
  assertEquals(importProblems(pin({ source: "screenshot", app: "stylebook" })), []);
});

Deno.test("a plate that points at the photograph is refused, because it is a photograph", async () => {
  await assertRejects(() => planFlatten(pin(), { uri: pin().uri }), Error, "is a photograph, not a cutout");
});

Deno.test("the cutout removes the person, the face, the hands and the background", async () => {
  const plate = await planFlatten(pin(), cut);
  assertEquals(plate.role, "flat");
  assertEquals(plate.uri, cut.uri);
  assertEquals(plate.derivation.removed, ["background", "person", "face", "hands"]);
  assertEquals(plate.derivation.background, "studio_white");
  assertEquals(plate.derivation.from_uri, pin().uri);
});

Deno.test("a photo with no person in it only loses its background", async () => {
  const plate = await planFlatten(pin({ source: "shop", shows_person: false }), cut);
  assertEquals(plate.derivation.removed, ["background"]);
});

Deno.test("the same photo and cutout flatten to the same plate, every time", async () => {
  const a = await planFlatten(pin(), cut);
  const b = await planFlatten(pin(), cut);
  assertEquals(a.digest, b.digest);
  assertEquals(a.digest, await digestOf({ ...a, digest: undefined }));
});

Deno.test("a derived plate can never stand in for the worn plate", async () => {
  const plate = await planFlatten(pin(), cut);
  assertEquals(plateProblems(plate, { itemId: "linen-blazer", wants: "flat" }), []);
  assert(plateProblems(plate, { itemId: "linen-blazer", wants: "worn" })[0].includes("a cutout is not a photograph of her"));
});

Deno.test("the uri guard also holds for a plate built somewhere else", async () => {
  const plate = await planFlatten(pin(), cut);
  const faked = { ...plate, uri: plate.derivation.from_uri };
  assert(plateProblems(faked, { itemId: "x", wants: "flat" }).some((p) => p.includes("no cutout happened")));
});

Deno.test("an unknown licence owes the caption a line, and the line names the credit when there is one", async () => {
  const plate = await planFlatten(pin(), cut);
  assertEquals(plate.disclosure, true);
  assert(disclosureLine(plate)!.includes("not a picture of me wearing it"));
  const credited = await planFlatten(pin({ licence: "permitted", credit: "@theshop" }), cut);
  assertEquals(disclosureLine(credited), null);
});

Deno.test("the source map is explicit, and pinterest is refused rather than mapped", () => {
  assertEquals(sourceFor(pin({ source: "own", licence: "owned" })).source, "photo");
  assertEquals(sourceFor(pin({ source: "screenshot", app: "whering" })).source, "whering");
  assertEquals(sourceFor(pin({ source: "screenshot", app: "wardrowbe" })).source, "wardrowbe");
  assertEquals(sourceFor(pin({ source: "shop" })).source, "ltk");
  assert(sourceFor(pin()).problem!.includes("not a closet source"));
});

Deno.test("a capture lands as a candidate with the two empty fields left as work", async () => {
  const shot = pin({ source: "screenshot", app: "alta" });
  const { item, plate, problems } = await captureItem(shot, cut, { id: "linen-blazer", layer: "outer" });
  assertEquals(problems, []);
  assertEquals(item!.state, "candidate");
  assertEquals(item!.source, "alta");
  assertEquals(item!.ref, plate!.id);
  assertEquals(item!.kind, "");
  assertEquals(item!.palette, []);
  assertEquals(item!.layer_source, "suggested");
  assertEquals(itemProblems(item!), [], "a candidate is allowed to be unnamed");
});

Deno.test("a suggested layer cannot survive confirmation", async () => {
  const { item } = await captureItem(pin({ source: "screenshot", app: "whering" }), cut, { id: "blazer", layer: "outer" });
  const done = confirmItem(item!, { kind: "blazer", detail: "black wool blazer, single breasted", palette: ["#000000"] });
  assertEquals(done.problems, []);
  assertEquals(done.item!.layer_source, "authored", "confirming is a person, so the layer is authored from then on");
  assertEquals(itemProblems({ ...done.item!, layer_source: "suggested" }).some((p) => p.includes("layer a vision pass guessed")), true);
});

Deno.test("a pinterest pin never reaches the closet, whatever the cutout looks like", async () => {
  const { item, problems } = await captureItem(pin(), cut, { id: "blazer", layer: "outer" });
  assertEquals(item, undefined);
  assert(problems[0].includes("buy the piece"));
});
