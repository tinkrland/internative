// turning a photo of somebody wearing a thing into a flat product plate.
//
// every closet app already does this: whering takes a screenshot and cuts the background, stylebook
// calls it "ai background removal" and adds clothes by clipping from the web, alta does it while
// guessing fabric and fit. so the feature is not the cutout. the feature is doing it without
// pretending the result is evidence.
//
// three things a cutout cannot be:
//
//   a worn plate      a plate derived from a photo of a body is not a plate of her body, and the
//                     only honest use is the flat one
//   hers              a pinterest pin is not a licence, whatever the screenshot looks like
//   a description     pixels still do not know the fibre, the fit, or the name of the colour
//
// so a flattened plate arrives with its derivation attached and the item stays a candidate until
// a person writes what a render needs.

import { digestOf } from "../lock.ts";

export type ImportSource = "own" | "screenshot" | "shop" | "pinterest";
export type Licence = "owned" | "permitted" | "unknown";

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
}

export interface FlatPlate {
  id: string;
  uri: string;
  role: "flat";
  derivation: {
    from: string;
    method: "cutout";
    background: "studio_white";
    removed: string[];
  };
  credit?: string;
  // a plate whose source licence is unknown owes every caption a line
  disclosure: boolean;
  digest: string;
}

// the rule the closet apps do not have. a pin is not a licence, and claiming one is the only way
// this pipeline can produce something that looks owned and is not.
export function importProblems(photo: ImportPhoto): string[] {
  const problems: string[] = [];
  if (!photo.id?.trim() || !photo.uri?.trim()) problems.push("photo: an id and a uri, or the plate has nothing to point at");
  if (!photo.garment_fully_visible) {
    problems.push("photo: the garment is not fully visible, and a sleeve is not a garment");
  }
  if ((photo.source === "pinterest" || photo.source === "shop") && photo.licence === "owned") {
    problems.push(`photo: a ${photo.source} image is not owned, so the licence cannot be "owned"`);
  }
  if (photo.licence === "permitted" && !photo.credit?.trim()) {
    problems.push("photo: permission without a credit is permission nobody can check");
  }
  return problems;
}

const REMOVED_WITH_PERSON = ["background", "person", "face", "hands"];
const REMOVED_NO_PERSON = ["background"];

export async function planFlatten(photo: ImportPhoto): Promise<FlatPlate> {
  const problems = importProblems(photo);
  if (problems.length) throw new Error(`refusing to flatten:\n- ${problems.join("\n- ")}`);
  const body = {
    id: `${photo.id}-flat`,
    uri: photo.uri,
    role: "flat" as const,
    derivation: {
      from: photo.id,
      method: "cutout" as const,
      background: "studio_white" as const,
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
  return problems;
}

// the line a caption owes when the plate is a cutout from somebody else's photo
export function disclosureLine(plate: FlatPlate): string | null {
  if (!plate.disclosure) return null;
  const who = plate.credit ? ` (photo: ${plate.credit})` : "";
  return `the piece is shown as a cutout from a photograph, not a picture of me wearing it${who}`;
}
