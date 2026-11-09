// the style layer, which is not the wardrobe itself.
//
// personas/<id>.wardrobe.jsonc says what she wears on a given day. this says what
// any outfit of hers has in common, so a new outfit invented tomorrow still looks
// like it belongs to her. the head's inventory rules decide what is hers; this
// decides what is her.

export interface WardrobeStyle {
  silhouette: string;
  // the three to six colours that appear across a season. more than that is a
  // different person's closet.
  palette_anchors: string[];
  materials: string[];
  occasion_defaults: Record<string, string>;
  // required, because a style with no refusals is a mood board
  never_wear: string[];
  rotation: "day-hash" | "seasonal";
}

const HEX = /^#[0-9a-f]{6}$/i;

export function styleProblems(style: WardrobeStyle): string[] {
  const problems: string[] = [];
  if ((style.silhouette ?? "").trim().length < 3) problems.push("silhouette: required");
  const palette = style.palette_anchors ?? [];
  if (palette.length < 3) problems.push("palette_anchors: fewer than three colours is a single outfit, not a wardrobe");
  if (palette.length > 6) problems.push("palette_anchors: more than six is two wardrobes");
  for (const colour of palette) if (!HEX.test(colour)) problems.push(`palette_anchors: "${colour}" is not a hex colour`);
  if (!style.materials?.length) problems.push("materials: what it is made of, not just what it looks like");
  if (!style.never_wear?.length) problems.push("never_wear: a style that refuses nothing is a mood board");
  if (!["day-hash", "seasonal"].includes(style.rotation)) problems.push("rotation: day-hash or seasonal, and nothing else");
  if (!style.occasion_defaults || Object.keys(style.occasion_defaults).length === 0) {
    problems.push("occasion_defaults: what she wears to a shoot, a call and a night out");
  }
  return problems;
}

export function styleBlock(style: WardrobeStyle): string {
  return [
    `silhouette: ${style.silhouette}`,
    `palette: ${style.palette_anchors.join(", ")}`,
    `materials: ${style.materials.join(", ")}`,
    `never: ${style.never_wear.join(", ")}`,
  ].join(". ") + ".";
}

// whether an authored outfit would read as hers, before it is ever rendered
export function outfitFitsStyle(style: WardrobeStyle, palette: string[], kinds: string[]): string[] {
  const problems: string[] = [];
  const anchors = new Set(style.palette_anchors.map((c) => c.toLowerCase()));
  const foreign = palette.filter((c) => !anchors.has(c.toLowerCase()));
  if (palette.length && foreign.length === palette.length) {
    problems.push(`palette: none of ${palette.join(", ")} is an anchor colour, so this outfit is someone else's`);
  }
  for (const kind of kinds) {
    // "logos" on the never list has to catch a "logo hoodie", so the plural is not
    // the thing being matched against
    const hit = style.never_wear.find((banned) =>
      kind.toLowerCase().includes(banned.toLowerCase().replace(/s$/, ""))
    );
    if (hit) {
      problems.push(`${kind}: on the never list`);
    }
  }
  return problems;
}
