import { assertEquals, assert } from "jsr:@std/assert@1";
import { planDoc, planProblems, type Mem0Plan } from "../memory/mem0.ts";

const plan = (over: Partial<Mem0Plan> = {}): Mem0Plan => ({
  id: "internative-memory",
  mem0: {
    name: "mem0",
    version_pin: "0.1.0",
    licence: "Apache-2.0",
    licence_class: "permissive",
    runs_as: "vendored",
    endpoint_env: "CLAWBUZZ_MEM0_URL",
    credential_envs: ["CLAWBUZZ_MEM0_KEY"],
  },
  graph: {
    name: "falkordb",
    version_pin: "4.0.0",
    licence: "SSPLv1",
    licence_class: "source_available",
    runs_as: "separate_process",
    endpoint_env: "CLAWBUZZ_GRAPH_URL",
    credential_envs: ["CLAWBUZZ_GRAPH_PASSWORD"],
  },
  plugin: {
    name: "mem0-falkordb",
    version_pin: "0.1.0",
    licence: "MIT",
    licence_class: "permissive",
    patches_upstream: true,
    keys_to_copy: ["graph_store.url", "graph_store.database"],
  },
  vector: {
    name: "pgvector",
    version_pin: "0.7.0",
    licence: "PostgreSQL",
    licence_class: "permissive",
    runs_as: "separate_process",
    endpoint_env: "CLAWBUZZ_VECTOR_URL",
    credential_envs: ["CLAWBUZZ_VECTOR_PASSWORD"],
    dims: 1024,
  },
  embedder: { model: "bge-m3", dims: 1024 },
  history: {
    name: "postgres",
    version_pin: "16.3",
    licence: "PostgreSQL",
    licence_class: "permissive",
    runs_as: "separate_process",
    endpoint_env: "CLAWBUZZ_HISTORY_URL",
    credential_envs: ["CLAWBUZZ_HISTORY_PASSWORD"],
  },
  note: "the falkordb plugin patches mem0's graph config, so pin both and re-run the suite on upgrade",
  ...over,
});

Deno.test("the plan we intend to deploy has no problems", () => {
  assertEquals(planProblems(plan()), []);
});

Deno.test("a source available component is a process, never a library", () => {
  const p = plan({ graph: { ...plan().graph, runs_as: "vendored" } });
  assert(planProblems(p).some((x) => x.includes("cannot be vendored")));
});

Deno.test("a provider mem0 does not ship needs a plugin, or the plan is a diagram", () => {
  const p = plan({ plugin: null });
  assert(planProblems(p).some((x) => x.includes("needs the plugin")));
});

Deno.test("a plugin that patches upstream has to say so where somebody will read it", () => {
  const p = plan({ note: "pin both versions" });
  assert(planProblems(p).some((x) => x.includes("patches mem0")));
});

Deno.test("the plugin's own key names are named, never invented", () => {
  const p = plan({
    plugin: { ...plan().plugin!, keys_to_copy: [] },
  });
  assert(planProblems(p).some((x) => x.includes("name the keys a human must copy")));
});

Deno.test("an unpinned component changes behaviour on the next deploy, silently", () => {
  const p = plan({ mem0: { ...plan().mem0, version_pin: "latest" } });
  assert(planProblems(p).some((x) => x.includes("no version pin")));
});

Deno.test("embedding width has to agree with the vector store, or queries return nonsense", () => {
  const p = plan({ embedder: { model: "bge-m3", dims: 768 } });
  assert(planProblems(p).some((x) => x.includes("cannot hold a 768 dim")));
  const narrow = plan({ vector: { ...plan().vector, dims: 64 }, embedder: { model: "x", dims: 64 } });
  assert(planProblems(narrow).some((x) => x.includes("dims must be the embedder's real width")));
});

Deno.test("a credential is an environment variable name, never a value", () => {
  const p = plan({ mem0: { ...plan().mem0, credential_envs: ["sk-live-abc123"] } });
  assert(planProblems(p).some((x) => x.includes("not an environment variable name")));
});

Deno.test("a missing component is a hole, and a hole is a lie", () => {
  const p = plan({ history: undefined as unknown as Mem0Plan["history"] });
  assert(planProblems(p).some((x) => x.includes("history is missing")));
});

Deno.test("the doc names the bridge, the licences and the keys a human must copy", () => {
  const d = planDoc(plan());
  assert(d.includes("mem0 0.1.0 (Apache-2.0)"));
  assert(d.includes("falkordb 4.0.0 (SSPLv1)"));
  assert(d.includes("patches mem0"));
  assert(d.includes("graph_store.url, graph_store.database"));
  assert(d.includes("CLAWBUZZ_GRAPH_URL"));
});

Deno.test("an upstream graph provider needs no plugin at all", () => {
  const p = plan({
    graph: { ...plan().graph, name: "neo4j", licence: "GPLv3", licence_class: "copyleft" },
    plugin: null,
    note: undefined,
  });
  assertEquals(planProblems(p), []);
});

Deno.test("a copyleft graph may be vendored or separate, but a source available one may not", () => {
  const copyleft = plan({ graph: { ...plan().graph, name: "neo4j", licence: "GPLv3", licence_class: "copyleft", runs_as: "separate_process" }, plugin: null, note: undefined });
  assertEquals(planProblems(copyleft), []);
  const elv = plan({ graph: { ...plan().graph, name: "hydradb", licence: "Elastic-2.0", licence_class: "source_available", runs_as: "vendored" } });
  assert(planProblems(elv).some((x) => x.includes("Elastic-2.0 is source available")));
});
