import { assertEquals, assert } from "jsr:@std/assert@1";
import { itemProblems, itemLine, type KnowledgeItem } from "../knowledge/item.ts";
import { axisCoverage, coverageProblems, knowledgeBrief } from "../knowledge/brief.ts";
import { admissionProblems, contradictionProblems, expired, retireProblems } from "../knowledge/policy.ts";

const base = (over: Partial<KnowledgeItem> = {}): KnowledgeItem => ({
  id: "porto-flat-rent",
  subject: "the flat in porto",
  origin: "testimony",
  articulation: "explicit",
  function: "propositional",
  evidence: "reported",
  volatility: "volatile",
  scope: "world",
  at: "2026-11-01",
  claim: "rent is 780 a month",
  source: { kind: "conversation", ref: "thread:porto-flat", at: "2026-11-01", by: "anne" },
  review_after: "2026-12-01",
  tags: ["housing", "porto"],
  ...over,
});

Deno.test("a stated fact about the world is storable and says who said it", () => {
  assertEquals(itemProblems(base()), []);
  assertEquals(itemLine(base()), "propositional/explicit: the flat in porto: rent is 780 a month (reported)");
});

Deno.test("her architecture is not a memory", () => {
  const problems = itemProblems(base({ origin: "innate" as never, source: undefined }));
  assert(problems.some((p) => p.includes("not storable")), problems.join(" | "));
});

Deno.test("tacit knowledge may not be written down as prose", () => {
  const stated = itemProblems(base({ articulation: "implicit_tacit", function: "procedural" }));
  assert(stated.some((p) => p.includes("may not carry a written claim")), stated.join(" | "));
  const pointed = base({
    id: "reads-a-room",
    subject: "reading a room before a call",
    articulation: "implicit_tacit",
    function: "procedural",
    claim: undefined,
    demonstrated_by: "procedure:precall-scan",
    volatility: "durable",
    scope: "persona",
    review_after: undefined,
    tags: ["skill"],
  });
  assertEquals(itemProblems(pointed), [], "a pointed tacit item is fine");
  assert(itemLine(pointed).includes("procedure:precall-scan"));
});

Deno.test("tacit knowledge with nothing to point at is a claim wearing a costume", () => {
  const problems = itemProblems(base({ articulation: "inherent_tacit", function: "procedural", claim: undefined, demonstrated_by: undefined }));
  assert(problems.some((p) => p.includes("claim wearing a costume")), problems.join(" | "));
});

Deno.test("each function has the field that makes it that function", () => {
  assert(itemProblems(base({ function: "acquaintance", claim: undefined })).some((p) => p.includes("names the thing she has met")));
  assert(itemProblems(base({ function: "explanatory" })).some((p) => p.includes("names the phenomenon")));
  assert(itemProblems(base({ function: "procedural", claim: undefined })).some((p) => p.includes("points at the steps")));
});

Deno.test("a conversation is testimony, not verification", () => {
  const problems = itemProblems(base({ evidence: "verified" }));
  assert(problems.some((p) => p.includes("testimony, not verification")), problems.join(" | "));
  const measured = base({
    origin: "experienced",
    evidence: "verified",
    source: { kind: "measurement", ref: "lufs:master-01", at: "2026-11-01" },
  });
  assertEquals(itemProblems(measured), []);
});

Deno.test("an inference names what it was inferred from, and a guess says why", () => {
  const inferred = base({ evidence: "inferred", confidence: 0.6 });
  assert(itemProblems(inferred).some((p) => p.includes("names what it was inferred from")));
  assertEquals(itemProblems(base({ evidence: "inferred", confidence: 0.6, basis: "porto-flat-rent" })), []);
  assert(itemProblems(base({ evidence: "assumed", confidence: 0.4 })).some((p) => p.includes("says why")));
});

Deno.test("a basis that is not one of her items is refused", () => {
  const ids = new Set(["something-else"]);
  const problems = itemProblems(base({ evidence: "inferred", confidence: 0.5, basis: "porto-flat-rent" }), ids);
  assert(problems.some((p) => p.includes("not an item she holds")), problems.join(" | "));
});

Deno.test("what expires says when, and her own taste never expires", () => {
  assert(itemProblems(base({ review_after: undefined })).some((p) => p.includes("re-checked")));
  const taste = base({ scope: "persona", volatility: "volatile", review_after: "2026-12-01" });
  assert(itemProblems(taste).some((p) => p.includes("her own taste does not expire")), "a persona fact must be durable");
});

Deno.test("origin and source have to agree", () => {
  const experienced = base({ origin: "experienced", volatility: "durable", review_after: undefined });
  assert(itemProblems(experienced).some((p) => p.includes("experienced needs an episode")));
  const studied = base({ origin: "studied", source: { kind: "conversation", ref: "t", at: "2026-11-01" } });
  assert(itemProblems(studied).some((p) => p.includes("needs the document")));
});

Deno.test("a credential in a knowledge item is refused, and so is an empty tag list", () => {
  assert(itemProblems(base({ claim: "key is sk-abcdefghijklmnop1234" })).some((p) => p.includes("shaped like a credential")));
  assert(itemProblems(base({ tags: [] })).some((p) => p.includes("at least one")));
});

