// the four consistencies, baked into the prompt instead of hoped for.
//
// a diffusion model does not remember the last frame. it knows only what the
// prompt says right now, so consistency is not a setting, it is a property of
// the prompt text. the industry names four axes (loqo.ai states them plainly:
// "consistency is the hard part, it's also our default"): character, location,
// composition, magnification. this module makes them mandatory blocks that
// every generation call has to carry, in the same order, with the character
// block derived from the persona rather than retyped per shot.
//
// the rule that makes it work: the blocks are STABLE TEXT plus a stable seed.
// a shot may change its composition line; it may not paraphrase the character
// line, because a paraphrase is a different person to the model.

import type { PersonaManifest } from "./schema.ts";

export const CONSISTENCY_AXES = ["character", "location", "composition", "magnification"] as const;
export type ConsistencyAxis = typeof CONSISTENCY_AXES[number];

// what a caller supplies: everything except the character, which the persona
// owns.
export interface SceneSpec {
  location: string;
  composition: string;
  magnification: string;
}

export interface ConsistencyBlocks {
  character: string;
  location: string;
  composition: string;
  magnification: string;
}

export interface ConsistencyProblem {
  axis: ConsistencyAxis;
  problem: string;
}

// the character line is generated once per persona and reused verbatim. it
// reads the authored look, not an improvised description, so two surfaces
// cannot produce two different faces.
export function characterBlock(persona: PersonaManifest): string {
  const look = persona.brand.look?.trim();
  const name = persona.display_name;
  const parts = [`${name}, the same person in every frame`];
  if (look) parts.push(`appearance: ${look}`);
  return parts.join(". ") + ".";
}

export function consistencyBlocks(persona: PersonaManifest, scene: SceneSpec): ConsistencyBlocks {
  return {
    character: characterBlock(persona),
    location: scene.location.trim(),
    composition: scene.composition.trim(),
    magnification: scene.magnification.trim(),
  };
}

// the prompt body: labelled, ordered, and never a single run-on sentence the
// model can drop a clause from.
export function consistencyPrompt(persona: PersonaManifest, scene: SceneSpec): string {
  const blocks = consistencyBlocks(persona, scene);
  return CONSISTENCY_AXES.map((axis) => `${axis}: ${blocks[axis]}`).join("\n");
}

export function consistencyProblems(blocks: ConsistencyBlocks): ConsistencyProblem[] {
  const problems: ConsistencyProblem[] = [];
  for (const axis of CONSISTENCY_AXES) {
    const value = (blocks[axis] ?? "").trim();
    if (!value) {
      problems.push({ axis, problem: "empty: a shot without this axis is a new world" });
      continue;
    }
    if (value.length < 8) {
      problems.push({ axis, problem: "too thin to hold: give the model something it cannot vary" });
    }
  }
  return problems;
}

// the seed: same four texts in, same number out, so a re-run of the same setup
// is the same image and a changed setup is a deliberate one.
export function consistencySeed(blocks: ConsistencyBlocks): number {
  const text = CONSISTENCY_AXES.map((axis) => blocks[axis].trim()).join("\u0000");
  // fnv-1a, 32 bit, trimmed into the range diffusion tools accept
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 4294967295;
}

export function consistencyFingerprint(blocks: ConsistencyBlocks): string {
  return CONSISTENCY_AXES.map((axis) => blocks[axis].trim()).join("|");
}

// what drifted between a reference and a candidate shot. this is the honest
// answer to "is it still the same film": the axes that changed, by name.
export function consistencyDrift(
  reference: ConsistencyBlocks,
  candidate: ConsistencyBlocks,
): ConsistencyAxis[] {
  return CONSISTENCY_AXES.filter((axis) => reference[axis].trim() !== candidate[axis].trim());
}
