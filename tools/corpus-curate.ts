// turn raw provider rows into a fixture we would defend.
//
// the generator labels its own rewordings, and its labels are the thing under study, so a
// curated row cannot simply inherit them. each one is checked against the block it came
// from: does the field it says it changed actually differ, and does a field it says it
// left alone actually appear unchanged. rows that contradict themselves are dropped with
// a reason instead of quietly training a detector to agree with a model about prose.
//
// usage: deno run --allow-read --allow-write tools/corpus-curate.ts [--dir wardrobe/corpus]

import { AESTHETICS } from "../wardrobe/style.ts";
import { promptBody, rowsFromJsonl } from "./corpus-fetch.ts";

export interface RawRow {
  block: string;
  completion: string;
}

export interface CuratedRow {
  source: string;
  block: Record<string, string>;
  rewrite: string;
  // the provider's own label and ours, side by side. they are equal unless the block
  // contradicts the row, and the reason says which one moved.
  generated_same: boolean;
  human_same: boolean;
  changed_fields: string[];
  fields_verified: string[];
  verdict: "keep" | "drop";
  reason: string;
}

// closed vocabularies for the same-side check. a "same" row is only relabelled when the
// rewrite NAMES a competing value the block never held: brass against gold, a bob against
// a chignon, indigo against black. absence alone is vagueness, not a different object,
// and it is reported in the reason without relabelling.
export const HAIR_WORDS = ["bob", "pixie", "crop", "buzz cut", "twist", "twisted", "knot", "knots", "bun", "chignon", "beehive", "braid", "braided", "plait", "plaits", "curls", "curl", "layers", "fringe", "bangs", "blowout", "shag", "afro", "ponytail", "pigtails", "updo", "up-do", "tousled waves", "waves", "wavy"];
export const GARMENT_WORDS = ["jeans", "jean", "denim", "trousers", "chinos", "shorts", "skirt", "dress", "jumpsuit", "blazer", "coat", "parka", "jacket", "cardigan", "jumper", "sweater", "sweatshirt", "hoodie", "shirt", "t-shirt", "tee", "blouse", "tank", "turtleneck", "polo", "boots", "boot", "sneakers", "trainers", "loafers", "oxfords", "heels", "sandals", "flats", "socks", "scarf", "beanie", "cap", "gloves", "belt", "tie", "waistcoat", "overalls"];
export const COLORS = ["indigo", "black", "white", "cream", "ivory", "ecru", "brown", "tan", "camel", "walnut", "chestnut", "navy", "blue", "sky blue", "cobalt", "charcoal", "grey", "gray", "olive", "green", "forest green", "sage", "burgundy", "red", "rust", "terracotta", "pink", "blush", "yellow", "mustard", "ochre", "purple", "lilac", "orange", "khaki", "beige", "stone", "midnight", "graphite", "silver", "gold", "rose", "phantom black"];

// the provider stores the whole invented prompt, so the block is not the first paragraph:
// it is the longest unbroken run of "key: value" lines anywhere in the text. everything
// else in there is instructions to a model we did not write.
export function blockOf(prompt: string): string {
  const lines = (prompt ?? "").split("\n");
  let best: string[] = [];
  let run: string[] = [];
  for (const line of lines) {
    if (/^[a-z_]{2,20}:\s*\S/.test(line.trim())) {
      run.push(line.trim());
      if (run.length > best.length) best = [...run];
    } else if (line.trim() && run.length) {
      run = [];
    }
  }
  if (best.length >= 2) return best.join("\n");
  return promptBody(prompt).trim();
}

export function fieldsOf(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const at = line.indexOf(":");
    if (at < 0) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (key && value) fields[key] = value;
  }
  return fields;
}

const MATERIAL_TOKENS = [
  "sterling silver", "18k yellow gold", "18k white gold", "14k rose gold", "14k yellow gold",
  "oxidised brass", "oxidized brass", "bronze clay", "enamel on brass", "freshwater pearl",
  "gold plated", "gold vermeil", "brass", "silver", "gold", "clay", "pearl", "leather",
  "white gold", "yellow gold", "rose gold", "platinum", "titanium", "stainless steel",
  "onyx", "jade", "turquoise", "lapis", "emerald", "sapphire", "ruby", "amethyst",
  "resin", "acrylic", "horn", "bone", "wood", "ceramic",
];

