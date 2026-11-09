import { assertEquals } from "jsr:@std/assert@1";
import {
  anchorsFor,
  captionProblems,
  captureFrom,
  composeOutfit,
  confirmItem,
  inventoryProblems,
  isWearable,
  mixMatch,
  outfitDisclosure,
  parseInventory,
  placeAnchor,
  SOURCE_RULES,
  type ClosetItem,
  type Inventory,
} from "../media/inventory.ts";
import { outfitBlock } from "../persona/wardrobe.ts";

const authored = (id: string, layer: ClosetItem["layer"], detail: string, palette = ["#2b2b2b"]): ClosetItem => ({
  id,
  kind: layer === "footwear" ? "boot" : layer === "outer" ? "jacket" : "dress",
  detail,
  layer,
  palette,
  source: "authored",
  state: "confirmed",
});

const dress = authored("oxblood-slip", "base", "oxblood silk slip, mid calf");
const coat = authored("grey-wool", "outer", "charcoal wool overcoat, three quarter");
const boots = authored("black-boots", "footwear", "black leather ankle boots");
const shopDress: ClosetItem = {
  id: "ltk-slip",
  kind: "dress",
  detail: "pale gold satin slip",
  layer: "base",
  palette: ["#d9c9a0"],
  source: "ltk",
  state: "confirmed",
  ref: "https://shop.my.co/post/123",
};

const inventory: Inventory = {
  persona: "example",
  items: [dress, coat, boots, shopDress],
  media: [
    { id: "post-0912", surface: "static", shows: ["oxblood-slip", "black-boots"], place: "bathroom-mirror" },
    { id: "reel-0914", surface: "shortform", shows: ["oxblood-slip"] },
  ],
};

Deno.test("a shop window is not a closet, and only it needs a disclosure", () => {
  assertEquals(SOURCE_RULES.ltk.owned, false);
  assertEquals(SOURCE_RULES.ltk.needsDisclosure, true);
  assertEquals(SOURCE_RULES.whering.owned, true);
  assertEquals(SOURCE_RULES.whering.needsDisclosure, false);
  assertEquals(SOURCE_RULES.photo.needsConfirm, true);
  assertEquals(inventoryProblems(inventory), []);
});

Deno.test("a captured garment is a candidate until someone names it and its colours", () => {
  const captured = captureFrom({ id: "coat-photo", source: "photo", layer: "outer", ref: "incoming_files/coat.jpg" });
  assertEquals(captured.state, "candidate");
  assertEquals(captured.detail, "");
  assertEquals(isWearable(captured), false);

  const bare = confirmItem(captured, { kind: "coat", detail: "", palette: [] });
  assertEquals(bare.problems.length, 2, "flipping the state is not confirming");
  assertEquals(bare.item, undefined);

  const named = confirmItem(captured, { kind: "coat", detail: "camel wool wrap coat, belted", palette: ["#c19a6b"] });
  assertEquals(named.problems, []);
  assertEquals(named.item?.state, "confirmed");
  assertEquals(isWearable(named.item!), true);
  assertEquals(named.item?.ref, "incoming_files/coat.jpg", "the reference survives the confirmation");
});

Deno.test("a candidate in the mix is refused, with the reason said plainly", () => {
  const captured = captureFrom({ id: "coat-photo", source: "photo", layer: "outer", ref: "x.jpg" });
  const result = composeOutfit("monday", "monday", [dress, captured]);
  assertEquals(result.outfit, undefined);
  assertEquals(result.problems.some((p) => p.includes("cannot be worn until it is confirmed")), true);
});

Deno.test("two dresses are refused, and a coat over a dress is not", () => {
  const twoBases = composeOutfit("bad", "bad", [dress, shopDress]);
  assertEquals(twoBases.problems.some((p) => p.includes("base layer")), true);
  const layered = composeOutfit("good", "good", [dress, coat, boots]);
  assertEquals(layered.problems, []);
  assertEquals(layered.outfit?.garments.length, 3);
});

