// jewelry splits along the same line as the phone and its case.
//
// a wedding band is on her in every frame, for years, and a series that loses it has
// lost a fact. earrings are styling: they change with the outfit and nobody notices.
// so a piece declares which it is, and the declaration is load bearing rather than
// decorative:
//
//   fixed    a band she wears always. must be in every shot of a series, and leaving
//            her hand is an event with a date, not a drift.
//   styling  earrings, a cuff, a pendant. chosen per shot from the pieces she owns.
//
// metal and stone are required and named, because "gold" and "gold coloured" and
// "brass" render as three different pieces under a warm key light.

import { digestOf, idProblems, lockProblems, movedFields, seedFrom, type Lock } from "../lock.ts";
import { plateProblems, type Plate } from "./module.ts";

export type Persistence = "fixed" | "styling";

export const PERSISTENCE: Persistence[] = ["fixed", "styling"];

// where a piece sits. one fixed piece per site: two wedding bands on one finger is not
// a richer description, it is a rendering bug waiting for a wide shot.
export type Site = "finger" | "wrist" | "neck" | "ear" | "ankle";

export const SITES: Site[] = ["finger", "wrist", "neck", "ear", "ankle"];

export interface JewelryPiece {
  id: string;
  name: string;
  // the noun: signet ring, huggie hoop, curb chain, cuff
  piece: string;
  metal: string;
  // "none" is a real answer and must be said out loud
  stone: string;
  site: Site;
  worn: string;
  persistence: Persistence;
  avoid: string[];
  plates?: Plate[];
  plates_missing_reason?: string;
  // when a fixed piece leaves her, it is an event like a device upgrade
  retired?: { on: string; why: string };
}

// 16 CFR part 23 exists because "gold coloured" and "gold" are different products and
// saying the wrong one is illegal, not merely imprecise: vermeil is sterling silver
// plated with gold of at least 10 karat fineness (23.4), and gold plated, gold filled and
// gold overlay are each defined separately (23.3). a description that says "gold" without
// a karat has told a renderer something and a buyer nothing.
const VAGUE_METAL = /\b(gold[- ]?colou?red|gold[- ]?tone|golden|silver[- ]?colou?red|silver[- ]?tone|precious metal|mixed metal|metal)\b/i;
const FINENESS = /\b(\d{1,2}\s?(k|kt|karat)|925|950|sterling|plated|plate|filled|overlay|vermeil|brass|bronze|copper|steel|titanium|niobium|pewter)\b/i;

export function metalProblems(metal: string): string[] {
  const text = (metal ?? "").trim();
  if (text.length < 3) return ["metal required and named, because \"gold coloured\" is not gold"];
  const problems: string[] = [];
  if (VAGUE_METAL.test(text)) {
    problems.push(
      `metal "${text}" names an appearance, not a material. 16 cfr 23 treats gold, gold plated and vermeil as three products, so the line has to name one`,
    );
  }
  if (/\b(gold|silver)\b/i.test(text) && !FINENESS.test(text)) {
    problems.push(
      `metal "${text}" has no karat or alloy. gold without a fineness is the vaguest word in the sentence (16 cfr 23.3, 23.4)`,
    );
  }
  return problems;
}

export function jewelryProblems(item: JewelryPiece): string[] {
  const who = `jewelry "${item.id}"`;
  const problems: string[] = [];
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(item.id ?? "")) problems.push(`${who}: id is not a slug`);
  if (!PERSISTENCE.includes(item.persistence)) problems.push(`${who}: persistence must be fixed or styling`);
  if (!SITES.includes(item.site)) problems.push(`${who}: site must be one of ${SITES.join(", ")}`);
  if ((item.piece ?? "").trim().length < 3) problems.push(`${who}: piece required, because a ring and a cuff are different objects`);
  for (const problem of metalProblems(item.metal)) problems.push(`${who}: ${problem}`);
  if ((item.stone ?? "").trim().length < 2) problems.push(`${who}: stone required, say none when there is none`);
  if ((item.worn ?? "").trim().length < 5) problems.push(`${who}: where it is worn is required`);
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
    `metal: ${item.metal}`,
    `stone: ${item.stone}`,
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

// one fixed piece per site, and no two pieces on the same site wearing the same slot.
export function jewelrySetProblems(pieces: JewelryPiece[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const piece of pieces) {
    if (ids.has(piece.id)) problems.push(`jewelry: "${piece.id}" is worn twice`);
    ids.add(piece.id);
    problems.push(...jewelryProblems(piece));
  }
  const fixedSites = new Set<string>();
  for (const piece of pieces.filter((p) => p.persistence === "fixed")) {
    if (fixedSites.has(piece.site)) {
      problems.push(`jewelry: two fixed pieces on the ${piece.site}. one of them is a mistake nobody would discuss`);
    }
    fixedSites.add(piece.site);
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
        ["piece", "metal", "stone", "site", "worn"],
      );
      if (moved.length) {
        problems.push(`jewelry "${lock.id}": the fixed piece changed (${moved.join(", ")}). a band that changes is a different band`);
      }
      continue;
    }
    const retired = lock.value.retired;
    if (!retired) {
      problems.push(
        `jewelry "${lock.id}": the fixed piece is gone from this shot with no retirement recorded. ` +
          `it does not leave because the framing changed.`,
      );
    }
  }
  return problems;
}
