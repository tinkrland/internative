// the ledger of what has actually been run.
//
// verify.ts can only judge a description. an adapter stops being unproven the
// day a real request comes back with a body, and that event has to be recorded
// somewhere durable rather than in a commit message. one file per adapter, so a
// later reader can see when it happened and what came back.

export interface Observation {
  adapter: string;
  observed_at: string;
  status: number;
  endpoint?: string;
  model?: string;
  note?: string;
}

export const OBSERVATION_DIR = "generation/observations";

// a call counts as observed when the endpoint accepted it: the schema took the
// field names, which is the claim the descriptor makes.
export function accepted(status: number): boolean {
  return status >= 200 && status < 300;
}

export function readObservations(dir = OBSERVATION_DIR): Observation[] {
  const found: Observation[] = [];
  let entries: Deno.DirEntry[] = [];
  try {
    entries = [...Deno.readDirSync(dir)].filter((e) => e.isFile && e.name.endsWith(".json"));
  } catch {
    return found; // no ledger yet is not an error, it is the honest default
  }
  for (const entry of entries) {
    try {
      found.push(JSON.parse(Deno.readTextFileSync(`${dir}/${entry.name}`)) as Observation);
    } catch {
      // a corrupt ledger entry is dropped rather than trusted
    }
  }
  return found.sort((a, b) => a.observed_at.localeCompare(b.observed_at));
}

export function observedIds(observations: Observation[]): string[] {
  return [...new Set(observations.filter((o) => accepted(o.status)).map((o) => o.adapter))];
}

export function recordObservation(observation: Observation, dir = OBSERVATION_DIR): string {
  Deno.mkdirSync(dir, { recursive: true });
  const path = `${dir}/${observation.adapter}.json`;
  Deno.writeTextFileSync(path, `${JSON.stringify(observation, null, 2)}\n`);
  return path;
}
