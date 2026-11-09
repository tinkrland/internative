// everything on a site that is neither a device nor jewelry: a beanie, a bandana, a
// scrunchie, sunglasses, a belt, a tote, a scarf.
//
// these were the items the old "accessory" slot swallowed, and they are not one kind of
// thing either. a beanie is warmth and nearly always the same beanie. sunglasses are
// prescription or fashion and those are two different commitments. a belt is the only
// thing holding a waist line together, and a tote is carried for a season.
//
// so each one names a site path and slot from sites.ts, a material and a style, and a
// persistence, and the occupancy rule catches the pair of beanies before a render does.

import { digestOf, idProblems, lockProblems, movedFields, seedFrom, type Lock } from "../lock.ts";
import { plateProblems, type Colour, type Plate } from "./module.ts";
import { siteProblems, type Side } from "./sites.ts";
import { materialProblems, styleBlock, styleProblems } from "./style.ts";

export interface WornItem {
  id: string;
  name: string;
  // the noun: beanie, bandana, scrunchie, clip, tote, belt, scarf, sunglasses
  kind: string;
  site: string;
  slot: string;
  side?: Side;
  material: string;
  style: string[];
  colour?: Colour;
  worn: string;
  // a beanie she wears every winter is fixed. a tote is not.
  persistence: "styling" | "fixed";
  avoid: string[];
  plates?: Plate[];
  plates_missing_reason?: string;
  // a brand and a model, when the object has one that reads in a photo
  make?: string;
  model?: string;
}

export function wornProblems(item: WornItem): string[] {
  const who = `worn "${item.id}"`;
  const problems: string[] = [];
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(item.id ?? "")) problems.push(`${who}: id is not a slug`);
  if ((item.kind ?? "").trim().length < 3) problems.push(`${who}: kind required`);
  problems.push(...siteProblems(item.site, item.slot, item.side ?? "none", who));
  if (item.kind && item.slot && item.kind.trim().toLowerCase() === item.slot && !(item.name ?? "").trim()) {
    problems.push(`${who}: a kind that only repeats the slot leaves nothing to draw`);
  }
  for (const problem of materialProblems(item.material)) problems.push(`${who}: ${problem}`);
  for (const problem of styleProblems(item.style)) problems.push(`${who}: ${problem}`);
  if ((item.worn ?? "").trim().length < 5) problems.push(`${who}: how it sits is required, pulled to the brow is not worn`);
  if (!["styling", "fixed"].includes(item.persistence)) problems.push(`${who}: persistence must be styling or fixed`);
  if ((item.avoid ?? []).length < 1) problems.push(`${who}: needs an avoid list, or the model adds a pom pom`);
  if (!(item.plates ?? []).length && !(item.plates_missing_reason ?? "").trim()) {
    problems.push(`${who}: no reference plate and no reason given`);
  }
  for (const plate of item.plates ?? []) problems.push(...plateProblems(plate, item.id).map((p) => `${who}: ${p}`));
  if (item.model && !item.make) problems.push(`${who}: a model without a make is half an object`);
  return problems;
}

export function wornBlock(item: WornItem): string {
  const named = item.make && item.model ? `${item.make} ${item.model}, ${item.name}` : item.name;
  const colour = item.colour ? `, ${item.colour.name}` : "";
  return [`${item.slot}: ${named}${colour}, ${item.kind}`, styleBlock(item.material, item.style), `worn: ${item.worn}`].join("\n");
}

export interface WornLock extends Lock<WornItem> {
  seed: number;
}

export async function lockWorn(item: WornItem, version = 1): Promise<WornLock> {
  const problems = [...idProblems(item.id, "wardrobe"), ...wornProblems(item)];
  if (problems.length) throw new Error(`worn: cannot lock:\n  ${problems.join("\n  ")}`);
  const block = wornBlock(item);
  const digest = await digestOf({ kind: "worn", id: item.id, value: item });
  return { kind: "wardrobe", id: item.id, version, digest, block, value: item, seed: seedFrom(digest) };
}

export function wornLockProblems(lock: WornLock): string[] {
  return [...lockProblems(lock, wornBlock), ...wornProblems(lock.value)];
}

// a fixed site item cannot silently change or leave, for the same reason a wedding band
// cannot: the beanie is part of how she looks in january.
export function wornSeriesProblems(before: WornLock[], after: WornLock[]): string[] {
  const problems: string[] = [];
  const afterIds = new Set(after.map((lock) => lock.id));
  for (const lock of before) {
    if (lock.value.persistence !== "fixed") continue;
    if (!afterIds.has(lock.id)) {
      problems.push(`worn "${lock.id}": a fixed ${lock.value.slot} is gone from this shot with no reason recorded`);
      continue;
    }
    const now = after.find((l) => l.id === lock.id)!;
    const moved = movedFields(
      lock.value as unknown as Record<string, unknown>,
      now.value as unknown as Record<string, unknown>,
      ["kind", "material", "style", "colour", "worn", "site", "slot", "side"],
    );
    if (moved.length) problems.push(`worn "${lock.id}": a fixed ${lock.value.slot} changed (${moved.join(", ")})`);
  }
  return problems;
}
