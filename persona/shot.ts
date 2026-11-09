// a shot: the four axes, plus what she is wearing.
//
// the four axes answer "is this the same film". the wardrobe answers "is this
// the same day". they lock differently on purpose: identity, place and
// magnification hold as long as the place exists, an outfit holds for one
// shoot and retires the next morning.

import {
  characterBlock,
  CONSISTENCY_AXES,
  consistencyProblems,
  consistencySeed,
  type ConsistencyAxis,
  type ConsistencyBlocks,
} from "./consistency.ts";
import type { PersonaManifest } from "./schema.ts";
import { outfitBlock, outfitFingerprint, outfitForDay, outfitForId, type Outfit, type Wardrobe } from "./wardrobe.ts";
import { placeBlock, placeForId, type Place, type Places } from "./places.ts";

export interface ShotRequest {
  place_id: string;
  outfit_id?: string;
  // the day the shot happens, when no outfit was chosen explicitly
  day?: string;
  composition: string;
  magnification: string;
}

export interface ShotPlan {
  blocks: ConsistencyBlocks;
  outfit: Outfit;
  place: Place;
  prompt: string;
  seed: number;
}

export function planShot(
  persona: PersonaManifest,
  libraries: { places: Places; wardrobe: Wardrobe },
  req: ShotRequest,
): ShotPlan {
  const place = placeForId(libraries.places, req.place_id);
  const wardrobe = libraries.wardrobe;
  const outfit = req.outfit_id
    ? outfitForId(wardrobe, req.outfit_id)
    : req.day
    ? outfitForDay(wardrobe, req.day)
    : outfitForId(wardrobe, wardrobe.default_outfit ?? wardrobe.outfits[0].id);

  const blocks: ConsistencyBlocks = {
    character: characterBlock(persona),
    location: placeBlock(place),
    composition: req.composition.trim(),
    magnification: req.magnification.trim(),
  };
  const problems = consistencyProblems(blocks);
  if (problems.length) {
    throw new Error(`shot: ${problems.map((p) => `${p.axis}: ${p.problem}`).join("; ")}`);
  }

  const prompt = [
    ...CONSISTENCY_AXES.map((axis) => `${axis}: ${blocks[axis]}`),
    `wardrobe: ${outfitBlock(outfit)}`,
  ].join("\n");

  return { blocks, outfit, place, prompt, seed: shotSeed(blocks, outfit) };
}

// the wardrobe joins the seed: a different outfit is a different image, and the
// same outfit on the same day is the same image.
export function shotSeed(blocks: ConsistencyBlocks, outfit: Outfit): number {
  let hash = consistencySeed(blocks) >>> 0;
  const extra = outfitFingerprint(outfit);
  for (let i = 0; i < extra.length; i++) {
    hash ^= extra.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 4294967295;
}

// what moved between two shots: the axes, plus the wardrobe as its own answer.
export function shotDrift(reference: ShotPlan, candidate: ShotPlan): Array<ConsistencyAxis | "wardrobe"> {
  const drifted: Array<ConsistencyAxis | "wardrobe"> = [];
  for (const axis of CONSISTENCY_AXES) {
    if (reference.blocks[axis].trim() !== candidate.blocks[axis].trim()) drifted.push(axis);
  }
  if (reference.outfit.id !== candidate.outfit.id) drifted.push("wardrobe");
  return drifted;
}

// a shoot is one day, one outfit, one place. composition may vary; this may not.
export const SHOOT_LOCKED: Array<ConsistencyAxis | "wardrobe"> = ["character", "location", "wardrobe"];
