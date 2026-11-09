// the places: the rooms a person actually stands in, kept once.
//
// nobody has a new bathroom every morning. a recurring place is authored
// before it is ever shot in: fixtures, materials and light direction written
// down once, two or three reference plates made from it. every later shot
// reuses those plates as structure references, so the model composes a person
// into a room instead of inventing one.

import { stripJsonc } from "./loader.ts";

export type PlaceKind =
  | "bathroom_mirror"
  | "car_interior"
  | "kitchen"
  | "bedroom"
  | "street"
  | "studio"
  | "other";

export interface Plate {
  id: string;
  uri: string;
  role: "wide" | "mirror" | "detail";
}

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  // what never moves: mirror height, wheel wear, which side the window is on
  invariants: string[];
  plates: Plate[];
  light: string;
  // true = a place in her life. shot again, never re-invented.
  recurring: boolean;
}

export interface Places {
  persona: string;
  places: Place[];
}

export function placeBlock(place: Place): string {
  const parts = [`${place.name} (${place.kind.replace(/_/g, " ")})`];
  if (place.invariants.length) parts.push(`fixed: ${place.invariants.join("; ")}`);
  parts.push(`light: ${place.light.trim()}`);
  return parts.join(". ") + ".";
}

export function placeProblems(place: Place): string[] {
  const problems: string[] = [];
  if (!place.id || !/^[a-z0-9_-]+$/.test(place.id)) problems.push(`${place.id || "?"}: id must be a lowercase slug`);
  if (!place.name?.trim()) problems.push(`${place.id}: name required`);
  if (!place.invariants?.length) problems.push(`${place.id}: invariants required, or it is not a place`);
  if (!place.light?.trim()) problems.push(`${place.id}: light direction required`);
  const plates = place.plates ?? [];
  if (!plates.length) problems.push(`${place.id}: at least one reference plate`);
  if (place.recurring && !plates.some((p) => p.role === "wide")) {
    problems.push(`${place.id}: recurring places need a wide plate`);
  }
  if (place.recurring && plates.length < 2) {
    problems.push(`${place.id}: recurring places need at least two plates`);
  }
  for (const p of plates) {
    if (!p.uri?.trim()) problems.push(`${place.id}: plate ${p.id} has no uri`);
  }
  return problems;
}

export function placesProblems(places: Places): string[] {
  const problems: string[] = [];
  if (!places.persona) problems.push("persona: required");
  if (!places.places?.length) problems.push("places: at least one");
  const seen = new Set<string>();
  for (const place of places.places ?? []) {
    for (const p of placeProblems(place)) problems.push(`places.${p}`);
    if (seen.has(place.id)) problems.push(`places.${place.id}: duplicate id`);
    seen.add(place.id);
  }
  return problems;
}

export function parsePlaces(src: string): Places {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonc(src));
  } catch (err) {
    throw new Error(`places: not valid jsonc: ${(err as Error).message}`);
  }
  const places = parsed as Places;
  const problems = placesProblems(places);
  if (problems.length) throw new Error(`places: invalid:\n  ${problems.join("\n  ")}`);
  return places;
}

export function placeForId(places: Places, id: string): Place {
  const place = places.places.find((p) => p.id === id);
  if (!place) {
    throw new Error(`places: no place "${id}" (have: ${places.places.map((p) => p.id).join(", ")})`);
  }
  return place;
}

// wide first: the room before the corner of it.
export function placeReferencePlates(place: Place): Plate[] {
  const rank = { wide: 0, mirror: 1, detail: 2 } as const;
  return [...place.plates].sort((a, b) => rank[a.role] - rank[b.role]);
}
