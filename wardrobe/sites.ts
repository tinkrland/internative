// where a thing is worn, as a path, because "accessory" was hiding the whole problem.
//
// a wardrobe slot answers "what layer is it", and for clothes that is enough. for what
// she wears it answers nothing: a beanie and a belt are both accessories and share no
// frame of reference, while an earring and an airpod share an ear and must not share a
// hole. so the axis is the body, in paths, and every site says which slots it holds:
//
//   hair            hats, beanies, berets, caps, hairbands, bandanas, scrunchies, clips
//   face/eyes       glasses, sunglasses, a vr headset
//   face/nose       nostril, septum, bridge
//   face/lips       labret, lip ring
//   ears/piercings  lobe, helix, tragus, conch, daith, rook, industrial
//   ears/hearing    earbuds, headphones, a hearing aid, earplugs
//   neck            necklaces, chokers, pendants, a scarf
//   waist           belts, chain belts
//   bags            tote, shoulder, clutch, backpack
//   wrists          a watch, bracelets
//   hands           rings
//   ankles          anklets
//
// two consequences fall out of it and both are checks rather than conventions. one item
// per (site, slot, side): she cannot wear two beanies, and she CAN wear two lobe earrings
// because they are on different sides. and ears/piercings is separate from ears/hearing
// because a hoop and an earbud are anatomically in the same place and never the same
// object.

export type Side = "left" | "right" | "both" | "none";

export interface SiteSpec {
  path: string;
  // the slots this site holds. a belt on the neck is not a styling choice.
  slots: string[];
  // sites that come in twos, so a lobe earring must say which ear
  paired: boolean;
}

export const SITES: SiteSpec[] = [
  { path: "hair", slots: ["hat", "beanie", "beret", "cap", "hairband", "bandana", "scrunchie", "clip"], paired: false },
  { path: "face/eyes", slots: ["glasses", "sunglasses", "vr"], paired: false },
  { path: "face/nose", slots: ["nostril", "septum", "bridge"], paired: true },
  { path: "face/lips", slots: ["labret", "lipring"], paired: false },
  { path: "ears/piercings", slots: ["lobe", "helix", "tragus", "conch", "daith", "rook", "industrial"], paired: true },
  { path: "ears/hearing", slots: ["earbud", "headphones", "hearingaid", "earplug"], paired: true },
  { path: "neck", slots: ["necklace", "choker", "pendant", "scarf"], paired: false },
  { path: "waist", slots: ["belt", "chain"], paired: false },
  { path: "bags", slots: ["tote", "shoulder", "clutch", "backpack"], paired: false },
  { path: "wrists", slots: ["watch", "bracelet"], paired: true },
  { path: "hands", slots: ["ring"], paired: true },
  { path: "ankles", slots: ["anklet"], paired: true },
];

export const SITE_PATHS: string[] = SITES.map((site) => site.path);

// the taxonomy above is a human body, and a persona is not always one. a dog has a muzzle
// and a tail, a robot has a chassis, a product has nothing but a surface. rather than
// inventing a pseudo-human slot for those, a body registers its own sites and the same
// occupancy rules apply, because two collars on one neck is two collars whatever wears them.
export function registerSite(spec: SiteSpec): void {
  if (!/^[a-z]+(?:\/[a-z]+)*$/.test(spec.path)) throw new Error(`site "${spec.path}" is not a path`);
  if (siteSpec(spec.path)) throw new Error(`site "${spec.path}" already exists`);
  if (!spec.slots.length) throw new Error(`site "${spec.path}" holds nothing`);
  if (new Set(spec.slots).size !== spec.slots.length) throw new Error(`site "${spec.path}" repeats a slot`);
  SITES.push(spec);
  SITE_PATHS.push(spec.path);
}

export function siteSpec(path: string): SiteSpec | undefined {
  return SITES.find((site) => site.path === path);
}

export function siteProblems(path: string, slot: string, side: Side = "none", who = "item"): string[] {
  const problems: string[] = [];
  const spec = siteSpec(path);
  if (!spec) {
    problems.push(`${who}: "${path}" is not a site. the paths are ${SITE_PATHS.join(", ")}`);
    return problems;
  }
  if (!spec.slots.includes(slot)) {
    problems.push(`${who}: a ${slot} does not go on ${path}. ${path} holds ${spec.slots.join(", ")}`);
  }
  if (!["left", "right", "both", "none"].includes(side)) {
    problems.push(`${who}: side must be left, right, both or none`);
  } else if (spec.paired && side === "none") {
    problems.push(`${who}: ${path} comes in twos, so say which one. "both" is a legal answer`);
  } else if (!spec.paired && side !== "none") {
    problems.push(`${who}: ${path} is not a paired site, so a side means nothing there`);
  }
  return problems;
}

export interface Sited {
  site: string;
  slot: string;
  side?: Side;
}

const key = (item: Sited) => `${item.site}/${item.slot}/${item.side ?? "none"}`;

// the occupancy gate, across everything she is wearing at once: accessories, jewelry and
// the site items together, because the collision does not care which module made them.
export function occupancyProblems(items: Sited[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, number>();
  for (const item of items) {
    const at = key(item);
    seen.set(at, (seen.get(at) ?? 0) + 1);
  }
  for (const [at, count] of seen) {
    if (count > 1) {
      const [site, slot, side] = at.split("/");
      problems.push(
        `${at}: ${count} things on the ${slot}${side === "none" ? "" : ` (${side})`} of ${site}. ` +
          `one per place, and two earrings need two sides.`,
      );
    }
  }
  return problems;
}