Deno.test("an outfit composes into the wardrobe shape a shot plan already reads", () => {
  const result = composeOutfit("thursday", "thursday", [dress, coat, boots]);
  const block = outfitBlock(result.outfit!);
  assertEquals(block.includes("oxblood silk slip, mid calf"), true);
  assertEquals(block.includes("palette:"), true);
});

Deno.test("mixing her own pieces with a shop look is allowed, and the caption pays for it", () => {
  const mixed = composeOutfit("mixed", "mixed", [shopDress, boots]);
  assertEquals(mixed.problems, []);
  const disclosure = outfitDisclosure([shopDress, boots]);
  assertEquals(Boolean(disclosure), true);

  const silent = captionProblems("my closet, on a tuesday", [shopDress, boots]);
  assertEquals(silent.some((p) => p.includes("has to carry the disclosure")), true);
  assertEquals(silent.some((p) => p.includes("claims ownership")), true);

  const honest = captionProblems(`satin and boots. ${disclosure!}`, [shopDress, boots]);
  assertEquals(honest, []);
  assertEquals(captionProblems("my closet, on a tuesday", [dress, boots]), []);
});

Deno.test("the picture that already exists anchors the next series", () => {
  const anchored = anchorsFor(inventory, [dress, boots]);
  assertEquals(anchored.ref?.id, "post-0912");
  assertEquals(anchored.coverage, 1);
  assertEquals(anchored.missing, []);

  const partial = anchorsFor(inventory, [dress, coat, boots]);
  assertEquals(partial.ref?.id, "post-0912");
  assertEquals(Math.round(partial.coverage * 100), 67);
  assertEquals(partial.missing, ["grey-wool"]);

  const nothing = anchorsFor(inventory, [coat]);
  assertEquals(nothing.coverage, 0);
  assertEquals(nothing.ref, undefined);
});

Deno.test("a place is anchored by the photo that shows it", () => {
  assertEquals(placeAnchor(inventory, "bathroom-mirror")?.id, "post-0912");
  assertEquals(placeAnchor(inventory, "car-interior"), undefined);
});

Deno.test("mix and match only ever returns things she can actually wear", () => {
  const combos = mixMatch(inventory, { fills: ["base", "footwear"], cap: 8 });
  assertEquals(combos.length, 2, "two bases times one boot");
  for (const combo of combos) {
    assertEquals(combo.every(isWearable), true);
    const bases = combo.filter((i) => i.layer === "base");
    assertEquals(bases.length, 1);
  }
  const capped = mixMatch(inventory, { fills: ["base", "footwear"], cap: 2 });
  assertEquals(capped.length, 2);
});

Deno.test("a season rules out what cannot be worn in it, and an empty pool is empty", () => {
  const summerOnly: ClosetItem = { ...authored("linen", "base", "washed linen dress"), seasons: ["warm"] };
  const cold = mixMatch({ ...inventory, items: [summerOnly] }, { fills: ["base"], season: "cold" });
  assertEquals(cold, []);
  const warm = mixMatch({ ...inventory, items: [summerOnly] }, { fills: ["base"], season: "warm" });
  assertEquals(warm.length, 1);
});

Deno.test("two items sharing an id, or a media ref showing a stranger, are refused", () => {
  const broken: Inventory = {
    persona: "example",
    items: [dress, { ...dress }],
    media: [{ id: "post-x", surface: "static", shows: ["ghost-item"] }],
  };
  const problems = inventoryProblems(broken);
  assertEquals(problems.some((p) => p.includes("two items share an id")), true);
  assertEquals(problems.some((p) => p.includes("not in the closet")), true);
});

Deno.test("the example closet loads, and only the photo capture is unfinished", () => {
  const src = Deno.readTextFileSync("personas/example.inventory.jsonc");
  const inv = parseInventory(src);
  assertEquals(inventoryProblems(inv), []);
  const pending = inv.items.filter((i) => i.state === "candidate");
  assertEquals(pending.map((i) => i.id), ["gold-slip-photo"]);
  assertEquals(pending[0].source, "photo");
  assertEquals(inv.items.filter((i) => i.source === "ltk").length, 1);
  assertEquals(inv.media.filter((m) => m.place).length, 1);
});
