// the closet as an inventory with provenance.
//
// wardrobe.jsonc answers "what is she wearing today". this answers the question
// underneath it: where did the thing come from, is it hers, and does the post have
// to say so. that matters because the pieces arrive from four different places and
// two of them are shop windows.
//
// neither whering nor ltk publishes an api a creator can read their own closet
// through, so nothing here is an integration. it is a capture: a screenshot, a
// pasted look url, a photo. captured things arrive as pixels, and pixels do not
// know what a garment is called or what fibre it is, so a capture is a candidate
// until a person writes the two fields a render actually needs.

import type { MediaSurface } from "./paths.ts";
import { type Outfit } from "../persona/wardrobe.ts";
import { stripJsonc } from "../persona/loader.ts";

export type ItemSource = "authored" | "whering" | "ltk" | "photo";
export type ItemState = "confirmed" | "candidate";
export type Layer = "base" | "mid" | "outer" | "footwear" | "accessory";

export const LAYERS: Layer[] = ["base", "mid", "outer", "footwear", "accessory"];
// one base, one outer, one pair of shoes. a second mid layer is a coat over a
// cardigan and fine; a second base layer is two dresses.
export const EXCLUSIVE_LAYERS: Layer[] = ["base", "outer", "footwear"];

export interface SourceRule {
  owned: boolean;
  needsConfirm: boolean;
  needsDisclosure: boolean;
  how: string;
  why: string;
}

export const SOURCE_RULES: Record<ItemSource, SourceRule> = {
  authored: {
    owned: true,
    needsConfirm: false,
    needsDisclosure: false,
    how: "written into the wardrobe file by hand",
    why: "an authored outfit is the only one that needs no evidence at all",
  },
  whering: {
    owned: true,
    needsConfirm: true,
    needsDisclosure: false,
    how: "screenshot or photo of an item from the closet app",
    why: "it is her closet, but the app has no api, so the item is a caption someone has to write",
  },
  ltk: {
    owned: false,
    needsConfirm: true,
    needsDisclosure: true,
    how: "pasted look url or screenshot of the shop page",
    why: "a look is a shop window: the pieces are for sale, not in her closet, and the post has to say so",
  },
  photo: {
    owned: true,
    needsConfirm: true,
    needsDisclosure: false,
    how: "a photo she already has, of the garment or of the room",
    why: "a photo is the best evidence of what a thing looks like and the worst evidence of what it is called",
  },
};

export interface MediaRef {
  id: string;
  surface: MediaSurface;
  // the inventory item ids this posted picture shows. this is what lets a later
  // series anchor to a real photograph instead of re-inventing her.
  shows: string[];
  place?: string;
  url?: string;
}

export interface ClosetItem {
  id: string;
  kind: string;
  // the authored phrase that goes into the outfit block. candidates do not have
  // one, on purpose: that is the difference between captured and known.
  detail: string;
  layer: Layer;
  palette: string[];
  source: ItemSource;
  state: ItemState;
  ref?: string;
  seasons?: Array<"warm" | "cold">;
  notes?: string;
}

export interface Inventory {
  persona: string;
  items: ClosetItem[];
  media: MediaRef[];
}

export function parseInventory(src: string): Inventory {
  return JSON.parse(stripJsonc(src)) as Inventory;
}

export function isWearable(item: ClosetItem): boolean {
  return item.state === "confirmed" && item.detail.trim().length >= 3 && item.palette.length > 0;
}

export function itemProblems(item: ClosetItem): string[] {
  const problems: string[] = [];
  const rule = SOURCE_RULES[item.source];
  if (!/^[a-z0-9_-]+$/.test(item.id ?? "")) problems.push(`${item.id || "?"}: id must be a lowercase slug`);
  // a capture is allowed to arrive without a name or a colour. those are the two
  // fields a person has to write before it can be worn, not defects on arrival.
  if (item.state === "confirmed" && !item.kind?.trim()) problems.push(`${item.id}: confirmed with no kind, so nothing says what it is`);
  if (!LAYERS.includes(item.layer)) problems.push(`${item.id}: layer "${item.layer}" is not one of ${LAYERS.join(", ")}`);
  if (!rule) problems.push(`${item.id}: source "${item.source}" is not a place a garment can come from`);
  if (item.state === "confirmed" && item.detail.trim().length < 3) {
    problems.push(`${item.id}: confirmed with no authored detail, which is a garment nobody can render`);
  }
  if (item.state === "confirmed" && item.palette.length === 0) {
    problems.push(`${item.id}: confirmed with no palette, so the render would invent her colours`);
  }
  if (item.state === "confirmed" && rule?.needsConfirm && !item.ref) {
    problems.push(`${item.id}: captured and confirmed with no reference, so nothing can check the claim later`);
  }
  if (rule && rule.owned === false && item.notes?.toLowerCase().includes("mine")) {
    problems.push(`${item.id}: comes from a shop window and is described as hers`);
  }
  return problems;
}

