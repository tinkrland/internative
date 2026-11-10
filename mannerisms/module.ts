// mannerisms: what her body does while the wardrobe is being a wardrobe.
//
// a locked look answers what is worn. it does not answer how she stands in it, and that is
// the difference between a photograph of a person and a photograph of a mannequin wearing
// the same clothes. so the body gets its own axis: posture, gesture, gaze, habit, how she
// takes up space, and how she times all of it.
//
// the rule that keeps this from becoming adjectives: a mannerism must be something a camera
// can catch. "tucks her hair behind her right ear when she starts thinking" is a mannerism.
// "radiates quiet confidence" is a mood wearing a mannerism's name, and it is refused here.

import { SITE_PATHS, siteSpec } from "../wardrobe/sites.ts";

export type MannerismKind = "posture" | "gesture" | "gaze" | "habit" | "space" | "timing";
export type Frequency = "always" | "often" | "sometimes" | "under_stress" | "rare";

export const KINDS: MannerismKind[] = ["posture", "gesture", "gaze", "habit", "space", "timing"];
export const FREQUENCIES: Frequency[] = ["always", "often", "sometimes", "under_stress", "rare"];

// interior states dressed as behaviour. matched on stems so "confidence" and "confident"
// are the same refusal, and the list is short on purpose: it is a tripwire, not a lexicon.
const INTERIOR_STEMS = [
  "confiden",
  "nervous",
  "shy",
  "warm",
  "magnet",
  "myster",
  "sass",
  "sensual",
  "playful",
  "radian",
  "energy",
  "aura",
  "vibe",
  "presence",
];

export function interiorWords(text: string): string[] {
  const lower = text.toLowerCase();
  return INTERIOR_STEMS.filter((stem) => new RegExp(`\\b${stem}`, "i").test(lower));
}

export interface Mannerism {
  id: string;
  name: string;
  kind: MannerismKind;
  // where on the body it happens, in the wardrobe's site vocabulary, so a plant is placed
  site: string;
  // what the camera sees: a movement, a hold, a rhythm
  what: string;
  frequency: Frequency;
  // 1 is barely there, 3 is the kind of thing a still frame catches mid-move
  intensity: 1 | 2 | 3;
  // where it shows. empty means everywhere
  surfaces?: string[];
  // the mannerisms it cannot coexist with, by id
  conflicts_with?: string[];
  evidence: "observed" | "authored";
  avoid?: string[];
}

export function mannerismProblems(m: Mannerism): string[] {
  const problems: string[] = [];
  if (!m.id?.trim()) problems.push("id: a mannerism with no id cannot be referenced or conflicted with");
  if (!KINDS.includes(m.kind)) problems.push(`kind: "${m.kind}" is not one of ${KINDS.join(", ")}`);
  if (!FREQUENCIES.includes(m.frequency)) problems.push(`frequency: "${m.frequency}" is not one of ${FREQUENCIES.join(", ")}`);

  const what = (m.what ?? "").trim();
  if (what.length < 12) {
    problems.push("what: describe what the camera catches, in a sentence somebody could shoot");
  }
  const interior = interiorWords(what);
  if (interior.length) {
    problems.push(`what: "${interior[0]}" is an interior state, and the body cannot be lit for it`);
  }
  if (!/when|while|as she|before|after|each time|instead of/i.test(what) && m.kind !== "posture") {
    problems.push("what: say what it happens around. a movement with no trigger is a pose");
  }
  if (![1, 2, 3].includes(m.intensity)) problems.push("intensity: 1, 2 or 3");
  if (m.intensity === 3 && m.frequency === "always") {
    problems.push("intensity: a 3 that runs always stops being character and becomes choreography");
  }

  // the site has to exist, so a mannerism can be placed on a body rather than in a mood
  if (!siteSpec(m.site ?? "")) {
    problems.push(`site: "${m.site}" is not a site. the paths are ${SITE_PATHS.join(", ")}`);
  }

  if (!["observed", "authored"].includes(m.evidence)) {
    problems.push('evidence: "observed" or "authored", since an invented quirk is a decision and should be labelled one');
  }
  return problems;
}

export interface MannerismSet {
  id: string;
  items: Mannerism[];
}

// the set-level rules are the ones that decide whether she reads as a person
export function setProblems(set: MannerismSet): string[] {
  const problems: string[] = [];
  if (!set.id?.trim()) problems.push("set: no id");
  const seen = new Set<string>();
  for (const m of set.items) {
    if (seen.has(m.id)) problems.push(`${m.id}: declared twice`);
    seen.add(m.id);
    problems.push(...mannerismProblems(m).map((p) => `${m.id}: ${p}`));
  }
  const always = set.items.filter((m) => m.frequency === "always");
  if (always.length > 3) {
    problems.push(
      `always: ${always.length} mannerisms run every time, and a body doing ${always.length} things at once reads as a tic. keep three`,
    );
  }
  // two habits in the same place at the same time is one too many
  const keys = new Map<string, string>();
  for (const m of always) {
    const key = `${m.site}:${m.kind}`;
    if (keys.has(key)) {
      problems.push(`${m.id} and ${keys.get(key)}: both always ${m.kind} at ${m.site}, so the body has to choose and nobody said which`);
    }
    keys.set(key, m.id);
  }
  for (const m of set.items) {
    for (const other of m.conflicts_with ?? []) {
      if (!seen.has(other)) problems.push(`${m.id}: conflicts with "${other}", which is not in this set`);
      if (other === m.id) problems.push(`${m.id}: conflicts with itself`);
    }
  }
  return problems;
}

// what a shot may act on. always-on first, then the ones with a trigger, and the surface
// filter keeps a podcast mannerism out of a photograph
export function mannerismBlock(set: MannerismSet, surface?: string): string[] {
  const order: Frequency[] = ["always", "often", "sometimes", "under_stress", "rare"];
  return set.items
    .filter((m) => !surface || !m.surfaces?.length || m.surfaces.includes(surface))
    .sort((a, b) => order.indexOf(a.frequency) - order.indexOf(b.frequency) || a.id.localeCompare(b.id))
    .map((m) => `${m.frequency.replace("_", " ")}: ${m.name}, ${m.what.replace(/\.$/, "")}`);
}

// the two or three that are HER, for a card or a casting note. a set with no always-on
// mannerism has no signature, and that is worth saying out loud
export function signature(set: MannerismSet): Mannerism[] {
  return set.items.filter((m) => m.frequency === "always").slice(0, 3);
}

export function signatureProblems(set: MannerismSet): string[] {
  if (!signature(set).length) {
    return ["signature: nothing runs always, so there is no mannerism a stranger would recognise her by"];
  }
  return [];
}