Deno.test("two contradictory facts about one subject name a winner instead of averaging", () => {
  const a = base({ id: "rent-old", at: "2026-09-01", claim: "rent is 720 a month" });
  const b = base({ id: "rent-new", evidence: "verified", source: { kind: "document", ref: "lease.pdf", at: "2026-11-02" }, at: "2026-11-02", claim: "rent is 780 a month" });
  const problems = contradictionProblems(a, b);
  assert(problems.some((p) => p.includes("held twice")), problems.join(" | "));
  assert(problems.some((p) => p.includes("rent-new wins")), problems.join(" | "));
  assertEquals(contradictionProblems(base(), base()), []);
});

Deno.test("nothing is forgotten by accident", () => {
  assert(retireProblems(base(), "").some((p) => p.includes("name the item or the event")));
  assertEquals(retireProblems(base(), "lease signed"), []);
});

Deno.test("a brief puts acquaintance first, hedges the weak claims, and never restates tacit knowledge", () => {
  const items: KnowledgeItem[] = [
    base(),
    base({ id: "met-ana", subject: "ana", function: "acquaintance", claim: undefined, entity: "ana, who runs the porto studio", evidence: "verified", source: { kind: "experience", ref: "episode:2026-10-30-studio", at: "2026-10-30" }, origin: "experienced", volatility: "durable", review_after: undefined, scope: "world" }),
    base({ id: "rent-because", subject: "porto rents", function: "explanatory", phenomenon: "rents doubling", claim: "the short-let licences froze supply", evidence: "reported" }),
    base({
      id: "reads-a-room",
      subject: "reading a room before a call",
      articulation: "inherent_tacit",
      function: "procedural",
      claim: undefined,
      demonstrated_by: "eval:precall-03",
      volatility: "durable",
      scope: "persona",
      evidence: "verified",
      source: { kind: "measurement", ref: "eval:precall-03", at: "2026-10-01" },
      review_after: undefined,
      origin: "experienced",
    }),
    base({ id: "assumed-cheap", subject: "the flat in porto", evidence: "assumed", why_assumed: "the two numbers sounded like the same flat", confidence: 0.3, claim: "bills are included" }),
    base({ id: "owner-salary", subject: "anne's salary", scope: "owner", claim: "not published anywhere", volatility: "durable", review_after: undefined }),
  ];
  const brief = knowledgeBrief(items, { budget: 900, public: true, now: new Date("2026-11-10") });
  const lines = brief.block.split("\n");
  assert(lines[0].startsWith("acquaintance/"), lines[0]);
  assert(brief.block.includes("(reported)"), "reported stays hedged");
  assert(brief.block.includes("eval:precall-03"), "tacit arrives as a pointer");
  assert(!brief.block.includes("means she can only recite"));
  assert(!brief.block.includes("bills are included"), "an assumption is not a public claim");
  assert(!brief.block.includes("salary"), "owner knowledge stays private");
  assert(brief.dropped.some((d) => d.id === "owner-salary"));
});

Deno.test("an expired item is dropped with the date it expired", () => {
  const brief = knowledgeBrief([base({ review_after: "2026-10-01" })], { budget: 500, public: false, now: new Date("2026-11-10") });
  assertEquals(brief.block, "");
  assert(brief.dropped[0].why.startsWith("expired"));
  assert(expired(base({ review_after: "2026-10-01" }), new Date("2026-11-10")));
});

Deno.test("the budget cuts whole items, and says which", () => {
  const many = Array.from({ length: 8 }, (_, i) => base({ id: `item-${i}`, subject: `subject ${i}`, volatility: "durable", review_after: undefined }));
  const brief = knowledgeBrief(many, { budget: 90, public: false });
  assert(brief.used.length < many.length);
  assert(brief.used.length + brief.dropped.filter((d) => d.why === "over budget").length === many.length);
});

Deno.test("a persona that only recites is a documentation site", () => {
  assertEquals(coverageProblems([]), []);
  const explicitOnly = [base(), base({ id: "b", subject: "another thing", volatility: "durable", review_after: undefined })];
  const problems = coverageProblems(explicitOnly);
  assert(problems.some((p) => p.includes("can only recite")), problems.join(" | "));
  assert(problems.some((p) => p.includes("cannot do anything")), problems.join(" | "));
  assert(problems.some((p) => p.includes("met nobody")), problems.join(" | "));
  assert(axisCoverage(explicitOnly).function.propositional === 2);
});

Deno.test("public admission refuses her unverified traits and the owner's facts", () => {
  const unverifiedTrait = base({ scope: "persona", volatility: "durable", review_after: undefined, evidence: "reported" });
  assert(admissionProblems(unverifiedTrait, { public: true }).some((p) => p.includes("rumour about herself")));
  assert(admissionProblems(base({ scope: "owner" }), { public: true }).some((p) => p.includes("not where it goes")));
  assertEquals(admissionProblems(base(), { public: false }), []);
});
