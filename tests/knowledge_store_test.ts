import { assertEquals, assert, assertRejects } from "jsr:@std/assert@1";
import { InMemoryKnowledge, admission, retire, storeConfigFromEnv } from "../memory/knowledge.ts";
import { type KnowledgeItem } from "../knowledge/item.ts";

const item = (over: Partial<KnowledgeItem> = {}): KnowledgeItem => ({
  id: "porto-rent",
  subject: "the flat in porto",
  origin: "testimony",
  articulation: "explicit",
  function: "propositional",
  evidence: "reported",
  volatility: "volatile",
  scope: "world",
  at: "2026-11-01",
  claim: "rent is 780 a month",
  source: { kind: "conversation", ref: "thread:porto", at: "2026-11-01" },
  review_after: "2026-12-01",
  tags: ["porto"],
  ...over,
});

Deno.test("a store writes, reads back, and queries by axis rather than by luck", async () => {
  const store = new InMemoryKnowledge();
  await store.put(item());
  await store.put(item({ id: "met-ana", subject: "ana", function: "acquaintance", claim: undefined, entity: "ana", volatility: "durable", review_after: undefined, scope: "world" }));
  assertEquals((await store.get("porto-rent"))?.claim, "rent is 780 a month");
  assertEquals((await store.query({ function: "acquaintance" })).map((i) => i.id), ["met-ana"]);
  assertEquals((await store.query({ text: "porto" })).map((i) => i.id), ["porto-rent"]);
  assertEquals((await store.query({ scope: "owner" })), []);
});

Deno.test("the door checks the axes and the contradictions, not just the schema", async () => {
  const existing = [item()];
  const unverifiedTrait = item({ id: "trait", scope: "persona", volatility: "durable", review_after: undefined, subject: "her taste in music", evidence: "reported" });
  const problems = admission({ item: unverifiedTrait, existing, public: true });
  assert(problems.some((p) => p.includes("rumour about herself")), problems.join(" | "));

  const contradiction = item({ id: "porto-rent-2", at: "2026-11-05", claim: "rent is 810 a month" });
  const clash = admission({ item: contradiction, existing, public: false });
  assert(clash.some((p) => p.includes("held twice")), clash.join(" | "));
});

Deno.test("a stale item does not enter the store", () => {
  const problems = admission({ item: item({ review_after: "2026-01-01" }), existing: [], public: false, now: new Date("2026-11-10") });
  assert(problems.some((p) => p.includes("arrived already stale")), problems.join(" | "));
});

Deno.test("nothing is retired without a reason, and a retirement is kept in the history", async () => {
  const store = new InMemoryKnowledge();
  await store.put(item());
  assertEquals(retire({ item: await store.get("porto-rent"), retired_by: "" }).length, 1);
  assertEquals(retire({ item: await store.get("porto-rent"), retired_by: "lease signed 2026-11-02" }), []);
  await store.retire({ id: "porto-rent", retired_by: "lease signed 2026-11-02", at: "2026-11-02" });
  const history = await store.history("porto-rent");
  assert(history.some((h) => h.change.includes("retired by lease signed")), JSON.stringify(history));
  await assertRejects(() => store.retire({ id: "nope", retired_by: "x", at: "2026-11-02" }), Error, "never held");
});

Deno.test("the reference store says what it is, and does not claim a graph", () => {
  const described = new InMemoryKnowledge().describe();
  assertEquals(described.graph, false);
  assert(described.verified_against.includes("reference store"));
});

Deno.test("an absent store is said out loud, not faked", () => {
  const missing = storeConfigFromEnv({});
  assertEquals(missing.config, null);
  assert(missing.problems[0].includes("nothing will be remembered"), missing.problems.join(" | "));
});

Deno.test("a store with no graph is refused, because a persona's knowledge is relational", () => {
  const flat = storeConfigFromEnv({ CLAWBUZZ_MEM0_URL: "http://localhost:8000", CLAWBUZZ_MEM0_GRAPH: "none" });
  assertEquals(flat.config, null);
  assert(flat.problems.some((p) => p.includes("cannot answer who knows whom")), flat.problems.join(" | "));
});

Deno.test("falkordb behind a url is accepted, and a url is not a credential store", () => {
  const ok = storeConfigFromEnv({ CLAWBUZZ_MEM0_URL: "http://localhost:8000", CLAWBUZZ_MEM0_GRAPH: "falkordb", CLAWBUZZ_MEM0_KEY_ENV: "MEM0_API_KEY" });
  assertEquals(ok.problems, []);
  assertEquals(ok.config?.graph, "falkordb");
  assertEquals(ok.config?.api_key_env, "MEM0_API_KEY", "the config names the env var, never the key");
  assert(storeConfigFromEnv({ CLAWBUZZ_MEM0_URL: "localhost:8000", CLAWBUZZ_MEM0_GRAPH: "falkordb" }).problems.some((p) => p.includes("http(s) url")));
});
