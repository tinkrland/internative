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
  labelled_same: boolean;
  fields_claimed: string[];
  fields_verified: string[];
  verdict: "keep" | "drop";
  reason?: string;
}

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
];

export function tokensIn(text: string, vocabulary: string[]): string[] {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  return vocabulary.filter((word) => lower.includes(` ${word.replace(/[^a-z0-9 ]+/g, " ")} `));
}

// a row is kept when its claim survives the block it came from. "changed material" is only
// true if a material word in the block is gone from the rewrite and a different one is
// there, and "unchanged" is only true if the block's own material word survives.
export function verdictFor(row: RawRow, source: string, completion: Record<string, unknown>): CuratedRow {
  const block = fieldsOf(row.block);
  const rewrite = String(completion.rewrite ?? "").trim();
  const claimed = Array.isArray(completion.changed_fields) ? completion.changed_fields.map(String) : [];
  const labelledSame = completion.human_same === true;
  const base: CuratedRow = {
    source,
    block,
    rewrite,
    labelled_same: labelledSame,
    fields_claimed: claimed,
    fields_verified: [],
    verdict: "drop",
  };
  if (!rewrite) return { ...base, reason: "no rewrite to check" };
  if (rewrite.length < 20) return { ...base, reason: "rewrite too short to be a description" };

  const verified: string[] = [];
  for (const field of claimed) {
    if (field === "material") {
      const from = tokensIn(block.material ?? "", MATERIAL_TOKENS);
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
    if (field === "case" || field === "charm" || field === "strap") {
      const from = (block[field] ?? "").toLowerCase().split(",")[0].trim();
      if (from && rewrite.toLowerCase().includes(from)) {
        return { ...base, reason: `claims a ${field} change but the rewrite repeats "${from}"` };
      }
      verified.push(field);
      continue;
    }
    verified.push(field);
  }
  if (!claimed.length && !labelledSame) {
    return { ...base, reason: "says nothing changed and says it is a different object" };
  }
  return { ...base, fields_verified: verified, verdict: "keep" };
}

if (import.meta.main) {
  const dir = Deno.args.includes("--dir") ? Deno.args[Deno.args.indexOf("--dir") + 1] : "wardrobe/corpus";
  const rowsDir = `${dir}/raw`;
  const outDir = `${dir}/curated`;
  await Deno.mkdir(outDir, { recursive: true });
  const counts: Record<string, { rows: number; keep: number; drop: number; same: number; different: number }> = {};
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
      same: curated.filter((r) => r.verdict === "keep" && r.labelled_same).length,
      different: curated.filter((r) => r.verdict === "keep" && !r.labelled_same).length,
    };
  }
  console.log("source | completions | kept | dropped | kept same | kept different");
  for (const [name, c] of Object.entries(counts)) {
    console.log(`${name} | ${c.rows} | ${c.keep} | ${c.drop} | ${c.same} | ${c.different}`);
  }
}
