// the adjectives that actually decide whether two descriptions are the same object.
//
// "silver minimalistic" and "gold chunky" are not flourishes: they are the two axes a
// viewer reads first. material is what it is made of, and style is how it is made. a
// hammered brass cuff and a polished brass cuff are one material and two objects, and a
// clay bead necklace and a pearl necklace are neither.
//
// material keeps the legal rule from 16 cfr 23 where it applies (gold needs a karat, gold
// coloured is an appearance) and drops it where it does not: clay has no fineness, and
// demanding one would be exactly the kind of rule that gets worked around.

export const AESTHETICS: string[] = [
  "minimal",
  "minimalistic",
  "delicate",
  "chunky",
  "statement",
  "sculptural",
  "colourful",
  "colorful",
  "rustic",
  "organic",
  "beaded",
  "hammered",
  "polished",
  "matte",
  "glossy",
  "brushed",
  "engraved",
  "vintage",
];

const PRECIOUS = /\b(gold|silver|platinum|palladium|vermeil|sterling)\b/i;
const FINENESS = /\b(\d{1,2}\s?(k|kt|karat)|925|950|999|sterling|plated|plate|filled|overlay|vermeil)\b/i;
const BASE_METAL = /\b(brass|bronze|copper|steel|titanium|pewter|niobium|aluminium|aluminum|iron|zinc)\b/i;
const NON_METAL = /\b(clay|ceramic|porcelain|resin|enamel|glass|pearl|shell|wood|horn|bone|leather|suede|canvas|fabric|cotton|silk|velvet|wool|merino|cashmere|silicone|acrylic|bead|beads|stone|gemstone|feather|raffia|straw|felt|nylon|cord|rope|lucite)\b/i;
const VAGUE = /\b(gold[- ]?colou?red|gold[- ]?tone|golden|silver[- ]?colou?red|silver[- ]?tone|precious metal|mixed metal|metal|shiny|nice)\b/i;

export function materialProblems(material: string): string[] {
  const text = (material ?? "").trim();
  if (text.length < 3) return ["material required, because silver and clay are not the same object"];
  const problems: string[] = [];
  if (VAGUE.test(text)) {
    problems.push(`material "${text}" names an appearance, not a material. 16 cfr 23 treats gold, gold plated and vermeil as three products`);
  }
  if (PRECIOUS.test(text) && !FINENESS.test(text)) {
    problems.push(`material "${text}" has no karat or alloy, and gold without a fineness is the vaguest word in the sentence`);
  }
  if (!PRECIOUS.test(text) && !BASE_METAL.test(text) && !NON_METAL.test(text)) {
    problems.push(`material "${text}" is not a material this vocabulary knows. say the substance, or add it to style.ts`);
  }
  return problems;
}

export function styleProblems(style: string[]): string[] {
  const problems: string[] = [];
  if (!(style ?? []).length) return ["style required: minimal, chunky, colourful and rustic are four different objects to a viewer"];
  for (const word of style) {
    if (!AESTHETICS.includes(word.trim().toLowerCase())) {
      problems.push(`style "${word}" is not in the vocabulary (${AESTHETICS.slice(0, 8).join(", ")}, ...)`);
    }
  }
  if (new Set(style).size !== style.length) problems.push("style repeats itself");
  if (style.length > 3) problems.push("style carries three words at most, or it stops being a direction");
  return problems;
}

// two words for the model, because a viewer reads material then style and never the other
// way round.
export function styleBlock(material: string, style: string[]): string {
  return [`material: ${material.trim()}`, `style: ${style.map((word) => word.trim().toLowerCase()).join(", ")}`].join("\n");
}