export function inventoryProblems(inv: Inventory): string[] {
  const problems: string[] = [];
  if (!inv.persona?.trim()) problems.push("persona: required");
  if (!inv.items?.length) problems.push("items: an empty closet is a persona with nothing to wear");
  const seen = new Set<string>();
  for (const item of inv.items ?? []) {
    if (seen.has(item.id)) problems.push(`${item.id}: two items share an id`);
    seen.add(item.id);
    problems.push(...itemProblems(item));
  }
  for (const ref of inv.media ?? []) {
    if (!ref.shows?.length && !ref.place) problems.push(`${ref.id}: says nothing about what it shows`);
    for (const shown of ref.shows ?? []) {
      if (!seen.has(shown)) problems.push(`${ref.id}: shows "${shown}", which is not in the closet`);
    }
  }
  return problems;
}

// a capture, before anyone has said what it is. the two empty fields are the work.
export function captureFrom(opts: {
  id: string;
  source: Exclude<ItemSource, "authored">;
  layer: Layer;
  ref: string;
  kind?: string;
  paletteGuess?: string[];
  seasons?: Array<"warm" | "cold">;
}): ClosetItem {
  return {
    id: opts.id,
    kind: (opts.kind ?? "").trim(),
    detail: "",
    layer: opts.layer,
    palette: opts.paletteGuess ?? [],
    source: opts.source,
    state: "candidate",
    ref: opts.ref,
    seasons: opts.seasons,
  };
}

// the human step. flipping the state is not confirming: confirming means naming
// the garment and its colours, because those are the two things a photo cannot
// tell a render and a writer cannot guess.
export function confirmItem(
  item: ClosetItem,
  authored: { kind: string; detail: string; palette: string[] },
): { item?: ClosetItem; problems: string[] } {
  const problems: string[] = [];
  if (authored.kind.trim().length < 2) problems.push(`${item.id}: confirming needs a kind`);
  if (authored.detail.trim().length < 3) problems.push(`${item.id}: confirming needs a detail a render can use`);
  if (authored.palette.length === 0) problems.push(`${item.id}: confirming needs at least one colour`);
  if (item.source !== "authored" && !item.ref) problems.push(`${item.id}: captured, so confirming keeps the reference`);
  if (problems.length) return { problems };
  return {
    problems: [],
    item: {
      ...item,
      kind: authored.kind.trim(),
      detail: authored.detail.trim(),
      palette: authored.palette,
      state: "confirmed",
    },
  };
}

export interface ComposeResult {
  outfit?: Outfit;
  problems: string[];
}

// a shelf of items becomes an outfit. the layers are what stop a mix and match
// from putting two dresses on one person.
export function composeOutfit(id: string, name: string, items: ClosetItem[]): ComposeResult {
  const problems: string[] = [];
  for (const item of items) {
    if (!isWearable(item)) {
      problems.push(`${item.id} is ${item.state === "candidate" ? "a candidate" : "incomplete"}: a captured garment cannot be worn until it is confirmed`);
    }
  }
  const byLayer = new Map<Layer, ClosetItem[]>();
  for (const item of items) byLayer.set(item.layer, [...(byLayer.get(item.layer) ?? []), item]);
  for (const layer of EXCLUSIVE_LAYERS) {
    const stack = byLayer.get(layer) ?? [];
    if (stack.length > 1) problems.push(`${id}: ${stack.map((i) => i.id).join(" and ")} both want the ${layer} layer`);
  }
  if ((byLayer.get("base") ?? []).length === 0) problems.push(`${id}: no base layer, and a person cannot be dressed in accessories`);
  if (problems.length) return { problems };

  const garmentLayers: Layer[] = ["base", "mid", "outer", "footwear"];
  const garments = items.filter((i) => garmentLayers.includes(i.layer));
  const accessories = items.filter((i) => i.layer === "accessory");
  const palette = [...new Set(items.flatMap((i) => i.palette))];
  return {
    problems: [],
    outfit: {
      id,
      name,
      garments: garments.map((i) => ({ kind: i.kind, detail: i.detail })),
      palette,
      accessories: accessories.length ? accessories.map((i) => `${i.kind} in ${i.detail}`) : undefined,
    },
  };
}

