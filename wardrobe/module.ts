// the wardrobe, as something a model cannot quietly restyle.
//
// persona/wardrobe.ts on the head decides WHAT she is wearing: an outfit is a list
// of garments with a palette, chosen for the day. it is prose about clothes, and
// prose is exactly the thing a diffusion model is free to interpret. this module is
// the other half: a garment sealed into a lock, with the reference plates that carry
// its look, and a digest that notices the day somebody retypes it.
//
// WHY THIS SHAPE, from what practitioners actually report (2026): text alone cannot
// hold a garment. reference-image conditioning (IP-Adapter class adapters, and the
// reference fields the video providers accept) is what holds a print, a lapel and a
// button; per-garment LoRA training holds more, at the cost of one trained artifact
// per garment and its own licence. so the default here is text lock plus reference
// plates, and a garment with no plate is allowed only if it says out loud that it has
// none. that is the honest version of "we will photograph it later".
//
// what a lock buys an autonomous run: the block is DERIVED from the value (see
// ../lock.ts), so a scheduled shoot regenerating its prompt an hour from now emits
// byte-identical text, and the seed is the digest, so the same world reproduces the
// same frame instead of approximating it.

import { digestOf, idProblems, lockProblems, movedFields, seedFrom, type Lock } from "../lock.ts";

export type Slot = "base" | "mid" | "outer" | "footwear" | "headwear" | "accessory";

// fixed, and it is a look order rather than an alphabetical one: what sits against
// the body is described before what sits over it.
export const SLOT_ORDER: Slot[] = ["base", "mid", "outer", "footwear", "headwear", "accessory"];

// one plate per way a garment is seen. flat is what holds the print and the colour,
// worn is what holds the fit, detail is what holds a button or a seam.
export type PlateRole = "flat" | "worn" | "detail";

export interface Plate {
  id: string;
  uri: string;
  role: PlateRole;
}

export interface Colour {
  name: string;
  hex: string;
}

export interface GarmentItem {
  id: string;
  name: string;
  slot: Slot;
  // the noun the model draws: overcoat, wide-leg trouser, boot
  kind: string;
  fabric: string;
  colour: Colour;
  fit: string;
  // the things that would be guessed wrong. fewer than three and the model invents.
  details: string[];
  // required: a garment that refuses nothing drifts into a different garment
  avoid: string[];
  season: "warm" | "cold" | "any";
  // where the garment came from, in the head's vocabulary: hers, a shop window, a capture
  source: "authored" | "closet" | "captured";
  plates: Plate[];
  // a garment with no plate is a promise, not evidence. saying so is what makes it
  // allowed at all, and it is refused for a locked series.
  plates_missing_reason?: string;
}

export const MIN_DETAILS = 3;
export const MIN_AVOID = 1;
const HEX = /^#[0-9a-f]{6}$/i;

export function plateProblems(plate: Plate, item: string): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9_-]+$/.test(plate.id ?? "")) problems.push(`${item}: plate "${plate.id}" is not a slug`);
  if (!["flat", "worn", "detail"].includes(plate.role)) problems.push(`${item}.${plate.id}: role must be flat, worn or detail`);
  if (!/^(https?:\/\/|\.{0,2}\/|assets\/)/.test(plate.uri ?? "")) {
    problems.push(`${item}.${plate.id}: "${plate.uri}" is not a path or url`);
  }
  return problems;
}

export function itemProblems(item: GarmentItem): string[] {
  const problems: string[] = [];
  const who = item.id || "?";
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(item.id ?? "")) problems.push(`${who}: id must be a slug`);
  if (!SLOT_ORDER.includes(item.slot)) problems.push(`${who}: slot must be one of ${SLOT_ORDER.join(", ")}`);
  if ((item.name ?? "").trim().length < 3) problems.push(`${who}: name required`);
  if ((item.kind ?? "").trim().length < 3) problems.push(`${who}: kind is the noun the model draws`);
  if ((item.fabric ?? "").trim().length < 3) problems.push(`${who}: fabric required, and "nice" is not a fabric`);
  if ((item.colour?.name ?? "").trim().length < 3) problems.push(`${who}: colour name required`);
  if (!HEX.test(item.colour?.hex ?? "")) problems.push(`${who}: colour hex must be #rrggbb`);
  if ((item.fit ?? "").trim().length < 3) problems.push(`${who}: fit required, because a garment that fits anything fits nobody`);
  const details = (item.details ?? []).map((d) => d.trim()).filter(Boolean);
  if (details.length < MIN_DETAILS) {
    problems.push(`${who}: ${details.length} details, needs ${MIN_DETAILS}. a garment with fewer is a colour and a hope`);
  }
  for (const detail of details) if (detail.length < 3) problems.push(`${who}: detail "${detail}" says nothing`);
  if ((item.avoid ?? []).length < MIN_AVOID) problems.push(`${who}: avoid list required`);
  if (!["warm", "cold", "any"].includes(item.season)) problems.push(`${who}: season must be warm, cold or any`);
  if (!["authored", "closet", "captured"].includes(item.source)) problems.push(`${who}: source must be authored, closet or captured`);
  for (const plate of item.plates ?? []) problems.push(...plateProblems(plate, who));
  const seen = new Set<string>();
  for (const plate of item.plates ?? []) {
    if (seen.has(plate.role)) problems.push(`${who}: two ${plate.role} plates, so which one is the garment`);
    seen.add(plate.role);
  }
  if ((item.plates ?? []).length === 0 && !(item.plates_missing_reason ?? "").trim()) {
    problems.push(`${who}: no reference plate and no reason given. text alone cannot hold a lapel`);
  }
  return problems;
}

