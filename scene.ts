// one shot, assembled from locks instead of typed by hand.
//
// this is the join the other two modules exist for. the head's consistency contract
// (persona/consistency.ts) names four axes and requires every generation call to
// carry them in order; the head's character line is generated once from the authored
// look and never retyped. that covers the person. it does not cover the clothes or
// the room, because those are objects the persona owns rather than facts about her,
// and they change for reasons a persona file should not have to record.
//
// so a shot here carries FIVE blocks: the head's character line, the wardrobe lock,
// the environment lock, and the two framing lines a photographer actually chooses.
// the fourth and fifth are the only ones a shot is allowed to vary. that is the whole
// mechanism, and it is why an hour-later run of the same shoot produces the same
// image: nothing in this file accepts a description of an outfit or a room, only a
// lock, and a lock's text is derived from its value.
//
// it does not edit the head to say so. consistencyView() hands the four-axis contract
// to anything on the head that expects it, with the location axis filled from the
// place lock. the wardrobe stays its own axis here rather than being folded into the
// character line, because folding it would make one axis mean two things and hide
// which one moved.

import { characterBlock, consistencySeed, CONSISTENCY_AXES, type ConsistencyBlocks } from "./persona/consistency.ts";
import type { PersonaManifest } from "./persona/schema.ts";
import { digestOf, seedFrom } from "./lock.ts";
import type { OutfitLock } from "./wardrobe/module.ts";
import { structureSource, type EnvironmentLock, type StructureSource } from "./environment/module.ts";

export const SHOT_AXES = ["character", "wardrobe", "location", "composition", "magnification"] as const;
export type ShotAxis = typeof SHOT_AXES[number];

// the only two lines a shot may choose
export interface Framing {
  composition: string;
  magnification: string;
}

export interface Shot {
  persona: string;
  aipn?: string;
  axes: Record<ShotAxis, string>;
  prompt: string;
  // the same world, the same seed. a changed framing changes it on purpose.
  seed: number;
  structure: StructureSource;
  wardrobe: string;
  place: string;
}

export function shotPrompt(axes: Record<ShotAxis, string>): string {
  return SHOT_AXES.map((axis) => `${axis}: ${axes[axis]}`).join("\n");
}

export async function planShot(
  persona: PersonaManifest,
  outfit: OutfitLock,
  place: EnvironmentLock,
  framing: Framing,
): Promise<Shot> {
  const problems = framingProblems(framing, outfit, place);
  if (problems.length) throw new Error(`scene: cannot plan:\n  ${problems.join("\n  ")}`);
  const axes: Record<ShotAxis, string> = {
    character: characterBlock(persona),
    wardrobe: outfit.block,
    location: place.block,
    composition: framing.composition.trim(),
    magnification: framing.magnification.trim(),
  };
  const digest = await digestOf({
    character: axes.character,
    wardrobe: outfit.digest,
    location: place.digest,
    composition: axes.composition,
    magnification: axes.magnification,
  });
  return {
    persona: persona.id,
    axes,
    prompt: shotPrompt(axes),
    seed: seedFrom(digest),
    structure: structureSource(place),
    wardrobe: outfit.id,
    place: place.id,
  };
}

// the head's rule, applied one layer out: a shot may change its composition line, it
// may not restate the outfit or the room. a place name in the framing block is how a
// "different angle" quietly becomes a different room.
export function framingProblems(framing: Framing, outfit: OutfitLock, place: EnvironmentLock): string[] {
  const problems: string[] = [];
  for (const axis of ["composition", "magnification"] as const) {
    const value = (framing[axis] ?? "").trim();
    if (!value) problems.push(`${axis}: empty, and a shot with no ${axis} is a default`);
    else if (value.length < 8) problems.push(`${axis}: too thin to hold`);
  }
  const text = `${framing.composition} ${framing.magnification}`.toLowerCase();
  const stolen: string[] = [
    place.id, place.value.name.toLowerCase(),
    ...outfit.value.items.map((item) => item.id),
    ...outfit.value.items.map((item) => item.kind.toLowerCase()),
  ].filter((token) => token && token.length > 3 && text.includes(token));
  if (stolen.length) {
    problems.push(
      `framing repeats the world it is framing (${[...new Set(stolen)].join(", ")}). ` +
        `the outfit and the room come from their locks, and a copy of them here is how they drift.`,
    );
  }
  return problems;
}

// which axes moved between two shots. the room and the clothes are answers nobody
// wants to discover in the finished image.
export function shotDrift(before: Shot, after: Shot): ShotAxis[] {
  return SHOT_AXES.filter((axis) => before.axes[axis].trim() !== after.axes[axis].trim());
}

// the series question: may these two frames sit next to each other as one shoot?
// composition and magnification are what a photographer varies, so those are free.
export const SHOT_LOCKED: ShotAxis[] = ["character", "wardrobe", "location"];

export function seriesProblems(shots: Shot[]): string[] {
  const problems: string[] = [];
  if (!shots.length) return ["series: no shots"];
  const first = shots[0];
  for (const shot of shots.slice(1)) {
    const drifted = shotDrift(first, shot).filter((axis) => SHOT_LOCKED.includes(axis));
    if (drifted.length) problems.push(`${shot.place}/${shot.wardrobe}: a different ${drifted.join(" and ")} from the first frame`);
  }
  return problems;
}

// the head's four axes, for anything on the head that takes them. wardrobe is
// deliberately absent: see the note at the top.
export function consistencyView(shot: Shot): ConsistencyBlocks {
  return {
    character: shot.axes.character,
    location: shot.axes.location,
    composition: shot.axes.composition,
    magnification: shot.axes.magnification,
  };
}

// the head's own seed function, over the head's own axes, so a surface that asks the
// head for a seed and a surface that asks this file for one cannot disagree.
export function headSeed(shot: Shot): number {
  return consistencySeed(consistencyView(shot));
}

export function axesPresent(shot: Shot): string[] {
  return SHOT_AXES.filter((axis) => !(shot.axes[axis] ?? "").trim());
}

export function headAxesPresent(shot: Shot): string[] {
  const view = consistencyView(shot);
  return CONSISTENCY_AXES.filter((axis) => !(view[axis] ?? "").trim());
}
