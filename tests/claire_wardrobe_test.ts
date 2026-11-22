import { assertEquals, assert } from "jsr:@std/assert@1";
import { stripJsonc } from "../persona/loader.ts";

const root = new URL("../", import.meta.url);
const read = async (p: string) => JSON.parse(stripJsonc(await Deno.readTextFile(new URL(p, root))));
const look = await read("personas/claire.look.jsonc");
const wardrobe = await read("personas/claire.wardrobe.jsonc");
const places = await read("personas/claire.places.jsonc");
const inventory = await read("personas/claire.inventory.jsonc");

const manifestFiles = new Set(look.assets.map((a: any) => a.file));

Deno.test("every outfit cites frames that exist in her reference set", () => {
  assert(wardrobe.outfits.length >= 3);
  for (const outfit of wardrobe.outfits) {
    assert(outfit.evidence.files.length > 0, outfit.id);
    for (const file of outfit.evidence.files) {
      assertEquals(manifestFiles.has(file), true, `${outfit.id} cites ${file}, which is not in the look manifest`);
    }
  }
});

Deno.test("every outfit names a garment with a detail a model could shoot", () => {
  for (const outfit of wardrobe.outfits) {
    assert(outfit.garments.length > 0);
    for (const garment of outfit.garments) {
      assert(garment.detail.length > 20, `${outfit.id} ${garment.kind}: "${garment.detail}" is not a description`);
    }
    assert(outfit.palette.length > 0, `${outfit.id} has no palette`);
  }
});

Deno.test("a place is a room with fixed facts and a wide plate that exists", async () => {
  assert(places.places.length >= 3);
  for (const place of places.places) {
    assert(place.invariants.length >= 3, place.id);
    for (const invariant of place.invariants) assert(invariant.length >= 12, `${place.id}: "${invariant}" is a mood, not a fact`);
    assert(place.light.length > 8, place.id);
    const wide = place.plates.find((p: any) => p.role === "wide");
    assert(wide, `${place.id} needs a wide plate`);
    assertEquals(manifestFiles.has(wide.uri), true, `${place.id} plate ${wide.uri} is not a file`);
    await Deno.stat(new URL(wide.uri, root));
  }
});

Deno.test("nothing in her closet is confirmed on a vision pass alone", () => {
  assertEquals(inventory.items.length, 5);
  for (const item of inventory.items) {
    assertEquals(item.source, "photo");
    assertEquals(item.state, "candidate", `${item.id} was confirmed without the owner's word`);
    assert(item.evidence.note.length > 10, item.id);
    assert(item.palette.length > 0, item.id);
  }
});

Deno.test("the observed reading keeps the gaps out loud", () => {
  const reading = look.observed_reading;
  assert(reading.hair.includes("no up-do"));
  assert(reading.wardrobe.includes("burgundy oversized leather jacket"));
  assert(reading.what_it_does_not_show.includes("no footwear"));
  assertEquals(reading.treatment.includes("not a second look"), true);
});

Deno.test("every asset carries what was seen in it, with the model named", () => {
  const seen = look.assets.filter((a: any) => a.observed);
  assertEquals(seen.length, look.assets.length);
  for (const asset of seen) {
    assert(asset.observed.setting.length > 2, asset.file);
    assert(["colour", "black and white"].includes(asset.observed.treatment), asset.file);
  }
  assert(look.observed_reading.model.includes("gemma-4-31b-it"));
});