// the verbatim text. labelled lines, fixed order, no sentence for a model to drop.
export function itemBlock(item: GarmentItem): string {
  const lines = [
    `${item.slot}: ${item.colour.name} ${item.fabric} ${item.kind}`,
    `fit: ${item.fit}`,
    `details: ${item.details.join("; ")}`,
    `avoid: ${item.avoid.join("; ")}`,
  ];
  return lines.join("\n");
}

// one base garment at least, because an outfit with no base is a coat over nothing.
export function slotProblems(items: GarmentItem[]): string[] {
  const problems: string[] = [];
  if (!items?.length) return ["outfit: no garments, which is not an outfit"];
  const counts = new Map<Slot, string[]>();
  for (const item of items) counts.set(item.slot, [...(counts.get(item.slot) ?? []), item.id]);
  if (!counts.has("base")) problems.push("outfit: no base layer, so a jacket is being worn over nothing");
  for (const slot of ["base", "mid", "outer", "footwear", "headwear"] as Slot[]) {
    const ids = counts.get(slot) ?? [];
    if (ids.length > 1) problems.push(`outfit: ${ids.length} ${slot} garments (${ids.join(", ")}), one can be on the body`);
  }
  return problems;
}

export function outfitProblems(items: GarmentItem[]): string[] {
  const problems = slotProblems(items);
  const seen = new Set<string>();
  for (const item of items ?? []) {
    for (const p of itemProblems(item)) problems.push(p);
    if (seen.has(item.id)) problems.push(`${item.id}: the same garment twice`);
    seen.add(item.id);
  }
  return problems;
}

export function outfitBlock(items: GarmentItem[]): string {
  return [...items]
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.id.localeCompare(b.id))
    .map(itemBlock)
    .join("\n");
}

export interface OutfitValue {
  outfit: string;
  items: GarmentItem[];
}

export interface OutfitLock extends Lock<OutfitValue> {
  kind: "wardrobe";
  seed: number;
}

// seal an outfit. the value carries the whole garments, not their ids, so the lock
// can be read and rebuilt a year from now without the closet it came from.
export async function lockOutfit(
  outfit: string,
  items: GarmentItem[],
  version = 1,
): Promise<OutfitLock> {
  const problems = [...idProblems(outfit, "wardrobe"), ...outfitProblems(items)];
  if (problems.length) throw new Error(`wardrobe: cannot lock:\n  ${problems.join("\n  ")}`);
  const value: OutfitValue = { outfit, items: [...items] };
  const digest = await digestOf({ kind: "wardrobe", id: outfit, value });
  return { kind: "wardrobe", id: outfit, version, digest, block: outfitBlock(value.items), value, seed: seedFrom(digest) };
}

export function outfitLockProblems(lock: OutfitLock): string[] {
  return [...lockProblems(lock, (value) => outfitBlock(value.items)), ...outfitProblems(lock.value.items)];
}

// what changed between two outfits, by garment. an auditor wants names, not a boolean.
export function outfitDrift(before: OutfitLock, after: OutfitLock): string[] {
  const index = (lock: OutfitLock) => new Map(lock.value.items.map((item) => [item.id, item]));
  const was = index(before);
  const now = index(after);
  const moved: string[] = [];
  for (const id of was.keys()) if (!now.has(id)) moved.push(`removed:${id}`);
  for (const [id, item] of now) {
    const previous = was.get(id);
    if (!previous) {
      moved.push(`added:${id}`);
      continue;
    }
    const fields = movedFields(
      previous as unknown as Record<string, unknown>,
      item as unknown as Record<string, unknown>,
      ["kind", "fabric", "colour", "fit", "details", "avoid", "slot"],
    );
    if (fields.length) moved.push(`changed:${id}(${fields.join(",")})`);
  }
  if (before.value.outfit !== after.value.outfit) moved.push(`renamed:${before.value.outfit}->${after.value.outfit}`);
  return moved;
}

export function palette(lock: OutfitLock): string[] {
  return [...new Set(lock.value.items.map((item) => item.colour.hex))];
}
