// not everything she wears is the same kind of thing.
//
// a coat is styling: it changes daily, and a shot may re-roll it from a locked set.
// a phone is identity: it does not change between photographs. nobody buys a new
// handset on tuesday, so a series that shows an iphone 13 on monday and an iphone 15 on
// thursday has introduced a fact nobody decided. the case in between is styling that
// rides on an identity part, and it changes as often as she likes.
//
// so the rule is structural rather than a label somebody could forget to set:
//
//   the lock holds the DEVICE only. what is worn around it is chosen per shot, from
//   the dressings she owns, the way framing is chosen per shot. a dressing she does
//   not own is refused rather than invented, and a different DEVICE is not a restyle
//   at all: it is an upgrade, with a date and a reason.
//
// this is the case that taught the rule. it generalises to a watch and its strap, a bag
// and its charm, glasses and their chain, and it is the same shape the hair module uses
// for a haircut: an event, not a drift.

import { digestOf, idProblems, lockProblems, movedFields, seedFrom, type Lock } from "../lock.ts";
import { plateProblems, type Plate } from "./module.ts";
import { siteProblems, type Side } from "./sites.ts";

export type Carries = "phone" | "watch" | "bag" | "eyewear" | "audio" | "camera";

export const CARRIES: Carries[] = ["phone", "watch", "bag", "eyewear", "audio", "camera"];

export interface Device {
  make: string;
  model: string;
  colour: string;
  // 6.1 inch, 36mm, 32cm. optional, and worth stating when it changes the silhouette.
  size?: string;
}

export type DressingSlot = "case" | "strap" | "charm" | "chain";

// which dressings make sense on what. a keyboard case on a watch is not a styling
// choice, it is a mistake that would have been drawn as a mistake.
export const DRESSING_SLOTS: Record<Carries, DressingSlot[]> = {
  phone: ["case", "charm"],
  watch: ["strap"],
  bag: ["charm"],
  eyewear: ["chain"],
  audio: ["case", "charm"],
  camera: ["strap", "charm"],
};

// where a device sits, when it sits anywhere. a phone and a camera are carried rather than
// worn, so they hold no site and collide with nothing; a watch and a pair of earbuds are on
// a body part that wardrobe/sites.ts already knows about, and one earbud per ear is the
// occupancy rule doing its job.
export const CARRIES_SITES: Record<Carries, { site: string; slot: string }[]> = {
  phone: [],
  camera: [],
  watch: [{ site: "wrists", slot: "watch" }],
  eyewear: [
    { site: "face/eyes", slot: "glasses" },
    { site: "face/eyes", slot: "sunglasses" },
  ],
  bag: [
    { site: "bags", slot: "tote" },
    { site: "bags", slot: "shoulder" },
    { site: "bags", slot: "clutch" },
    { site: "bags", slot: "backpack" },
  ],
  audio: [
    { site: "ears/hearing", slot: "earbud" },
    { site: "ears/hearing", slot: "headphones" },
    { site: "ears/hearing", slot: "hearingaid" },
  ],
};

export interface Dressing {
  id: string;
  slot: DressingSlot;
  name: string;
  note?: string;
}

export interface Accessory {
  id: string;
  // "her phone". the name is for people, the device is for the model.
  name: string;
  carries: Carries;
  device: Device;
  worn: string;
  // what she owns. empty is allowed: a naked device is a look.
  dressings: Dressing[];
  avoid: string[];
  plates?: Plate[];
  plates_missing_reason?: string;
  // a device change is an event, not a version bump on its own
  upgrade?: { on: string; why: string };
  // set when the device is worn rather than carried, so the occupancy rule can see it
  site?: string;
  slot?: string;
  side?: Side;
}

const VAGUE_MODELS = ["phone", "device", "watch", "bag", "glasses", "eyewear", "generic", "unknown", "tbd", "new"];

export function accessoryProblems(acc: Accessory): string[] {
  const who = `accessory "${acc.id}"`;
  const problems: string[] = [];
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(acc.id ?? "")) problems.push(`${who}: id is not a slug`);
  if (!CARRIES.includes(acc.carries)) problems.push(`${who}: carries must be one of ${CARRIES.join(", ")}`);
  const device = acc.device ?? ({} as Device);
  if ((device.make ?? "").trim().length < 2) problems.push(`${who}: device make required, because a make is what a viewer recognises`);
  const model = (device.model ?? "").trim().toLowerCase();
  if (model.length < 3) problems.push(`${who}: device model required and specific`);
  else if (VAGUE_MODELS.includes(model)) {
    problems.push(`${who}: device model "${device.model}" names a category, not a device. say iphone 13, seamaster 36mm, never "phone"`);
  }
  if ((device.colour ?? "").trim().length < 3) problems.push(`${who}: device colour required`);
  if ((acc.worn ?? "").trim().length < 5) problems.push(`${who}: where it is carried or worn is required`);
  if ((acc.avoid ?? []).length < 1) problems.push(`${who}: needs an avoid list, or the model dresses it with everything`);
  if (!(acc.plates ?? []).length && !(acc.plates_missing_reason ?? "").trim()) {
    problems.push(`${who}: no reference plate and no reason given`);
  }
  for (const plate of acc.plates ?? []) problems.push(...plateProblems(plate, acc.id).map((p) => `${who}: ${p}`));
  const allowed = DRESSING_SLOTS[acc.carries] ?? [];
  const seen = new Set<string>();
  for (const dressing of acc.dressings ?? []) {
    if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(dressing.id ?? "")) problems.push(`${who}: dressing "${dressing.id}" is not a slug`);
    if (seen.has(dressing.id)) problems.push(`${who}: dressing "${dressing.id}" is declared twice`);
    seen.add(dressing.id);
    if (!allowed.includes(dressing.slot)) {
      problems.push(`${who}: a ${dressing.slot} does not go on ${acc.carries}. allowed: ${allowed.join(", ") || "none"}`);
    }
    if ((dressing.name ?? "").trim().length < 3) problems.push(`${who}: dressing "${dressing.id}" needs a name a model can draw`);
  }
  if (acc.site) {
    const allowed = CARRIES_SITES[acc.carries] ?? [];
    if (!allowed.length) {
      problems.push(`${who}: a ${acc.carries} is carried, so it has no site. drop it and say where it is carried`);
    } else if (!allowed.some((entry) => entry.site === acc.site && entry.slot === acc.slot)) {
      problems.push(
        `${who}: a ${acc.carries} does not sit on ${acc.site}/${acc.slot}. it sits on ${allowed.map((e) => `${e.site}/${e.slot}`).join(", ")}`,
      );
    } else {
      problems.push(...siteProblems(acc.site, acc.slot ?? "", acc.side ?? "none", who));
    }
  }
  if (acc.upgrade) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(acc.upgrade.on ?? "")) problems.push(`${who}: upgrade date must be yyyy-mm-dd`);
    if ((acc.upgrade.why ?? "").trim().length < 10) problems.push(`${who}: an upgrade needs a reason, because a device change is a fact she decided`);
  }
  return problems;
}

