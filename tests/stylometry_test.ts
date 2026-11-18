import { assertEquals, assert } from "jsr:@std/assert@1";
import { measureStyle, profileProblems, styleDigest, styleDistance, styleDrift, yuleK, type StyleProfile } from "../voice/stylometry.ts";

const sample = "i think the light in here is doing most of the work. it is not a clever room, it is just honest about what it is. i keep coming back to it because nothing in it is trying too hard. maybe that is the whole thing... the room does not perform and so the pictures do not have to.";

const profile = (over: Partial<StyleProfile> = {}): StyleProfile => ({
  id: "her-writing", version: "1", subject: "AIPN-000001", register: "caption",
  features: measureStyle(sample, { register: "caption", messages: 1 }), ...over,
});

Deno.test("a measured sample yields the scaffolding features, each with a window", () => {
  const features = measureStyle(sample, { register: "caption" });
  const names = features.map((f) => f.name);
  assert(names.includes("sentence_length") && names.includes("function_word_rate") && names.includes("yule_k"));
  for (const feature of features) {
    assertEquals(feature.window.register, "caption");
    assertEquals(feature.window.tokens > 0, true);
  }
});

Deno.test("a short sample is refused by the window floor, not quietly accepted", () => {
  const problems = profileProblems(profile());
  assert(problems.some((p) => p.includes("is the floor before the number is style")));
});

Deno.test("a full sample passes every rule", () => {
  const long = sample.repeat(24);
  const problems = profileProblems(profile({ features: measureStyle(long, { register: "caption" }) }));
  assertEquals(problems, []);
});

Deno.test("an impression is not a feature", () => {
  const features = measureStyle(sample.repeat(12), { register: "caption" });
  const bent = features.map((f) => (f.name === "hedge_rate" ? { ...f, method: "punchy vibe count" } : f));
  const problems = profileProblems(profile({ features: bent }));
  assert(problems.some((p) => p.includes("is what a reader concludes")));
});

Deno.test("a feature without a method is a rumour with a decimal", () => {
  const features = measureStyle(sample.repeat(12), { register: "caption" }).map((f) => (f.name === "yule_k" ? { ...f, method: "" } : f));
  assert(profileProblems(profile({ features })).some((p) => p.includes("does not say how it was counted")));
});

Deno.test("yule's k rises as vocabulary repeats, and survives a longer sample", () => {
  const varied = yuleK("one two three four five six seven eight".split(" "));
  const repeated = yuleK("one one one one two two three three".split(" "));
  assert(repeated > varied);
  assertEquals(yuleK([]), 0);
});

Deno.test("the same writer over two samples is a small distance, and drift names nothing", () => {
  const a = profile();
  const b = profile({ version: "2", features: measureStyle(sample.repeat(24), { register: "caption" }) });
  // same sentences, reordered: a different post, the same writer
  const reordered = sample.split(/(?<=[.!?])\s+/).reverse().join(" ").repeat(24);
  const c = profile({ version: "3", features: measureStyle(reordered, { register: "caption" }) });
  const compared = styleDistance(b, c);
  assertEquals(compared.problems, []);
  assertEquals(styleDrift(b, c), []);
});

Deno.test("a writer who stopped hedging and lost the ellipsis is named feature by feature", () => {
  const before = profile({ features: measureStyle(sample.repeat(12), { register: "caption" }) });
  const after = profile({
    version: "2",
    features: measureStyle(sample.repeat(12).replace(/maybe |i think |\.\.\./g, ""), { register: "caption" }),
  });
  const moved = styleDrift(before, after);
  assert(moved.some((m) => m.startsWith("hedge_rate:")), moved.join(" | "));
  assert(moved.some((m) => m.startsWith("ellipsis_rate:")), moved.join(" | "));
});

Deno.test("two internatives in the same register is attribution, not drift, and says so", () => {
  const hers = profile();
  const theirs = profile({ subject: "AIPN-000002" });
  const compared = styleDistance(hers, theirs);
  assert(compared.problems.some((p) => p.includes("authorship attribution")));
});

Deno.test("fewer than four shared features is a hunch", () => {
  const few = measureStyle(sample.repeat(12), { register: "caption" }).slice(0, 3);
  const compared = styleDistance(profile({ features: few }), profile({ features: few, version: "2" }));
  assert(compared.problems.some((p) => p.includes("a comparison over fewer than four")));
});

Deno.test("the digest pins the profile to a subject and a register", async () => {
  const one = await styleDigest(profile());
  const two = await styleDigest(profile({ register: "longform" }));
  const three = await styleDigest(profile({ version: "2" }));
  assert(one !== two, "a caption is not a longform piece");
  assert(one !== three, "a new version is a new pin");
  assertEquals(one, await styleDigest(profile()));
});
