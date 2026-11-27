// turning a photo of somebody wearing a thing into a flat plate, and then into a closet item.
//
// this is the seam between two halves that were written apart: wardrobe/flatten.ts knew how to
// describe a cutout, media/inventory.ts knew what a closet item is. wiring them closed three gaps.
//
// one: planFlatten used to name a transformation it never performed. it set uri = photo.uri and
// method = "cutout", so a "flat plate" could be the worn photograph with a new label. now the
// cutout is an input, and a plate that points at the photograph is refused, because a plate that
// points at the photograph is a photograph.
//
// two: nothing turned a capture into a candidate. captureItem does, and it refuses a pinterest pin
// rather than picking a source for it: a pin is neither hers nor a shop window.
//
// three: layer is required by the closet and guessed from pixels by vision, so it arrives marked
// "suggested" and inventory refuses a confirmed item whose layer nobody signed off.

import type { ClosetItem, ItemSource, Layer } from "./inventory.ts";

export type ImportSource = "own" | "screenshot" | "shop" | "pinterest";
export type Licence = "owned" | "permitted" | "unknown";
// the app a screenshot came out of. "screenshot" alone is not a source.
export type ClosetApp = "whering" | "alta" | "wardrowbe" | "stylebook";

export interface ImportPhoto {
  id: string;
  uri: string;
  source: ImportSource;
  licence: Licence;
  // is there a person in the frame, wearing it
  shows_person: boolean;
  // is the whole garment visible, or is this a sleeve and a shoulder
  garment_fully_visible: boolean;
  // who took it, when that is known
  credit?: string;
  // required when the source is a screenshot: which app did it come from
  app?: ClosetApp;
}

// what a cutout stage hands back. this pipeline does not cut pixels; it refuses to pretend it did.
export interface Cutout {
  uri: string;
  background?: "studio_white";
}

export interface FlatPlate {
  id: string;
  uri: string;
  role: "flat";
  derivation: {
    from: string;
    // the photograph itself, so the guard can compare it with uri without a lookup
    from_uri: string;
    method: "cutout";
    background: "studio_white";
    removed: string[];
  };
  credit?: string;
  disclosure: boolean;
  digest: string;
}

// the rule the closet apps do not have: a pin is not a licence, and claiming one is the only way
// this pipeline can produce something that looks owned and is not.
export function importProblems(photo: ImportPhoto): string[] {
  const problems: string[] = [];
  if (!photo.id?.trim() || !photo.uri?.trim()) problems.push("photo: an id and a uri, or the plate has nothing to point at");
  if (!photo.garment_fully_visible) problems.push("photo: the garment is not fully visible, and a sleeve is not a garment");
  if ((photo.source === "pinterest" || photo.source === "shop") && photo.licence === "owned") {
    problems.push(`photo: a ${photo.source} image is not owned, so the licence cannot be "owned"`);
  }
  if (photo.licence === "permitted" && !photo.credit?.trim()) {
    problems.push("photo: permission without a credit is permission nobody can check");
  }
  if (photo.source === "screenshot" && !photo.app) {
    problems.push('photo: a screenshot has to name the app it came from, because "screenshot" alone is not a source');
  }
  return problems;
}

const REMOVED_WITH_PERSON = ["background", "person", "face", "hands"];
const REMOVED_NO_PERSON = ["background"];

// a canonical digest, local to this file so the head needs no lock module to describe a plate
export async function digestOf(value: unknown): Promise<string> {
  const canonical = (v: unknown): string => {
    if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`);
    return `{${entries.join(",")}}`;
  };
  const bytes = new TextEncoder().encode(canonical(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function planFlatten(photo: ImportPhoto, cutout: Cutout): Promise<FlatPlate> {
  const problems = importProblems(photo);
  if (!cutout?.uri?.trim()) problems.push("cutout: a cutout needs a uri, or there is no plate");
  if (cutout?.uri && cutout.uri === photo.uri) {
    problems.push("cutout: the plate points at the photograph, and a plate that points at the photograph is a photograph, not a cutout");
  }
  if (problems.length) throw new Error(`refusing to flatten:\n- ${problems.join("\n- ")}`);
  const body = {
    id: `${photo.id}-flat`,
    uri: cutout.uri,
    role: "flat" as const,
    derivation: {
      from: photo.id,
      from_uri: photo.uri,
      method: "cutout" as const,
      background: cutout.background ?? ("studio_white" as const),
      removed: photo.shows_person ? REMOVED_WITH_PERSON : REMOVED_NO_PERSON,
    },
    ...(photo.credit ? { credit: photo.credit } : {}),
    disclosure: photo.licence === "unknown",
  };
  return { ...body, digest: await digestOf(body) };
}

// a derived plate is a flat plate. it can never be the worn plate, because the body in the source
// is somebody else's and the whole point of a worn plate is that it is hers.
export function plateProblems(plate: FlatPlate, context: { itemId: string; wants: "flat" | "worn" | "detail" }): string[] {
  const problems: string[] = [];
  if (context.wants !== "flat") {
    problems.push(`${context.itemId}: a plate derived from ${plate.derivation.from} cannot be the ${context.wants} plate. a cutout is not a photograph of her`);
  }
  if (!plate.derivation.from?.trim()) {
    problems.push(`${context.itemId}: the plate does not say which photo it came from, so nothing downstream can check the licence`);
  }
  // the guard that holds for plates built somewhere other than planFlatten
  if (plate.derivation.from_uri && plate.uri === plate.derivation.from_uri) {
    problems.push(`${context.itemId}: the plate is the source photograph with a role, and no cutout happened`);
  }
  return problems;
}

// the line a caption owes when the plate is a cutout from somebody else's photo
export function disclosureLine(plate: FlatPlate): string | null {
  if (!plate.disclosure) return null;
  const who = plate.credit ? ` (photo: ${plate.credit})` : "";
  return `the piece is shown as a cutout from a photograph, not a picture of me wearing it${who}`;
}

// where a capture came from, in the closet's vocabulary. pinterest returns null on purpose: the
// map is not made total by guessing.
export function sourceFor(photo: ImportPhoto): { source?: ItemSource; problem?: string } {
  switch (photo.source) {
    case "own":
      return { source: "photo" };
    case "screenshot":
      return photo.app ? { source: photo.app } : { problem: "photo: a screenshot needs the app it came from" };
    case "shop":
      return { source: "ltk" };
    case "pinterest":
      return { problem: "photo: a pin is neither hers nor a shop window, so it is not a closet source. keep the cutout as a reference and buy the piece" };
  }
}

// a capture becomes a candidate. the empty kind, detail and palette are the work, not defects:
// pixels do not know the fibre, the fit or the name of the colour.
export async function captureItem(
  photo: ImportPhoto,
  cutout: Cutout,
  opts: { id: string; layer: Layer; seasons?: Array<"warm" | "cold"> },
): Promise<{ item?: ClosetItem; plate?: FlatPlate; problems: string[] }> {
  const mapped = sourceFor(photo);
  if (mapped.problem) return { problems: [mapped.problem] };
  let plate: FlatPlate;
  try {
    plate = await planFlatten(photo, cutout);
  } catch (error) {
    return { problems: String((error as Error).message).split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2)) };
  }
  const line = disclosureLine(plate);
  return {
    plate,
    problems: [],
    item: {
      id: opts.id,
      kind: "",
      detail: "",
      layer: opts.layer,
      layer_source: "suggested",
      palette: [],
      source: mapped.source as ItemSource,
      state: "candidate",
      ref: plate.id,
      seasons: opts.seasons,
      ...(line ? { notes: line } : {}),
    },
  };
}
