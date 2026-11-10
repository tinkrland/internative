import { assertEquals, assert } from "jsr:@std/assert@1";
import { interestBrief, interestProblems, setProblems, staleProblems, topicsFor, type Interest, type InterestSet } from "../interests/module.ts";

const i = (over: Partial<Interest> = {}): Interest => ({
  id: "raw-denim",
  name: "raw denim",
  domain: "textiles",
  why: "the indigo fades to a map of what you did while wearing it, so the garment records the wearer",
  depth: 2,
  state: "active",
  uses: [
    { kind: "read", ref: "ametora, w david marx", at: "2026-08-14" },
    { kind: "made", ref: "repaired a blown knee with a 3x1 twill patch", at: "2026-10-02" },
  ],
  stance: "fades should be earned, not sanded",
  avoid: ["pre-distressed washes", "stretch blends"],
  crosses_with: [],
  ...over,
});

const set = (items: Interest[]): InterestSet => ({ id: "internative-interests", items });

Deno.test("an interest with a stake, a trail and edges passes", () => {
  assertEquals(interestProblems(i()), []);
});

Deno.test("a generic reason says nothing, because everybody says it about everything", () => {
  const p = i({ why: "it is interesting and i just like it a lot" });
  assert(interestProblems(p).some((x) => x.includes("says nothing")));
});

Deno.test("an interest is not a competence, and competence lives in knowledge", () => {
  const p = i({ why: "i am an expert in selvedge construction and the history of shuttle looms" });
  assert(interestProblems(p).some((x) => x.includes("competence is knowledge")));
});

Deno.test("studying something leaves a trail, so a 3 with none is a claim", () => {
  const p = i({ depth: 3, uses: [] });
  assert(interestProblems(p).some((x) => x.includes("a 3 with no trail is a claim")));
});

Deno.test("active with nothing done about it is a wish", () => {
  const p = i({ uses: [] });
  assert(interestProblems(p).some((x) => x.includes("that is a latent interest, or a wish")));
});

Deno.test("latent is allowed to have no trail, because that is what latent means", () => {
  assertEquals(interestProblems(i({ state: "latent", uses: [] })), []);
});

Deno.test("a use needs a kind, a reference and a date", () => {
  const p = i({ uses: [{ kind: "read", ref: "", at: "" }] });
  const problems = interestProblems(p);
  assert(problems.some((x) => x.includes("every use carries a date")));
  assert(problems.some((x) => x.includes("a use names what it was")));
});

Deno.test("a persona interested in everything has no character", () => {
  const items = Array.from({ length: 9 }, (_, n) => i({ id: `i${n}`, name: `interest ${n}` }));
  assert(setProblems(set(items)).some((x) => x.includes("has no character")));
});

Deno.test("a stance with nothing she dislikes is a summary, not taste", () => {
  const p = i({ avoid: [] });
  assert(setProblems(set([p])).some((x) => x.includes("not taste")));
});

Deno.test("crossing with an interest that is not in the set is a typo that never fires", () => {
  const p = i({ crosses_with: ["japanese-workwear"] });
  assert(setProblems(set([p])).some((x) => x.includes('"japanese-workwear", which is not in this set')));
});

Deno.test("an interest nobody has pursued in four months is honest about it", () => {
  const stale = staleProblems(set([i({ uses: [{ kind: "read", ref: "a book", at: "2026-01-05" }] })]), "2026-11-10");
  assertEquals(stale, [{ id: "raw-denim", days: 309 }]);
  assertEquals(staleProblems(set([i()]), "2026-11-10"), []);
});

Deno.test("the brief keeps the reason with the name, so an interest cannot become a keyword", () => {
  const lines = interestBrief(set([i(), i({ id: "glia", name: "glia", domain: "neuroscience", depth: 1 })]));
  assertEquals(lines.length, 2);
  assert(lines[0].startsWith("raw denim (textiles, 2/3): the indigo fades"));
  assert(lines[0].includes("she thinks fades should be earned"));
});

Deno.test("topics skip the passing curiosity and keep what she studies", () => {
  const s = set([i(), i({ id: "glia", name: "glia", depth: 1 }), i({ id: "loudness", name: "loudness war", domain: "audio", depth: 3, uses: [{ kind: "made", ref: "master", at: "2026-10-20" }, { kind: "read", ref: "ebu r128", at: "2026-09-01" }] })]);
  assertEquals(topicsFor(s), ["loudness war", "raw denim"]);
});