// the identity part, and only the identity part. no dressing, because a dressing is not
// what makes this her phone.
export function accessoryBlock(acc: Accessory): string {
  const d = acc.device;
  const size = d.size ? `, ${d.size}` : "";
  return [`device: ${d.make} ${d.model}, ${d.colour}${size}`, `carried: ${acc.worn}`].join("\n");
}

export function dressingLine(acc: Accessory, dressing: Dressing): string {
  return `${dressing.slot}: ${dressing.name}${dressing.note ? `, ${dressing.note}` : ""}`;
}

export interface AccessoryLock extends Lock<Accessory> {
  seed: number;
}

export async function lockAccessory(acc: Accessory, version = 1): Promise<AccessoryLock> {
  const problems = [...idProblems(acc.id, "accessory"), ...accessoryProblems(acc)];
  if (problems.length) throw new Error(`accessory: cannot lock:\n  ${problems.join("\n  ")}`);
  const block = accessoryBlock(acc);
  const digest = await digestOf({ kind: "accessory", id: acc.id, value: acc });
  return { kind: "accessory", id: acc.id, version, digest, block, value: acc, seed: seedFrom(digest) };
}

export function accessoryLockProblems(lock: AccessoryLock): string[] {
  return [...lockProblems(lock, accessoryBlock), ...accessoryProblems(lock.value)];
}

// a dressing she does not own cannot be worn. "none" is a legal answer, because a bare
// phone is a look and an invented case is not.
export function dressingFor(acc: Accessory, id: string, who = `accessory "${acc.id}"`): Dressing | null {
  const wanted = (id ?? "none").trim().toLowerCase();
  if (wanted === "none" || wanted === "bare") return null;
  const found = (acc.dressings ?? []).find((d) => d.id === wanted);
  if (!found) {
    const owned = (acc.dressings ?? []).map((d) => d.id);
    throw new Error(`${who}: "${id}" is not a dressing she owns. owned: ${owned.length ? owned.join(", ") : "none"}`);
  }
  return found;
}

// the block a shot emits: identity plus the dressing chosen for this frame.
export function dressedBlock(acc: Accessory, dressingId = "none"): string {
  const dressing = dressingFor(acc, dressingId);
  return dressing ? `${accessoryBlock(acc)}\n${dressingLine(acc, dressing)}` : accessoryBlock(acc);
}

// which parts of the identity moved. model is the one that matters, and it is a string
// comparison rather than a similarity score, because "iphone 13" and "iphone 15" are one
// character apart and an entire product cycle apart.
export function deviceDrift(before: Accessory, after: Accessory): string[] {
  return movedFields(before.device as unknown as Record<string, unknown>, after.device as unknown as Record<string, unknown>, [
    "make",
    "model",
    "colour",
    "size",
  ]);
}

// the gate: a different device needs an upgrade event, dated, with a reason.
export function upgradeProblems(before: AccessoryLock, after: AccessoryLock): string[] {
  const moved = deviceDrift(before.value, after.value);
  if (!moved.length) return [];
  const problems: string[] = [];
  const upgrade = after.value.upgrade;
  if (!upgrade) {
    problems.push(
      `${after.id}: the device changed (${moved.join(", ")}) with no upgrade recorded. ` +
        `people do not change phones between shots, so this is either a different person or a decision nobody made.`,
    );
    return problems;
  }
  if (upgrade.on === before.value.upgrade?.on) {
    problems.push(`${after.id}: the upgrade is dated ${upgrade.on}, the same as the last one, so it is not a new event`);
  }
  return problems;
}

export function accessoryDrift(before: AccessoryLock, after: AccessoryLock): string[] {
  const moved = movedFields(before.value as unknown as Record<string, unknown>, after.value as unknown as Record<string, unknown>, [
    "device",
    "worn",
    "dressings",
  ]);
  const device = deviceDrift(before.value, after.value);
  return moved.map((field) => (field === "device" ? `device(${device.join(",") || "same"})` : field));
}