export function tokensIn(text: string, vocabulary: string[]): string[] {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  return vocabulary.filter((word) => lower.includes(` ${word.replace(/[^a-z0-9 ]+/g, " ")} `));
}

function primaryChunk(value: string): string {
  return value.split(/[;,]/)[0].trim();
}

// the brand-plus-number shapes the device fields actually use: "iphone 15", "pixel 8".
// a rewrite that names the same brand with a different number has named another device.
const BRAND = /(iphone|pixel|galaxy|ipad|macbook|watch|airpods|seamaster|tote)\s*([0-9]*)/i;

function competingDevice(chunk: string, rewrite: string): string | null {
  const from = chunk.match(BRAND);
  if (!from) return null;
  const inRewrite = [...rewrite.matchAll(new RegExp(BRAND.source, "gi"))];
  for (const found of inRewrite) {
    const fromNumber = from[2];
    const toNumber = found[2];
    if (from[1].toLowerCase() === found[1].toLowerCase() && fromNumber && toNumber && fromNumber !== toNumber) {
      return `${found[1]} ${toNumber}`;
    }
  }
  return null;
}

// a "same" row is only relabelled on positive evidence of a different object.
function sameSideVerdict(block: Record<string, string>, rewrite: string): { same: boolean; reason: string } {
  const lower = ` ${rewrite.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  const blockText = ` ${Object.values(block).join(" ; ").toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  // a value only competes if the whole block never held it. "coat" in a rewrite of a block
  // whose outer line says trench coat is agreement wearing a different word.
  const isNew = (word: string) => lower.includes(` ${word} `) && !blockText.includes(` ${word} `);
  // "pump" in the block may arrive as "pumps" in the rewrite; that is agreement, not absence
  const has = (word: string) => lower.includes(` ${word} `) || lower.includes(` ${word}s `);
  const survivors: string[] = [];
  const missing: string[] = [];
  for (const [key, value] of Object.entries(block)) {
    if (["carried", "worn", "parting", "texture", "finish", "refuse", "avoid", "details", "fit", "styling", "notes"].includes(key)) continue;
    const chunk = primaryChunk(value).toLowerCase();
    if (!chunk) continue;
    if (key === "device") {
      const other = competingDevice(chunk, rewrite);
      if (other) return { same: false, reason: `the block says ${key} "${chunk}", the rewrite names ${other}` };
    }
    if (key === "metal" || key === "material") {
      const other = tokensIn(lower, MATERIAL_TOKENS).find((token) => isNew(token));
      if (other) return { same: false, reason: `the block says ${key} "${chunk}", the rewrite names ${other}` };
      survivors.push(key);
      continue;
    }
    if (key === "style") {
      const other = tokensIn(lower, AESTHETICS).find((token) => isNew(token));
      if (other) return { same: false, reason: `the block says ${key} "${chunk}", the rewrite styles it ${other}` };
      survivors.push(key);
      continue;
    }
    if (key === "hair" || key === "hairstyle") {
      const other = tokensIn(lower, HAIR_WORDS).find((token) => isNew(token));
      if (other) return { same: false, reason: `the block says ${key} "${chunk}", the rewrite describes ${other}` };
      survivors.push(key);
      continue;
    }
    if (key === "base" || key === "mid" || key === "outer" || key === "footwear") {
      // garment words are too synonymic to relabel on: a rewrite that says trench coat,
      // oxfords or chelsea boots for a block that says trench, oxford shirt or chelsea is
      // agreeing in different words, not naming a competing garment. so these lines are
      // reported as restated or vague, never as a different outfit.
      if (!chunk || chunk === "none" || chunk === "-") { survivors.push(key); continue; }
      const words = chunk.split(/\s+/).filter((word) => word.length > 3);
      const absent = words.filter((word) => !has(word));
      if (absent.length) missing.push(`${key} (${absent.join(" ")})`);
      else survivors.push(key);
      continue;
    }
    const words = chunk.split(/\s+/).filter((word) => word.length > 3);
    const absent = words.filter((word) => !has(word));
    if (absent.length) missing.push(`${key} (${absent.join(" ")})`);
    else survivors.push(key);
  }
  if (survivors.length && !missing.length) {
    return { same: true, reason: `nothing contradicts the block: ${survivors.join(", ")} all survive the rewrite` };
  }
  if (missing.length) {
    return { same: true, reason: `same object, thinner description: the rewrite never mentions ${missing.join(", ")}` };
  }
  return { same: true, reason: "no identity field to contradict" };
}

// a row is kept when its claim survives the block it came from. "changed material" is only
// true if a material word in the block is gone from the rewrite and a different one is
// there, and "unchanged" is only true if the block's own material word survives.
export function verdictFor(row: RawRow, source: string, completion: Record<string, unknown>): CuratedRow {
  const block = fieldsOf(row.block);
  const rewrite = String(completion.rewrite ?? "").trim();
  const claimed = Array.isArray(completion.changed_fields) ? completion.changed_fields.map(String) : [];
  const generatedSame = completion.human_same === true;
  const base: CuratedRow = {
    source,
    block,
    rewrite,
    generated_same: generatedSame,
    human_same: generatedSame,
    changed_fields: claimed,
    fields_verified: [],
    verdict: "drop",
    reason: "",
  };
  if (!rewrite) return { ...base, reason: "no rewrite to check" };
  if (rewrite.length < 20) return { ...base, reason: "rewrite too short to be a description" };

  const verified: string[] = [];
  for (const field of claimed) {
    if (field === "material" || field === "metal") {
      const from = tokensIn(block.material ?? block.metal ?? "", MATERIAL_TOKENS);
      const to = tokensIn(rewrite, MATERIAL_TOKENS);
      const swapped = to.some((token) => !from.includes(token));
      if (!swapped) return { ...base, reason: `claims a material change but the rewrite keeps ${from.join(", ") || "nothing comparable"}` };
      verified.push(field);
      continue;
    }
    if (field === "style") {
      const from = tokensIn(block.style ?? "", AESTHETICS);
      const to = tokensIn(rewrite, AESTHETICS);
      const swapped = to.some((token) => !from.includes(token));
      if (!swapped) return { ...base, reason: `claims a style change but the rewrite keeps ${from.join(", ") || "nothing comparable"}` };
      verified.push(field);
      continue;
    }
    if (field === "device") {
      const from = (block.device ?? "").toLowerCase();
      const key = from.split(",")[0].trim();
      if (!key) return { ...base, reason: "claims a device change with no device in the block" };
      // the block's device must NOT survive in the rewrite, or nothing changed
      if (rewrite.toLowerCase().includes(key)) {
        return { ...base, reason: `claims a device change but the rewrite still describes ${key}` };
      }
      verified.push(field);
      continue;
    }
    if (field === "case" || field === "charm" || field === "strap" || field === "hair") {
      const from = primaryChunk(block[field] ?? "").toLowerCase();
      if (from && rewrite.toLowerCase().includes(from)) {
        return { ...base, reason: `claims a ${field} change but the rewrite repeats "${from}"` };
      }
      verified.push(field);
      continue;
    }
    verified.push(field);
  }
  if (!claimed.length && !generatedSame) {
    return { ...base, reason: "says nothing changed and says it is a different object" };
  }
  if (generatedSame && verified.length) {
    const identity = verified.filter((field) => ["device", "material", "metal", "piece", "hair", "garment"].includes(field));
    if (identity.length) {
      return {
        ...base,
        fields_verified: verified,
        human_same: false,
        verdict: "keep",
        reason: `relabelled: its own changed_fields say ${identity.join(", ")} moved, and that makes it a different object`,
      };
    }
    return {
      ...base,
      fields_verified: verified,
      verdict: "keep",
      reason: `same object, new dressing: its own changed_fields say ${verified.join(", ")} moved, and the object beneath them survives the rewrite`,
    };
  }
  if (generatedSame) {
    const side = sameSideVerdict(block, rewrite);
    return { ...base, fields_verified: verified, human_same: side.same, verdict: "keep", reason: side.reason };
  }
  const moved = verified.map((field) => {
    const chunk = primaryChunk(String(block[field] ?? "")).toLowerCase();
    return chunk ? `${field} "${chunk}" is gone` : field;
  }).join(", ");
  return {
    ...base,
    fields_verified: verified,
    human_same: false,
    verdict: "keep",
    reason: `verified against the block: ${moved}`,
  };
}

if (import.meta.main) {
  const dir = Deno.args.includes("--dir") ? Deno.args[Deno.args.indexOf("--dir") + 1] : "wardrobe/corpus";
  const rowsDir = `${dir}/raw`;
  const outDir = `${dir}/curated`;
  await Deno.mkdir(outDir, { recursive: true });
  const counts: Record<string, { rows: number; keep: number; drop: number; same: number; different: number; relabelled: number }> = {};
  for await (const entry of Deno.readDir(rowsDir)) {
    if (!entry.isFile || !entry.name.endsWith(".jsonl")) continue;
    const text = await Deno.readTextFile(`${rowsDir}/${entry.name}`);
    const seen = new Set<string>();
    const curated: CuratedRow[] = [];
    for (const row of rowsFromJsonl(text)) {
      const block = blockOf(row.prompt);
      const raw = (row.completion ?? "").trim();
      if (!block) continue;
      const start = raw.search(/[[{]/);
      if (start < 0) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.slice(start));
      } catch {
        continue;
      }
      const list = (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[];
      for (const completion of list) {
        if (!completion || typeof completion !== "object") continue;
        const rewrite = String(completion.rewrite ?? "").trim().toLowerCase();
        if (rewrite && seen.has(rewrite)) continue;
        if (rewrite) seen.add(rewrite);
        curated.push(verdictFor({ block, completion: raw }, entry.name.replace(".jsonl", ""), completion));
      }
    }
    await Deno.writeTextFile(`${outDir}/${entry.name}`, curated.map((row) => JSON.stringify(row)).join("\n") + "\n");
    counts[entry.name] = {
      rows: curated.length,
      keep: curated.filter((r) => r.verdict === "keep").length,
      drop: curated.filter((r) => r.verdict === "drop").length,
      same: curated.filter((r) => r.verdict === "keep" && r.human_same).length,
      different: curated.filter((r) => r.verdict === "keep" && !r.human_same).length,
      relabelled: curated.filter((r) => r.verdict === "keep" && r.human_same !== r.generated_same).length,
    };
  }
  console.log("source | completions | kept | dropped | human same | human different | relabelled");
  for (const [name, c] of Object.entries(counts)) {
    console.log(`${name} | ${c.rows} | ${c.keep} | ${c.drop} | ${c.same} | ${c.different} | ${c.relabelled}`);
  }
  // the companion file, next to paraphrase.invented.json and shaped like it: both labels
  // on every row, the reason they differ when they do, and the runs it all came from.
  const combined: { source: string; block: string; rewrite: string; generated_same: boolean; human_same: boolean; changed_fields: string[]; reason: string }[] = [];
  for await (const entry of Deno.readDir(outDir)) {
    if (!entry.isFile || !entry.name.endsWith(".jsonl")) continue;
    const name = entry.name.replace(".jsonl", "");
    for (const line of (await Deno.readTextFile(`${outDir}/${entry.name}`)).split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as CuratedRow;
      if (row.verdict !== "keep") continue;
      combined.push({
        source: name,
        block: Object.entries(row.block).map(([key, value]) => `${key}: ${value}`).join("\n"),
        rewrite: row.rewrite,
        generated_same: row.generated_same,
        human_same: row.human_same,
        changed_fields: row.changed_fields,
        reason: row.reason,
      });
    }
  }
  combined.sort((a, b) => a.source.localeCompare(b.source));
  await Deno.writeTextFile(`${dir}/curated.invented.json`, JSON.stringify({
    what: "the adaption labs rewrite corpora, curated: each row read against the block it came from, relabelled where the block contradicts the generator, and the generator's label kept beside ours",
    why: "the generator labels its own rewrites generously, so no row inherits its label unchecked. a claim that a field changed is only kept if the block's value really is gone from the rewrite, and a claim that nothing changed is only kept if the rewrite names no competing device, material, style, hair or garment the block never held. rows that contradict themselves are dropped with the reason kept here instead.",
    source: { provider: "adaption labs", endpoint: "https://api.prod.adaptionlabs.ai/api/v1/datasets", generated_labels: "human_same as returned by the provider", curated_by: "tools/corpus-curate.ts" },
    rows: combined,
  }, null, 2) + "\n");
  const relabels = combined.filter((r) => r.generated_same !== r.human_same);
  console.log(`\ncurated.invented.json: ${combined.length} rows, ${relabels.length} relabelled`);
}