// mixing her own pieces with a look she saw is normal fashion content. what is not
// normal is letting the post imply the shop window is her closet.
export function outfitDisclosure(items: ClosetItem[]): string | null {
  const borrowed = items.filter((i) => SOURCE_RULES[i.source]?.needsDisclosure);
  if (!borrowed.length) return null;
  return `some pieces here are affiliate links from a look she liked, not things she owns: ${borrowed
    .map((i) => i.kind)
    .join(", ")}.`;
}

const OWNERSHIP_CLAIMS = [/\bmy closet\b/i, /\bmine\b/i, /\bwhat i own\b/i, /\bfrom my wardrobe\b/i];

export function captionProblems(caption: string, items: ClosetItem[]): string[] {
  const problems: string[] = [];
  const disclosure = outfitDisclosure(items);
  if (disclosure && !caption.includes(disclosure)) {
    problems.push("this look contains pieces she does not own, so the caption has to carry the disclosure");
  }
  if (disclosure) {
    for (const claim of OWNERSHIP_CLAIMS) {
      if (claim.test(caption)) problems.push(`"${caption.match(claim)?.[0]}" claims ownership of something from a shop window`);
    }
  }
  return problems;
}

export interface AnchorReport {
  ref?: MediaRef;
  coverage: number;
  missing: string[];
}

// the picture that already exists is a better reference than a new one. a series
// anchored to a posted photo stays the same person; a series with no anchor is a
// new invention wearing her name.
export function anchorsFor(inv: Inventory, items: ClosetItem[]): AnchorReport {
  const wanted = items.map((i) => i.id);
  const scored = (inv.media ?? [])
    .map((ref) => {
      const shown = wanted.filter((id) => ref.shows.includes(id));
      return { ref, shown };
    })
    .sort((a, b) => b.shown.length - a.shown.length);
  const best = scored[0];
  if (!best || best.shown.length === 0) return { coverage: 0, missing: wanted };
  return {
    ref: best.ref,
    coverage: best.shown.length / Math.max(wanted.length, 1),
    missing: wanted.filter((id) => !best.shown.includes(id)),
  };
}

export function placeAnchor(inv: Inventory, place: string): MediaRef | undefined {
  return (inv.media ?? []).find((ref) => ref.place === place);
}

export interface MixOptions {
  fills?: Layer[];
  season?: "warm" | "cold";
  cap?: number;
}

// every combination a person could plausibly walk out of the closet in, capped so
// a wish list does not become a combinatorial explosion.
export function mixMatch(inv: Inventory, opts: MixOptions = {}): ClosetItem[][] {
  const fills = opts.fills ?? ["base", "outer", "footwear"];
  const cap = opts.cap ?? 24;
  const usable = (inv.items ?? []).filter((item) => {
    if (!isWearable(item)) return false;
    if (!opts.season) return true;
    return !item.seasons?.length || item.seasons.includes(opts.season);
  });
  const pools = fills.map((layer) => usable.filter((item) => item.layer === layer));
  // an accessory is optional, so it never blocks a combination. everything else
  // has to be asked for by name, or a coat starts arriving with a summer dress.
  const extras = usable.filter((item) => item.layer === "accessory");
  if (pools.some((pool) => pool.length === 0)) return [];
  let combos: ClosetItem[][] = [[]];
  for (const pool of pools) {
    combos = combos.flatMap((combo) => pool.map((item) => [...combo, item]));
    if (combos.length > cap) break;
  }
  combos = combos.slice(0, cap);
  const withExtras = combos.map((combo) => [...combo, ...extras.filter((extra) => extra.layer === "accessory")]);
  return withExtras;
}
