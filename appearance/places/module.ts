// the rooms she actually films in.
//
// a person's bathroom is one bathroom. the point of a place layer is that the
// mirror, the tiles and the light do not change because a renderer was bored. each
// place carries invariants: the things that must be identical every time, written
// as instructions rather than hoped for.

export interface PlaceTuning {
  id: string;
  kind: "bathroom-mirror" | "car-interior" | "kitchen-counter" | "street" | "studio";
  // what must not change between shoots
  invariants: string[];
  // which path shoots it: rendered for a photoshoot, generated for a lookbook,
  // captured for a real room she is standing in
  shot: "rendered" | "generated" | "captured";
  light?: string;
  note?: string;
}

const SHOTS = ["rendered", "generated", "captured"];

export function placeProblems(place: PlaceTuning): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(place.id ?? "")) problems.push(`"${place.id}" is not a place id`);
  if (!SHOTS.includes(place.shot)) problems.push(`${place.id}: shot must be rendered, generated or captured`);
  if ((place.invariants ?? []).length < 3) {
    problems.push(`${place.id}: fewer than three invariants is a different room every time`);
  }
  for (const invariant of place.invariants ?? []) {
    if (invariant.trim().length < 8) problems.push(`${place.id}: "${invariant}" is too vague to hold anything`);
  }
  return problems;
}

export function placeBlock(place: PlaceTuning): string {
  return `location ${place.id} (${place.kind}, ${place.shot}): ${place.invariants.join("; ")}${place.light ? `; light: ${place.light}` : ""}.`;
}

// a place shot by two different paths in one series is two rooms
export function placePathProblems(places: PlaceTuning[], seriesShot: "rendered" | "generated" | "captured"): string[] {
  return places
    .filter((place) => place.shot !== seriesShot)
    .map((place) => `${place.id} is ${place.shot} and the series is ${seriesShot}`);
}
