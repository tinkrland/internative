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
// completion per row, with csv quote escaping. parse it as csv, never with split(",").
export function rowsFromJsonl(text: string): { prompt: string; completion: string }[] {
  const rows: { prompt: string; completion: string }[] = [];
  const lines = text.split("\n").filter((line) => line.trim().length);
  for (const line of lines.slice(1)) {
    const fields: string[] = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (quoted) {
        if (char === '"' && line[i + 1] === '"') { field += '"'; i++; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { fields.push(field); field = ""; }
      else field += char;
    }
    fields.push(field);
    if (fields.length >= 2) rows.push({ prompt: fields[0], completion: fields[1] });
  }
  return rows;
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
