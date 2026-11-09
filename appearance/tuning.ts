// the appearance layer: the half of a personality that is looked at.
//
// this branch is orphaned. it owns no identity and no wardrobe instance: the head
// keeps personas/<id>.wardrobe.jsonc and personas/<id>.places.jsonc, and this owns
// the style those instances obey and the face they hang on. the head seals the
// result as the appearance layer of the aipn, by digest, so a retuned face moves
// the pack and keeps the number.

import { faceBlock, faceProblems, type FaceTuning } from "./face/module.ts";
import { hairBlock, hairProblems, type HairTuning } from "./hair/module.ts";
import { styleBlock, styleProblems, type WardrobeStyle } from "./wardrobe/module.ts";
import { placeBlock, placeProblems, type PlaceTuning } from "./places/module.ts";
import { gradeBlock, gradeProblems, type GradeTuning } from "./grade/module.ts";

export interface Tuning {
  persona: string;
  face: FaceTuning;
  hair: HairTuning;
  style: WardrobeStyle;
  grade: GradeTuning;
  places: PlaceTuning[];
}

export function tuningProblems(tuning: Tuning): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(tuning.persona ?? "")) problems.push("persona: not a persona slug");
  problems.push(...faceProblems(tuning.face));
  problems.push(...hairProblems(tuning.hair));
  problems.push(...styleProblems(tuning.style));
  problems.push(...gradeProblems(tuning.grade));
  if (!tuning.places?.length) problems.push("places: a persona with no place has nowhere to stand");
  const seen = new Set<string>();
  for (const place of tuning.places ?? []) {
    if (seen.has(place.id)) problems.push(`${place.id}: two places share an id`);
    seen.add(place.id);
    problems.push(...placeProblems(place));
  }
  return problems;
}

// fixed order, because a prompt that puts the room before the face reads as a
// different person to the model
export function tuningBlocks(tuning: Tuning): string[] {
  return [
    faceBlock(tuning.face),
    hairBlock(tuning.hair),
    styleBlock(tuning.style),
    gradeBlock(tuning.grade),
    ...(tuning.places ?? []).map((place) => placeBlock(place)),
  ];
}

export function tuningPrompt(tuning: Tuning): string {
  return tuningBlocks(tuning).join("\n");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// the digest the head seals as the aipn's appearance layer. canonical: key order
// sorted, places sorted by id, so two identical tunings always digest the same.
export function canonicalTuning(tuning: Tuning): string {
  const sorted = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sorted);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, sorted(v)]),
      );
    }
    return value;
  };
  const normalised = {
    ...tuning,
    places: [...(tuning.places ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
  };
  return JSON.stringify(sorted(normalised));
}

export async function tuningDigest(tuning: Tuning): Promise<string> {
  const problems = tuningProblems(tuning);
  if (problems.length) throw new Error(`refusing to digest an invalid appearance: ${problems.join("; ")}`);
  return sha256Hex(`appearance\n${canonicalTuning(tuning)}`);
}
