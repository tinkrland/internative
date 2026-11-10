import { assertEquals, assert, assertRejects } from "jsr:@std/assert@1";
import {
  compileInstructions,
  compileProblems,
  DISCLOSURE,
  instructionProblems,
  takeRecord,
  type InstructionSet,
} from "../voice/tuning.ts";
import type { YaptelProfile } from "../voice/yaptel.ts";

const profile = (over: Partial<YaptelProfile> = {}): YaptelProfile => ({
  id: "vp-ana-01",
  version: "1.0.0",
  subject: "ana",
  measured_from: { minutes: 180, sources: ["podcast", "calls"], method: "real_sample_comparison" },
  lingvist: {
    code_switch_triggers: ["emphasis", "quoting"],
    transliteration_habits: "none",
    loanword_defaults: ["ported"],
  },
  lexica: {
    generational_markers: ["gen z"],
    slang_inventory: ["lowkey"],
    fillers: ["um", "so"],
    hedges: ["kind of"],
  },
  lingvica: {
    register_by_medium: { voice: "warm but clipped in long answers", sms: "short, no emoji" },
    tone_defaults: { warmth: 0.6, sarcasm_level: 0.4, playfulness: 0.5, confidence: 0.7 },
    punctuation_as_tone: ["trailing period reads cold"],
    channel_shift_corrections: { sms: { length_constraint: "short, char-limit aware" } },
  },
  coverage: { mediums_with_real_data: ["voice", "sms"], mediums_sandbox_only: [], mediums_absent: ["twitter"] },
  scoring: { method: "faithfulness_win_rate", confidence_by_medium: { voice: 0.8, sms: 0.7 } },
  ...over,
});

const internative = { id: "ana", aipn: "AIPN-000042" };

const compile = (over: { profile?: YaptelProfile; context?: Record<string, unknown> } = {}) =>
  compileInstructions({
    internative,
    profile: over.profile ?? profile(),
    context: { surface: "meetings", goal: "book a table", ...(over.context ?? {}) } as never,
  });

Deno.test("the same profile and context compile to byte identical instructions", async () => {
  const a = await compile();
  const b = await compile();
  assertEquals(a.digest, b.digest);
  assertEquals(a.system_prompt, b.system_prompt);
  assertEquals(a.layer_trace, b.layer_trace);
});

Deno.test("key order in the profile does not change the digest", async () => {
  const a = await compile();
  const shuffled = JSON.parse(JSON.stringify(profile()));
  const reordered = Object.fromEntries(Object.entries(shuffled).reverse());
  const b = await compile({ profile: reordered as unknown as YaptelProfile });
  assertEquals(a.digest, b.digest);
});

Deno.test("a profile cannot be lent to another internative", async () => {
  const problems = compileProblems({
    internative: { id: "sol", aipn: "AIPN-000007" },
    profile: profile(),
    context: { surface: "meetings" },
  });
  assert(problems.some((p) => p.includes("borrowed voice is an impression")));
});

Deno.test("no aipn means no pin, so it is refused", async () => {
  const problems = compileProblems({
    internative: { id: "ana", aipn: "" },
    profile: profile(),
    context: { surface: "meetings" },
  });
  assert(problems.some((p) => p.includes("no aipn")));
});

Deno.test("a room with no measured data is a setup failure, not a live fallback", async () => {
  const problems = compileProblems({
    internative,
    profile: profile(),
    context: { surface: "text", platform: "bluesky" as never, requested_register: "twitter" },
  });
  assert(problems.some((p) => p.includes("setup failure")), problems.join(" | "));
});

Deno.test("a surface with no delivered voice cannot compile at all", async () => {
  for (const surface of ["static", "music"] as const) {
    const problems = compileProblems({ internative, profile: profile(), context: { surface } });
    assert(problems.some((p) => p.includes("no delivered voice")), surface);
  }
});

Deno.test("the disclosure and the no-invented-facts clause are in every prompt", async () => {
  const set = await compile();
  assert(set.system_prompt.includes(DISCLOSURE));
  assert(set.system_prompt.includes("never invent biographical facts"));
  assert(set.system_prompt.includes("honesty outranks staying in character"));
});

Deno.test("an instruction set that lost its disclosure is refused", async () => {
  const set = await compile();
  const stripped: InstructionSet = {
    ...set,
    system_prompt: set.system_prompt.replace(DISCLOSURE, "you are ana, be cool about it"),
  };
  const problems = instructionProblems(stripped);
  assert(problems.some((p) => p.includes("disclosure line is gone")));
});

Deno.test("voice does not read punctuation aloud, it translates it", async () => {
  const set = await compile();
  assert(set.provenance.corrections.some((c) => c.includes("vocal expressiveness")));
  assert(set.provenance.corrections.some((c) => c.includes("stress, not volume")));
  assert(set.provenance.corrections.some((c) => c.includes("real hesitation")));
});

Deno.test("a text channel carries punctuation over and respects the length rule", async () => {
  const set = await compile({ context: { surface: "text" } });
  assertEquals(set.channel, "sms");
  assert(set.provenance.corrections.some((c) => c.includes("carry over directly")));
  assert(set.provenance.corrections.some((c) => c.includes("char-limit aware")));
});

Deno.test("the lookup filler comes from the profile, never from a hardcoded phrase", async () => {
  const set = await compile();
  assertEquals(set.lookup.source, "lexica.fillers");
  assertEquals(set.lookup.filler, "um");
  assert(set.lookup.cue.includes("typing"));
});

Deno.test("with no fillers measured the filler is neutral and says why", async () => {
  const bare = profile({ lexica: { slang_inventory: [], fillers: [], hedges: [] } });
  const set = await compile({ profile: bare });
  assertEquals(set.lookup.source, "neutral_fallback");
  assertEquals(set.lookup.filler, "one sec");
  assert(set.provenance.neutral_because?.includes("measures no fillers"));
});

Deno.test("an unresolved contact speaks in the neutral register instead of guessing", async () => {
  const set = await compile({ context: { contact_id: undefined } });
  assert(set.system_prompt.includes("do not guess who this is"));
  const known = await compile({ context: { contact_id: "c-88" } });
  assert(known.system_prompt.includes("contact c-88"));
});

Deno.test("a take records the instructions that produced it", async () => {
  const set = await compile();
  const take = takeRecord(set, { take_id: "t-1", at: "2026-11-10T14:00:00Z", fallbacks: ["disclosure"] });
  assertEquals(take.instruction_digest, set.digest);
  assertEquals(take.profile_digest, set.provenance.profile_digest);
  assertEquals(take.aipn, "AIPN-000042");
  assertEquals(take.fallbacks, ["disclosure"]);
});

Deno.test("compiling a broken profile throws instead of returning something plausible", async () => {
  await assertRejects(() =>
    compileInstructions({
      internative,
      profile: profile({ measured_from: { minutes: 0, sources: [], method: "llm_judge" } }),
      context: { surface: "meetings" },
    })
  );
});
