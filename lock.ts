// a lock is a piece of the world frozen into something a model cannot vary.
//
// the problem this file exists for: an autonomous run regenerates its prompt text
// every time. one careless retype of "oatmeal wool overcoat" as "cream wool coat"
// and the same garment becomes a different garment, with nobody to notice. so the
// described object is sealed: canonical json in, a digest out, and the prompt block
// is a function of the value rather than a string somebody typed next to it.
//
// two rules follow, and both are enforced here:
//
//   1. the block is derived, never authored. a stored block that does not equal the
//      one its value rebuilds is refused, because that gap is exactly where drift
//      lives.
//   2. a change is a version, not an edit. a lock keeps its digest for as long as it
//      means the same thing; changing what it means under the same id and version is
//      a silent restyle, and it is refused by name.
//
// the digest covers what the lock MEANS (its id and its value), not which version of
// it you are looking at: the same world at version 7 is the same world, and the seed
// that reproduces it must not move because somebody corrected a typo in a label.
//
// a seed rides along, taken from the digest, because text conditioning is not the
// only source of sameness: the same locks and one unchanged setting should be able
// to reproduce a frame rather than approximate it.

export type LockKind = "wardrobe" | "environment";

export interface Lock<T> {
  kind: LockKind;
  id: string;
  // monotonic. 1 is the first version anyone saw.
  version: number;
  digest: string;
  // derived from value by the module that owns it, never typed by hand
  block: string;
  value: T;
}

// key order sorted, arrays left in place unless the caller sorted them first: two
// identical objects must digest identically, and a reordered detail list is a
// different garment.
export function canonicalJson(value: unknown): string {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, walk(v)]),
      );
    }
    return node;
  };
  return JSON.stringify(walk(value));
}

export async function digestOf(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hashed = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hashed)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// the first four bytes of the digest, as the number a diffusion tool takes as a seed.
// derived, not chosen, so a re-run of the same world is the same picture.
export function seedFrom(digest: string): number {
  if (!/^[0-9a-f]{8}/.test(digest)) throw new Error(`seed: "${digest}" is not a digest`);
  return parseInt(digest.slice(0, 8), 16) >>> 0;
}

export function idProblems(id: string, kind: LockKind): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(id ?? "")) problems.push(`${kind}: "${id}" is not a slug`);
  return problems;
}

// the hand-edit gate. rebuild is the module's own block builder, so this file never
// has to know what a garment or a room is.
export function lockProblems<T>(lock: Lock<T>, rebuild: (value: T) => string): string[] {
  const problems: string[] = [...idProblems(lock.id, lock.kind)];
  if (!Number.isInteger(lock.version) || lock.version < 1) {
    problems.push(`${lock.id}: version must be a whole number of at least 1, got ${lock.version}`);
  }
  if (!/^[0-9a-f]{64}$/.test(lock.digest ?? "")) problems.push(`${lock.id}: digest is not a sha-256`);
  const rebuilt = rebuild(lock.value);
  if (rebuilt !== lock.block) {
    problems.push(
      `${lock.id}: the block does not match the value it claims to describe. ` +
        `a lock's text is derived, never typed, so this is either an edit or a stale seal.`,
    );
  }
  return problems;
}

// which named fields moved. a caller that wants to know whether a picture is still
// the same picture asks this, and gets field names rather than a boolean.
export function movedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): string[] {
  return fields.filter((field) => canonicalJson(before[field]) !== canonicalJson(after[field]));
}

// the version gate: changing what a lock means while keeping its name.
export function replaceProblems<T>(before: Lock<T>, after: Lock<T>): string[] {
  const problems: string[] = [];
  if (before.kind !== after.kind) problems.push(`${after.id}: ${before.kind} cannot become ${after.kind}`);
  if (before.id !== after.id) return problems; // a different thing, nothing to protect
  if (before.digest === after.digest) {
    if (after.version !== before.version) {
      problems.push(`${after.id}: version ${after.version} changes nothing, so it is not a version`);
    }
    return problems;
  }
  if (after.version <= before.version) {
    problems.push(
      `${after.id}: ${after.digest.slice(0, 12)} replaces ${before.digest.slice(0, 12)} at version ` +
        `${after.version}. a changed lock is a new version, or it is the same ${after.kind} wearing her name.`,
    );
  }
  return problems;
}
