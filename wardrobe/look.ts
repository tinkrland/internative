// a look is two digests, because a series has two questions.
//
//   identity  the devices, the fixed jewelry, the cut. this must not move between
//             frames, or between monday and friday. it is who she is.
//   look      everything on her body in one block, dressings included. this is allowed
//             to move, because a coat and a phone case are styling.
//
// collapsing them into one digest is the mistake the wardrobe made first: a coat that
// changes daily would then look exactly like a haircut, and the checks would either
// refuse every outfit or accept every haircut. two digests, two questions, and the
// series check asks the identity one.

import { digestOf, idProblems, lockProblems, seedFrom, type Lock } from "../lock.ts";
import type { AccessoryLock } from "./accessory.ts";
import { dressingFor, dressedBlock } from "./accessory.ts";
import type { HairLock } from "./hair.ts";
import { hairVariantBlock } from "./hair.ts";
import type { JewelryLock } from "./jewelry.ts";
import { jewelryBlock } from "./jewelry.ts";
import type { OutfitLock } from "./module.ts";
import { outfitBlock } from "./module.ts";

export interface LookLine {
  part: "outfit" | "accessory" | "jewelry" | "hair";
  id: string;
  block: string;
}

export interface IdentityParts {
  devices: { id: string; make: string; model: string; colour: string; size?: string }[];
  fixed_jewelry: { id: string; piece: string; metal: string; stone: string; site: string }[];
  hair: { id: string; hair: string; parting: string; texture: string; finish: string };
}

export interface LookValue {
  // what reaches the model, in order. derived by planLook, so the block is still a
  // function of the value rather than a string typed beside it.
  lines: LookLine[];
  identity: IdentityParts;
}

export interface Look {
  id: string;
  version: number;
  digest: string;
  // the digest of the identity parts alone: stable across a whole series
  identity_digest: string;
  block: string;
  seed: number;
  value: LookValue;
}

export interface LookParts {
  outfit: OutfitLock;
  accessories?: AccessoryLock[];
  // accessory id -> dressing id, or "none" for a bare device
  dressed?: Record<string, string>;
  jewelry?: JewelryLock[];
  hair: HairLock;
  // worn up. a toggle, not a version.
  up?: boolean;
}

export function lookBlock(value: LookValue): string {
  return value.lines.map((line) => line.block).join("\n");
}

function identityOf(parts: LookParts): IdentityParts {
  const devices = (parts.accessories ?? [])
    .map((lock) => lock.value)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((a) => ({ id: a.id, make: a.device.make, model: a.device.model, colour: a.device.colour, size: a.device.size }));
  const fixed = (parts.jewelry ?? [])
    .filter((lock) => lock.value.persistence === "fixed")
    .map((lock) => lock.value)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((j) => ({ id: j.id, piece: j.piece, metal: j.metal, stone: j.stone, site: j.site }));
  const hair = parts.hair.value;
  return {
    devices,
    fixed_jewelry: fixed,
    hair: { id: hair.id, hair: hair.hair, parting: hair.parting, texture: hair.texture, finish: hair.finish },
  };
}

export async function planLook(id: string, parts: LookParts, version = 1): Promise<Look> {
  const problems = [...idProblems(id, "look")];
  const accessories = [...(parts.accessories ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const jewelry = [...(parts.jewelry ?? [])].sort(
    (a, b) =>
      (a.value.persistence === b.value.persistence ? 0 : a.value.persistence === "fixed" ? -1 : 1) ||
      a.id.localeCompare(b.id),
  );
  const lines: LookLine[] = [
    { part: "outfit", id: parts.outfit.id, block: outfitBlock(parts.outfit.value.items) },
  ];
  for (const lock of accessories) {
    const dressing = (parts.dressed ?? {})[lock.id] ?? "none";
    try {
      lines.push({ part: "accessory", id: lock.id, block: dressedBlock(lock.value, dressing) });
    } catch (error) {
      problems.push((error as Error).message);
    }
  }
  for (const lock of jewelry) lines.push({ part: "jewelry", id: lock.id, block: jewelryBlock(lock.value) });
  try {
    lines.push({ part: "hair", id: parts.hair.id, block: hairVariantBlock(parts.hair, parts.up ?? false) });
  } catch (error) {
    problems.push((error as Error).message);
  }
  if (problems.length) throw new Error(`look "${id}": cannot plan:\n  ${problems.join("\n  ")}`);

  const identity = identityOf({ ...parts, accessories, jewelry });
  const value: LookValue = { lines, identity };
  const digest = await digestOf({ kind: "look", id, value });
  const identity_digest = await digestOf(identity);
  return { id, version, digest, identity_digest, block: lookBlock(value), seed: seedFrom(digest), value };
}

export function lookProblems(lock: Look): string[] {
  const problems: string[] = [...idProblems(lock.id, "look")];
  if (!Number.isInteger(lock.version) || lock.version < 1) problems.push(`${lock.id}: version must be at least 1`);
  if (!/^[0-9a-f]{64}$/.test(lock.digest ?? "")) problems.push(`${lock.id}: digest is not a sha-256`);
  if (lookBlock(lock.value) !== lock.block) {
    problems.push(`${lock.id}: the block does not match the value, so it was edited or sealed from stale parts`);
  }
  if (!lock.value.lines.length) problems.push(`${lock.id}: a look with nothing in it is not a look`);
  return problems;
}

// the identity gate, async because it recomputes the digest rather than trusting the one
// on the lock.
export async function identityProblems(lock: Look): Promise<string[]> {
  const recomputed = await digestOf(lock.value.identity);
  if (recomputed !== lock.identity_digest) {
    return [`${lock.id}: the identity digest does not match the identity parts, so somebody has been editing`];
  }
  return [];
}

const IDENTITY_LABELS: Record<string, string> = {
  devices: "device",
  fixed_jewelry: "fixed jewelry",
  hair: "hair",
};

export function identityDrift(before: IdentityParts, after: IdentityParts): string[] {
  const moved: string[] = [];
  for (const key of ["devices", "fixed_jewelry", "hair"] as const) {
    const a = before[key] as unknown as unknown[];
    const b = after[key] as unknown as unknown[];
    const listA = Array.isArray(a) ? a : [a];
    const listB = Array.isArray(b) ? b : [b];
    const byId = (list: unknown[]) =>
      new Map(list.map((entry) => [(entry as { id: string }).id, JSON.stringify(entry)]));
    const mapA = byId(listA);
    const mapB = byId(listB);
    for (const [id, json] of mapA) {
      if (!mapB.has(id)) moved.push(`${IDENTITY_LABELS[key]} ${id}: gone`);
      else if (mapB.get(id) !== json) moved.push(`${IDENTITY_LABELS[key]} ${id}: changed`);
    }
    for (const id of mapB.keys()) if (!mapA.has(id)) moved.push(`${IDENTITY_LABELS[key]} ${id}: added`);
  }
  return moved;
}

// a series varies the styling and nothing else. this is the check a shoot runs before it
// spends anything.
export function seriesLookProblems(looks: Look[]): string[] {
  const problems: string[] = [];
  if (looks.length < 2) return problems;
  const first = looks[0];
  for (const look of looks.slice(1)) {
    if (look.identity_digest === first.identity_digest) continue;
    const moved = identityDrift(first.value.identity, look.value.identity);
    problems.push(
      `${look.id}: a different identity from ${first.id} (${moved.join(", ") || "digest differs"}). ` +
        `a series may restyle her and may not replace her.`,
    );
  }
  return problems;
}
