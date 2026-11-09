// hair is identity, and it is the clearest version of the rule the wardrobe arrived at
// through a phone case.
//
// nobody's bob is a collarbone cut on tuesday. hair changes when it is cut, and a
// haircut is an event with a date, exactly like a new handset. what DOES change hourly
// is how it is worn: up, down, tucked behind an ear. so:
//
//   the lock holds cut, length, parting, texture and finish.
//   "up" is a per shot toggle, and the up-do has to be declared, because otherwise the
//   model invents a chignon and calls it a bob tied back.

import { digestOf, idProblems, lockProblems, movedFields, seedFrom, type Lock } from "../lock.ts";
import { plateProblems, type Plate } from "./module.ts";

export interface Hairstyle {
  id: string;
  name: string;
  // "chin length blunt bob, heavy fringe"
  hair: string;
  parting: string;
  texture: string;
  finish: string;
  // how it goes up. declared, not improvised.
  updo?: string;
  avoid: string[];
  plates?: Plate[];
  plates_missing_reason?: string;
  // a haircut is an event
  restyle?: { on: string; why: string };
}

// texture, in the professional sense, is two facts: strand circumference and pattern.
// a stylist glossaries it that way (fine and coarse are a strand's thickness, not a
// choice), and a line that says "fine" alone leaves the shape to the model's imagination.
const STRAND = /\b(fine|medium|coarse|thick)\b/i;
const PATTERN = /\b(straight|wave|wavy|curl|curly|coil|coily|kink|kinky|afro|crimped)\b/i;

export function textureProblems(texture: string): string[] {
  const text = (texture ?? "").trim();
  if (text.length < 5) return ["texture required, and fine straight is not coarse wave"];
  const problems: string[] = [];
  if (!STRAND.test(text)) problems.push(`texture "${text}" does not say how thick the strand is (fine, medium, coarse)`);
  if (!PATTERN.test(text)) problems.push(`texture "${text}" does not say the pattern (straight, wavy, curly)`);
  return problems;
}

export function hairProblems(style: Hairstyle): string[] {
  const who = `hair "${style.id}"`;
  const problems: string[] = [];
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(style.id ?? "")) problems.push(`${who}: id is not a slug`);
  if ((style.hair ?? "").trim().length < 8) problems.push(`${who}: length, cut and fringe belong in one line, and it needs all of them`);
  if ((style.parting ?? "").trim().length < 3) problems.push(`${who}: parting required, centre is an answer and so is none`);
  for (const problem of textureProblems(style.texture)) problems.push(`${who}: ${problem}`);
  if ((style.finish ?? "").trim().length < 5) problems.push(`${who}: finish required, air dried is not a wet look`);
  if ((style.avoid ?? []).length < 1) problems.push(`${who}: needs an avoid list, or the model adds volume`);
  if (!(style.plates ?? []).length && !(style.plates_missing_reason ?? "").trim()) {
    problems.push(`${who}: no reference plate and no reason given`);
  }
  for (const plate of style.plates ?? []) problems.push(...plateProblems(plate, style.id).map((p) => `${who}: ${p}`));
  if (style.restyle) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(style.restyle.on ?? "")) problems.push(`${who}: restyle date must be yyyy-mm-dd`);
    if ((style.restyle.why ?? "").trim().length < 10) problems.push(`${who}: a haircut needs a reason on file, same as an upgrade`);
  }
  return problems;
}

export function hairBlock(style: Hairstyle, up = false): string {
  const lines = [
    `hair: ${style.hair}`,
    `parting: ${style.parting}`,
    `texture: ${style.texture}`,
    `finish: ${style.finish}`,
  ];
  if (up) {
    if (!style.updo) throw new Error(`hair "${style.id}": there is no up-do declared, so an up-do shot would improvise one`);
    lines.push(`up-do: ${style.updo}`);
  }
  return lines.join("\n");
}

export interface HairLock extends Lock<Hairstyle> {
  seed: number;
}

export async function lockHair(style: Hairstyle, version = 1): Promise<HairLock> {
  const problems = [...idProblems(style.id, "hair"), ...hairProblems(style)];
  if (problems.length) throw new Error(`hair: cannot lock:\n  ${problems.join("\n  ")}`);
  const block = hairBlock(style);
  const digest = await digestOf({ kind: "hair", id: style.id, value: style });
  return { kind: "hair", id: style.id, version, digest, block, value: style, seed: seedFrom(digest) };
}

export function hairLockProblems(lock: HairLock): string[] {
  return [...lockProblems(lock, hairBlock), ...hairProblems(lock.value)];
}

// wear it up or down: a toggle, not a version. the digest does not move, because the
// same person with the same hair is the same person.
export function hairVariantBlock(lock: HairLock, up: boolean): string {
  return hairBlock(lock.value, up);
}

// the gate: a different cut needs a restyle event.
export function restyleProblems(before: HairLock, after: HairLock): string[] {
  const moved = movedFields(
    before.value as unknown as Record<string, unknown>,
    after.value as unknown as Record<string, unknown>,
    ["hair", "parting", "texture", "finish"],
  );
  if (!moved.length) return [];
  const restyle = after.value.restyle;
  if (!restyle) {
    return [
      `${after.id}: her hair changed (${moved.join(", ")}) with no restyle recorded. ` +
        `hair does not restyle between photographs, so a cut is an event with a date.`,
    ];
  }
  const problems: string[] = [];
  if (restyle.on === before.value.restyle?.on) {
    problems.push(`${after.id}: the restyle is dated ${restyle.on}, the same as the last one, so it is not a new cut`);
  }
  return problems;
}
