// the rooms, kept once and locked, so a persona lives somewhere instead of somewhere new.
//
// persona/places.ts on the head says which places exist and what does not move in
// them. this module takes one place and seals it: the invariants as a verbatim block,
// the plates that carry its geometry, and a digest. the reason is the same as for a
// garment, and stronger.
//
// TEXT CANNOT HOLD A ROOM. a window described as "on the left" has no position, no
// height and no depth, so every generation invents its own kitchen and the series
// reads as a person who moves house between posts. what holds geometry is a
// structure pass over a plate that already exists (a depth or line estimate fed to a
// structure-conditioned adapter), exactly as practitioners rebuild a room from a
// background photo. so a place is only locked when it has a wide plate, and the lock
// names that plate as the structure source rather than pretending the words did it.
//
// the plates and the block are two halves of one claim: the block says what must
// stay true, the plate says where the window actually is. a lock with one half is
// refused, because half a room is a new room.

import { digestOf, lockProblems, movedFields, seedFrom, type Lock } from "../lock.ts";

export type PlaceKind =
  | "kitchen"
  | "bathroom"
  | "bedroom"
  | "living_room"
  | "car"
  | "street"
  | "studio"
  | "office"
  | "other";

export const PLACE_KINDS: PlaceKind[] = [
  "kitchen",
  "bathroom",
  "bedroom",
  "living_room",
  "car",
  "street",
  "studio",
  "office",
  "other",
];

export type LightDirection = "front" | "left" | "right" | "back" | "overhead" | "practical";
export const LIGHT_DIRECTIONS: LightDirection[] = ["front", "left", "right", "back", "overhead", "practical"];

// wide is the geometry carrier. mirror is what a selfie sees. detail is texture.
export type PlateRole = "wide" | "mirror" | "detail";

export interface Plate {
  id: string;
  uri: string;
  role: PlateRole;
  // the plate this persona actually shot in, rather than a stock reference
  ours?: boolean;
}

export interface Surface {
  surface: string;
  material: string;
  hex: string;
}

export interface Light {
  direction: LightDirection;
  quality: string;
  time: string;
}

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  // what never moves: the things a viewer would notice were different
  invariants: string[];
  surfaces: Surface[];
  light: Light;
  plates: Plate[];
  props: string[];
  avoid: string[];
  // a place in her life, shot again. a one-off set is not locked, it is built.
  recurring: boolean;
  plates_missing_reason?: string;
}

// an invariant has to be a fact, not a mood. "white walls" is a mood: every kitchen
// has walls and half of them are white.
export const MIN_INVARIANTS = 3;
export const MIN_INVARIANT_CHARS = 12;
export const MIN_SURFACES = 2;
const HEX = /^#[0-9a-f]{6}$/i;

export function plateProblems(plate: Plate, place: string): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9_-]+$/.test(plate.id ?? "")) problems.push(`${place}: plate "${plate.id}" is not a slug`);
  if (!["wide", "mirror", "detail"].includes(plate.role)) problems.push(`${place}.${plate.id}: role must be wide, mirror or detail`);
  if (!/^(https?:\/\/|\.{0,2}\/|assets\/)/.test(plate.uri ?? "")) {
    problems.push(`${place}.${plate.id}: "${plate.uri}" is not a path or url`);
  }
  return problems;
}

