// where knowledge actually lives, as a seam rather than an assumption.
//
// the intended backend is mem0 (open source, self-hosted) over a graph database, so a fact
// can be reached by meaning and by relationship. but a seam is what lets the rest of the repo
// be written before the backend is: the contract below is what knowledge/ needs from any
// store, and every rule here is a refusal the store cannot talk its way out of.
//
// the two rules a generic memory SDK will happily break, and this file does not:
//
//   nothing is admitted without an axis check. mem0 distils facts out of conversation, and a
//   distilled fact is exactly the shape of thing that arrives without an evidence line and
//   then gets repeated as if it had one.
//   nothing is forgotten silently. a retired item keeps its reason, because the graph is the
//   record of why she believes what she believes.

import { type KnowledgeItem, itemProblems } from "../knowledge/item.ts";
import { admissionProblems, contradictionProblems, expired, retireProblems } from "../knowledge/policy.ts";

export interface Query {
  text?: string;
  subject?: string;
  function?: KnowledgeItem["function"];
  articulation?: KnowledgeItem["articulation"];
  scope?: KnowledgeItem["scope"];
  tags?: string[];
  limit?: number;
}

export interface Retired {
  id: string;
  retired_by: string;
  at: string;
}

export interface KnowledgeStore {
  put(item: KnowledgeItem): Promise<void>;
  get(id: string): Promise<KnowledgeItem | null>;
  query(query: Query): Promise<KnowledgeItem[]>;
  retire(retired_by: Retired): Promise<void>;
  history(id: string): Promise<{ at: string; change: string }[]>;
  // what the store is, for a report that must not claim more than it has
  describe(): { backend: string; graph: boolean; verified_against: string };
}

export interface AdmissionInput {
  item: KnowledgeItem;
  existing: KnowledgeItem[];
  public: boolean;
  now?: Date;
}

// the door every write goes through
export function admission(input: AdmissionInput): string[] {
  const now = input.now ?? new Date();
  const problems = [...itemProblems(input.item, new Set(input.existing.map((item) => item.id)))];
  problems.push(...admissionProblems(input.item, { public: input.public }));
  if (expired(input.item, now)) problems.push(`expired: ${input.item.id} arrived already stale (${input.item.review_after})`);
  for (const other of input.existing) problems.push(...contradictionProblems(other, input.item));
  return problems;
}

export function retire(input: { item: KnowledgeItem | null; retired_by: string }): string[] {
  if (!input.item) return ["retire: no such item"];
  return retireProblems(input.item, input.retired_by);
}

// a reference store, for tests and for a machine with no database. it is deliberately dumb:
// substring search, no embeddings, no graph. what it proves is the contract, not the recall.
export class InMemoryKnowledge implements KnowledgeStore {
  #items = new Map<string, KnowledgeItem>();
  #log = new Map<string, { at: string; change: string }[]>();
  #retired = new Map<string, Retired>();

  async put(item: KnowledgeItem): Promise<void> {
    this.#items.set(item.id, item);
    const log = this.#log.get(item.id) ?? [];
    log.push({ at: item.at, change: `put ${item.function}/${item.articulation}` });
    this.#log.set(item.id, log);
  }

  async get(id: string): Promise<KnowledgeItem | null> {
    return this.#items.get(id) ?? null;
  }

  async query(query: Query): Promise<KnowledgeItem[]> {
    const text = (query.text ?? "").toLowerCase();
    const found = [...this.#items.values()].filter((item) => {
      if (query.subject && item.subject !== query.subject) return false;
      if (query.function && item.function !== query.function) return false;
      if (query.articulation && item.articulation !== query.articulation) return false;
      if (query.scope && item.scope !== query.scope) return false;
      if (query.tags?.length && !query.tags.every((tag) => item.tags.includes(tag))) return false;
      if (!text) return true;
      const haystack = `${item.subject} ${item.claim ?? ""} ${item.entity ?? ""} ${item.phenomenon ?? ""}`.toLowerCase();
      return haystack.includes(text);
    });
    return found.slice(0, query.limit ?? 50);
  }

  async retire({ id, retired_by, at }: Retired): Promise<void> {
    if (!this.#items.has(id)) throw new Error(`knowledge: cannot retire "${id}", it was never held`);
    this.#retired.set(id, { id, retired_by, at });
    const log = this.#log.get(id) ?? [];
    log.push({ at, change: `retired by ${retired_by}` });
    this.#log.set(id, log);
  }

  async history(id: string) {
    return this.#log.get(id) ?? [];
  }

  describe() {
    return { backend: "in-memory", graph: false, verified_against: "nothing: this is the reference store" };
  }
}

// the environment seam, in the same honest shape as memory/client.ts: unset means the store
// is absent and the caller is told, never a silent in-memory fallback pretending to persist.
export interface StoreConfig {
  backend: "mem0";
  base_url: string;
  graph: "falkordb" | "neo4j" | "none";
  api_key_env?: string;
}

export function storeConfigFromEnv(env: Record<string, string | undefined>): { config: StoreConfig | null; problems: string[] } {
  const problems: string[] = [];
  const url = env.CLAWBUZZ_MEM0_URL?.trim();
  if (!url) {
    return { config: null, problems: ["CLAWBUZZ_MEM0_URL unset: the knowledge store is absent, and nothing will be remembered between runs"] };
  }
  if (!/^https?:\/\//.test(url)) problems.push("CLAWBUZZ_MEM0_URL must be an http(s) url");
  const graph = (env.CLAWBUZZ_MEM0_GRAPH ?? "none").trim();
  if (!["falkordb", "neo4j", "none"].includes(graph)) problems.push(`CLAWBUZZ_MEM0_GRAPH "${graph}" is not falkordb, neo4j or none`);
  if (graph === "none") problems.push("graph none: a persona's knowledge is relational, and a flat store cannot answer who knows whom");
  return {
    config: problems.length ? null : { backend: "mem0", base_url: url, graph: graph as StoreConfig["graph"], api_key_env: env.CLAWBUZZ_MEM0_KEY_ENV },
    problems,
  };
}
