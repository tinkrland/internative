// jewelry is a body-site object, not a slot.
//
// the earlier shape asked "is it a ring or a hoop", which is a shape and not a place. the
// questions a frame actually has to answer are where it sits and whether it is there
// tomorrow: a lobe earring and a helix earring are the same object on different holes,
// and a wedding band and a hoop earring are the same kind of promise and different ones
// of it.
//
// so a piece names a site path and a slot from wardrobe/sites.ts (ears/piercings + lobe +
// both, hands + ring + left), a material and a style, and one of two persistences:
//
//   fixed    she wears it always. must be in every frame of a series, and leaving her is
//            an event with a date.
//   styling  chosen per shot from what she owns.
//
// material keeps the legal rule where the law applies: 16 cfr 23 separates gold, gold
// plated and vermeil, so "gold" without a karat is refused and "gold coloured" is an
// appearance rather than a substance. clay and enamel keep no such rule, because there is
// no fineness to give.

import { digestOf, idProblems, lockProblems, movedFields, seedFrom, type Lock } from "../lock.ts";
import { plateProblems, type Plate } from "./module.ts";
import { siteProblems, type Side } from "./sites.ts";
import { materialProblems, styleBlock, styleProblems } from "./style.ts";

export type Persistence = "fixed" | "styling";

export const PERSISTENCE: Persistence[] = ["fixed", "styling"];

export interface JewelryPiece {
  id: string;
  name: string;
  // the noun and its dimension: signet ring, 8mm huggie, 2mm court band
  piece: string;
  // a path from sites.ts, a slot that path holds, and which side if it comes in twos
  site: string;
  slot: string;
  side?: Side;
  // "sterling silver", "18k yellow gold", "bronze clay"
  material: string;
  // minimal, chunky, colourful. one to three words.
  style: string[];
  worn: string;
  persistence: Persistence;
  avoid: string[];
  plates?: Plate[];
  plates_missing_reason?: string;
  retired?: { on: string; why: string };
}

export function jewelryProblems(item: JewelryPiece): string[] {
  const who = `jewelry "${item.id}"`;
  const problems: string[] = [];
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(item.id ?? "")) problems.push(`${who}: id is not a slug`);
  if (!PERSISTENCE.includes(item.persistence)) problems.push(`${who}: persistence must be fixed or styling`);
  if ((item.piece ?? "").trim().length < 3) problems.push(`${who}: piece required, because a ring and a cuff are different objects`);
  problems.push(...siteProblems(item.site, item.slot, item.side ?? "none", who));
  for (const problem of materialProblems(item.material)) problems.push(`${who}: ${problem}`);
  for (const problem of styleProblems(item.style)) problems.push(`${who}: ${problem}`);
  if ((item.worn ?? "").trim().length < 5) problems.push(`${who}: where it sits is required`);
  if ((item.avoid ?? []).length < 1) problems.push(`${who}: needs an avoid list, or the model adds a second stone`);
  if (!(item.plates ?? []).length && !(item.plates_missing_reason ?? "").trim()) {
    problems.push(`${who}: no reference plate and no reason given`);
  }
  for (const plate of item.plates ?? []) problems.push(...plateProblems(plate, item.id).map((p) => `${who}: ${p}`));
  if (item.retired) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.retired.on ?? "")) problems.push(`${who}: retirement date must be yyyy-mm-dd`);
    if ((item.retired.why ?? "").trim().length < 10) problems.push(`${who}: a fixed piece does not just leave, it needs a reason`);
  }
  return problems;
}

export function jewelryBlock(item: JewelryPiece): string {
  return [
    `piece: ${item.piece}`,
    styleBlock(item.material, item.style),
    `worn: ${item.worn}`,
  ].join("\n");
}

export interface JewelryLock extends Lock<JewelryPiece> {
  seed: number;
}

export async function lockJewelry(item: JewelryPiece, version = 1): Promise<JewelryLock> {
  const problems = [...idProblems(item.id, "jewelry"), ...jewelryProblems(item)];
  if (problems.length) throw new Error(`jewelry: cannot lock:\n  ${problems.join("\n  ")}`);
  const block = jewelryBlock(item);
  const digest = await digestOf({ kind: "jewelry", id: item.id, value: item });
  return { kind: "jewelry", id: item.id, version, digest, block, value: item, seed: seedFrom(digest) };
}

export function jewelryLockProblems(lock: JewelryLock): string[] {
  return [...lockProblems(lock, jewelryBlock), ...jewelryProblems(lock.value)];
}

// one fixed piece per hole, and never two pieces on the same hole at once. a lobe holds a
// hoop or a stud, not both, and two fixed pieces on one site is a mistake nobody discusses.
export function jewelrySetProblems(pieces: JewelryPiece[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const holes = new Map<string, number>();
  for (const piece of pieces) {
    if (ids.has(piece.id)) problems.push(`jewelry: "${piece.id}" is worn twice`);
    ids.add(piece.id);
    problems.push(...jewelryProblems(piece));
    const hole = `${piece.site}/${piece.slot}/${piece.side ?? "none"}`;
    holes.set(hole, (holes.get(hole) ?? 0) + 1);
  }
  for (const [hole, count] of holes) {
    if (count > 1) problems.push(`jewelry: ${count} pieces on ${hole}. one per hole, and two earrings need two sides`);
  }
  const fixedHoles = new Set<string>();
  for (const piece of pieces.filter((p) => p.persistence === "fixed")) {
    const hole = `${piece.site}/${piece.slot}/${piece.side ?? "none"}`;
    if (fixedHoles.has(hole)) problems.push(`jewelry: two fixed pieces on ${hole}`);
    fixedHoles.add(hole);
  }
  return problems;
}

// the series rule: a fixed piece cannot silently leave.
export function jewelrySeriesProblems(before: JewelryLock[], after: JewelryLock[]): string[] {
  const problems: string[] = [];
  const afterIds = new Set(after.map((lock) => lock.id));
  for (const lock of before) {
    if (lock.value.persistence !== "fixed") continue;
    if (afterIds.has(lock.id)) {
      const now = after.find((l) => l.id === lock.id)!;
      const moved = movedFields(
        lock.value as unknown as Record<string, unknown>,
        now.value as unknown as Record<string, unknown>,
        ["piece", "material", "style", "worn", "site", "slot", "side"],
      );
      if (moved.length) {
        problems.push(`jewelry "${lock.id}": the fixed piece changed (${moved.join(", ")}). a band that changes is a different band`);
      }
      continue;
    }
    if (!lock.value.retired) {
      problems.push(
        `jewelry "${lock.id}": the fixed piece is gone from this shot with no retirement recorded. ` +
          `it does not leave because the framing changed.`,
      );
    }
  }
  return problems;
}