export function placeProblems(place: Place): string[] {
  const problems: string[] = [];
  const who = place.id || "?";
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(place.id ?? "")) problems.push(`${who}: id must be a slug`);
  if ((place.name ?? "").trim().length < 3) problems.push(`${who}: name required`);
  if (!PLACE_KINDS.includes(place.kind)) problems.push(`${who}: kind must be one of ${PLACE_KINDS.join(", ")}`);
  const invariants = (place.invariants ?? []).map((i) => i.trim()).filter(Boolean);
  if (invariants.length < MIN_INVARIANTS) {
    problems.push(`${who}: ${invariants.length} invariants, needs ${MIN_INVARIANTS}. a room with fewer is a style`);
  }
  for (const invariant of invariants) {
    if (invariant.length < MIN_INVARIANT_CHARS) {
      problems.push(`${who}: invariant "${invariant}" is too thin to hold: name the thing and where it is`);
    }
  }
  const surfaces = place.surfaces ?? [];
  if (surfaces.length < MIN_SURFACES) problems.push(`${who}: ${surfaces.length} surfaces, needs ${MIN_SURFACES}`);
  for (const surface of surfaces) {
    if (!(surface.surface ?? "").trim()) problems.push(`${who}: a surface with no name`);
    if (!(surface.material ?? "").trim()) problems.push(`${who}.${surface.surface}: material required`);
    if (!HEX.test(surface.hex ?? "")) problems.push(`${who}.${surface.surface}: "${surface.hex}" is not a hex colour`);
  }
  if (!LIGHT_DIRECTIONS.includes(place.light?.direction)) {
    problems.push(`${who}: light direction must be one of ${LIGHT_DIRECTIONS.join(", ")}`);
  }
  if ((place.light?.quality ?? "").trim().length < 3) problems.push(`${who}: light quality required`);
  if (!(place.light?.time ?? "").trim()) problems.push(`${who}: light time required, because a room at noon is not the same room at nine`);
  const plates = place.plates ?? [];
  for (const plate of plates) problems.push(...plateProblems(plate, who));
  const ids = new Set<string>();
  for (const plate of plates) {
    if (ids.has(plate.id)) problems.push(`${who}: two plates share the id ${plate.id}`);
    ids.add(plate.id);
  }
  if (place.recurring && !plates.some((p) => p.role === "wide")) {
    problems.push(`${who}: a recurring place with no wide plate has no geometry to hold, only adjectives`);
  }
  if (!place.recurring && plates.length === 0 && !(place.plates_missing_reason ?? "").trim()) {
    problems.push(`${who}: no plates and no reason given`);
  }
  if ((place.props ?? []).length === 0) problems.push(`${who}: props required, because a room with no objects is a backdrop`);
  if ((place.avoid ?? []).length === 0) problems.push(`${who}: avoid list required, or the model grows a second window`);
  return problems;
}

export function placeBlock(place: Place): string {
  const lines = [
    `room: ${place.name} (${place.kind.replace(/_/g, " ")})`,
    `fixed: ${place.invariants.join("; ")}`,
    `surfaces: ${place.surfaces.map((s) => `${s.surface} ${s.material} ${s.hex}`).join("; ")}`,
    `light: ${place.light.quality}, from the ${place.light.direction}, ${place.light.time}`,
    `props: ${place.props.join("; ")}`,
    `avoid: ${place.avoid.join("; ")}`,
  ];
  return lines.join("\n");
}

export interface EnvironmentLock extends Lock<Place> {
  kind: "environment";
  seed: number;
}

export async function lockPlace(place: Place, version = 1): Promise<EnvironmentLock> {
  const problems = placeProblems(place);
  if (problems.length) throw new Error(`environment: cannot lock:\n  ${problems.join("\n  ")}`);
  const digest = await digestOf({ kind: "environment", id: place.id, value: place });
  return { kind: "environment", id: place.id, version, digest, block: placeBlock(place), value: place, seed: seedFrom(digest) };
}

export function placeLockProblems(lock: EnvironmentLock): string[] {
  return [...lockProblems(lock, placeBlock), ...placeProblems(lock.value)];
}

// the plate a structure pass is taken from, and what a structure pass is for. this is
// a plan, not a promise: whether the adapter in play accepts a depth or line estimate
// is the adapter's business (generation/adapters.ts), and a lock cannot grant it.
export interface StructureSource {
  place: string;
  plate: string;
  uri: string;
  preprocessors: ("depth" | "line")[];
  why: string;
}

export function structureSource(lock: EnvironmentLock): StructureSource {
  const wide = lock.value.plates.find((plate) => plate.role === "wide");
  if (!wide) throw new Error(`environment: ${lock.id} has no wide plate, so there is no geometry to carry`);
  return {
    place: lock.id,
    plate: wide.id,
    uri: wide.uri,
    preprocessors: ["depth", "line"],
    why: `the window is at a height and a depth, and only ${wide.id} knows where`,
  };
}

export function placeDrift(before: EnvironmentLock, after: EnvironmentLock): string[] {
  const moved = movedFields(
    before.value as unknown as Record<string, unknown>,
    after.value as unknown as Record<string, unknown>,
    ["name", "kind", "invariants", "surfaces", "light", "props", "avoid", "recurring"],
  );
  const plateIds = (lock: EnvironmentLock) => lock.value.plates.map((plate) => `${plate.id}:${plate.role}`).sort();
  if (JSON.stringify(plateIds(before)) !== JSON.stringify(plateIds(after))) moved.push("plates");
  return moved;
}
