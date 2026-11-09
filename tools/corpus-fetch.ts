// fetch a corpus that adaption labs invented, and keep it raw.
//
// the sequence is invent -> wait -> download, and the waiting is the part that surprises:
// a twelve row job took about two hours, and for the first minutes the dataset reports
// "running" with no run id while the download route refuses with "no run has started".
// none of that is failure, so this tool polls instead of giving up, and says where it is.
//
//   deno run -A tools/corpus-fetch.ts --pending wardrobe/corpus/pending.json
//
// each finished dataset is written to wardrobe/corpus/raw/<name>.jsonl, exactly as the
// provider sent it. curation is a separate, human step: the generator labels its own
// rewrites generously, and a corpus that inherits those labels inherits the flattery.

const BASE = "https://api.prod.adaptionlabs.ai/api/v1";

interface Pending {
  provider: string;
  runs: { name: string; dataset_id: string; rows: number; fields?: string[]; asked_for?: string; status?: string }[];
}

function key(): string {
  const found = Deno.env.get("ADAPTIONLABS_API_KEY") ?? Deno.env.get("ADAPTION_LABS_API_KEY");
  if (!found) throw new Error("corpus-fetch: no adaption labs key in the environment");
  return found;
}

async function get(path: string): Promise<{ status: number; body: string }> {
  const response = await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${key()}` } });
  return { status: response.status, body: await response.text() };
}

// the jsonl download is csv shaped: a header line, then one quoted prompt and one quoted
// completion per row, with csv quote escaping. parse it as csv, never with split(","),
// and never line by line: the garment blocks contain newlines INSIDE the quoted fields,
// so a split on "\n" turns one thirty row corpus into a hundred and thirteen fragments.
export function rowsFromJsonl(text: string): { prompt: string; completion: string }[] {
  const rows: { prompt: string; completion: string }[] = [];
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  let started = false;
  const flush = (record: boolean) => {
    fields.push(field);
    field = "";
    if (record) {
      if (fields.length >= 2 && (fields[0].trim() || fields[1].trim())) {
        rows.push({ prompt: fields[0].trim(), completion: fields[1].trim() });
      }
      fields.length = 0;
    }
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
      started = true;
      continue;
    }
    if (char === '"') { quoted = true; started = true; continue; }
    if (char === ",") { flush(false); started = true; continue; }
    if (char === "\n") { flush(started); started = false; continue; }
    if (char === "\r") continue;
    field += char;
    started = true;
  }
  if (started || field.length) flush(true);
  // the header is the first record and never survived the old parser either
  return rows.slice(1);
}

// the completion comes back fenced as often as not. ```json ... ``` is not a parse error,
// it is the model formatting for a reader it invented, so strip it rather than dropping
// the row: 24 of the first 40 accessory rows arrived fenced and every one was usable.
export function completionJson(raw: string): Record<string, unknown> | null {
  const text = (raw ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// a prompt can come back with MORE than one completion, as a bare json array, and once
// it came back as the block echoed plus the object, so the first "{" is where the answer
// starts rather than the first character. one row in the file is not one row of data.
export function completionsJson(raw: string): Record<string, unknown>[] {
  let text = (raw ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!text) return [];
  const start = text.search(/[[{]/);
  if (start < 0) return [];
  text = text.slice(start);
  try {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object");
  } catch {
    return [];
  }
}

// the prompt comes back with the generator's own instructions appended after a blank
// line, because it copied the task text into the field it was asked to fill.
export function promptBody(prompt: string): string {
  const cut = prompt.split(/\n\s*\n/)[0] ?? prompt;
  return cut.trim();
}

if (import.meta.main) {
  const flag = Deno.args.indexOf("--pending");
  const path = flag >= 0 ? Deno.args[flag + 1] : "wardrobe/corpus/pending.json";
  const pending = JSON.parse(await Deno.readTextFile(path)) as Pending;
  await Deno.mkdir("wardrobe/corpus/raw", { recursive: true });
  let waiting = 0;
  for (const run of pending.runs) {
    const state = await get(`/datasets/${run.dataset_id}`);
    const parsed = JSON.parse(state.body) as { status?: string; row_count?: number; error_data?: unknown };
    console.log(`${run.name}: ${parsed.status ?? state.status} rows=${parsed.row_count ?? "-"}`);
    if (parsed.status !== "succeeded") { waiting++; continue; }
    const download = await get(`/datasets/${run.dataset_id}/download?file_format=jsonl`);
    if (download.status !== 200) { console.log(`  download refused: ${download.body.slice(0, 120)}`); waiting++; continue; }
    await Deno.writeTextFile(`wardrobe/corpus/raw/${run.name}.jsonl`, download.body);
    const rows = rowsFromJsonl(download.body);
    console.log(`  wrote ${rows.length} rows to wardrobe/corpus/raw/${run.name}.jsonl`);
    run.status = "fetched";
  }
  await Deno.writeTextFile(path, `${JSON.stringify(pending, null, 2)}\n`);
  if (waiting) console.log(`${waiting} still going. they take hours, and re-inventing spends credits again.`);
}
