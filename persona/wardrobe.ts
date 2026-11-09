// the wardrobe: what she is wearing, decoupled from who she is.
//
// a person is the same person in a different shirt. identity and outfit are two
// layers: the identity block is authored once and reused verbatim, the outfit
// is chosen for the day, locked for the shoot, replaceable tomorrow. baking a
// garment into the character block is how a persona wears one outfit forever.

import { stripJsonc } from "./loader.ts";

export interface Garment {
  kind: string;
  detail: string;
}

export interface Outfit {
  id: string;
  name: string;
  garments: Garment[];
  palette: string[];
  accessories?: string[];
  avoid?: string[];
  season?: "warm" | "cold" | "any";
}

export interface Wardrobe {
  persona: string;
  outfits: Outfit[];
  default_outfit?: string;
}

export function outfitBlock(outfit: Outfit): string {
  const worn = outfit.garments.map((g) => `${g.kind} in ${g.detail}`).join("; ");
  const parts = [worn];
  if (outfit.palette.length) parts.push(`palette: ${outfit.palette.join(", ")}`);
  if (outfit.accessories?.length) parts.push(`accessories: ${outfit.accessories.join(", ")}`);
  return parts.join(". ") + ".";
}

export function outfitFingerprint(outfit: Outfit): string {
  return [outfit.id, ...outfit.garments.map((g) => `${g.kind}:${g.detail}`), outfit.palette.join(",")].join("|");
}

export function outfitProblems(outfit: Outfit): string[] {
  const problems: string[] = [];
  if (!outfit.id || !/^[a-z0-9_-]+$/.test(outfit.id)) problems.push(`${outfit.id || "?"}: id must be a lowercase slug`);
  if (!outfit.name?.trim()) problems.push(`${outfit.id}: name required`);
  if (!outfit.garments?.length) problems.push(`${outfit.id}: at least one garment`);
  for (const g of outfit.garments ?? []) {
    if (!g.kind?.trim()) problems.push(`${outfit.id}: garment without a kind`);
    if ((g.detail ?? "").trim().length < 3) problems.push(`${outfit.id}: ${g.kind || "garment"} needs detail`);
  }
  if (!outfit.palette?.length) problems.push(`${outfit.id}: palette required`);
  return problems;
}

export function wardrobeProblems(wardrobe: Wardrobe): string[] {
  const problems: string[] = [];
  if (!wardrobe.persona) problems.push("persona: required");
  if (!wardrobe.outfits?.length) problems.push("outfits: at least one");
  const seen = new Set<string>();
  for (const outfit of wardrobe.outfits ?? []) {
    for (const p of outfitProblems(outfit)) problems.push(`outfits.${p}`);
    if (seen.has(outfit.id)) problems.push(`outfits.${outfit.id}: duplicate id`);
    seen.add(outfit.id);
  }
  if (wardrobe.default_outfit && !seen.has(wardrobe.default_outfit)) {
    problems.push(`default_outfit: ${wardrobe.default_outfit} is not in the wardrobe`);
  }
  return problems;
}

export function parseWardrobe(src: string): Wardrobe {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonc(src));
  } catch (err) {
    throw new Error(`wardrobe: not valid jsonc: ${(err as Error).message}`);
  }
  const wardrobe = parsed as Wardrobe;
  const problems = wardrobeProblems(wardrobe);
  if (problems.length) throw new Error(`wardrobe: invalid:\n  ${problems.join("\n  ")}`);
  return wardrobe;
}

export function outfitForId(wardrobe: Wardrobe, id: string): Outfit {
  const outfit = wardrobe.outfits.find((o) => o.id === id);
  if (!outfit) {
    throw new Error(`wardrobe: no outfit "${id}" (have: ${wardrobe.outfits.map((o) => o.id).join(", ")})`);
  }
  return outfit;
}

// the day's outfit: deterministic, not random. the same day gives the same
// outfit, so a re-run is the same person; tomorrow is a different day.
export function outfitForDay(wardrobe: Wardrobe, isoDay: string): Outfit {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) {
    throw new Error(`wardrobe: day must be YYYY-MM-DD, got ${isoDay}`);
  }
  const sorted = [...wardrobe.outfits].sort((a, b) => a.id.localeCompare(b.id));
  const start = Date.UTC(Number(isoDay.slice(0, 4)), 0, 1);
  const day = Math.floor((Date.parse(`${isoDay}T00:00:00Z`) - start) / 86400000);
  return sorted[day % sorted.length];
}
