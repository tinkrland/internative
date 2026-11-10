import { assertEquals, assert } from "jsr:@std/assert@1";
import { coverageFor, cuesFor, profileDigest, profileProblems, unknownKeys, type YaptelProfile } from "../voice/yaptel.ts";

const profile = (over: Partial<YaptelProfile> = {}): YaptelProfile => ({
  id: "internative-1-voice",
  version: "0.3.0",
  measured_from: { minutes: 193, sources: ["call-recordings", "podcast-archive"], method: "real_sample_comparison" },
  lingvist: {
    code_switch_triggers: ["emphasis", "no_clean_translation"],
    transliteration_habits: "latin only, no diacritics",
    loanword_defaults: ["sushi", "schadenfreude"],
  },
  lexica: {
    generational_markers: ["gen-z filler set"],
    slang_inventory: ["no cap"],
    fillers: ["like", "right"],
    hedges: ["i think", "kind of"],
    idiom_preferences: ["down to the wire"],
  },
  lingvica: {
    register_by_medium: { voice: "warm, unhurried, contractions", twitter: "clipped, lowercase" },
    tone_defaults: { warmth: 0.7, sarcasm_level: 0.3, playfulness: 0.5, confidence: 0.6 },
    punctuation_as_tone: ["...", "!"],
    channel_shift_corrections: {
      voice: { emoji_density_to: "vocal_expressiveness_level", caps_to: "stress_not_volume" },
    },
  },
  coverage: {
    mediums_with_real_data: ["voice"],
    mediums_sandbox_only: ["twitter"],
    mediums_absent: ["discord"],
  },
  scoring: { method: "real_sample_comparison", confidence_by_medium: { voice: 0.82, twitter: 0.55 } },
  ...over,
});

Deno.test("a measured profile passes", () => {
  assertEquals(profileProblems(profile()), []);
});

Deno.test("a profile key with no linguistic term behind it is a vibe", () => {
  const p = profile({ lingvica: { ...profile().lingvica, vibes: "gen z energy" } as unknown as YaptelProfile["lingvica"] });
  assertEquals(unknownKeys(p), ["lingvica.vibes"]);
  assert(profileProblems(p).some((x) => x.includes("not a term the research defines")));
});

Deno.test("no minutes of material means it was written, not measured", () => {
  const p = profile({ measured_from: { minutes: 0, sources: [], method: "llm_judge" } });
  assert(profileProblems(p).some((x) => x.includes("written rather than measured")));
  assert(profileProblems(p).some((x) => x.includes("name the sources")));
});

Deno.test("a tone default off its scale is a mood, not a measurement", () => {
  const p = profile({
    lingvica: {
      ...profile().lingvica,
      tone_defaults: { warmth: 1.6, sarcasm_level: 0.3, playfulness: 0.5, confidence: 0.6 },
    },
  });
  assert(profileProblems(p).some((x) => x.includes("warmth must be a number 0..1")));
});

Deno.test("a medium with a register but no coverage claim hides whether it was measured", () => {
  const p = profile({
    lingvica: { ...profile().lingvica, register_by_medium: { voice: "warm", whatsapp: "loose" } },
  });
  assert(profileProblems(p).some((x) => x.includes("whatsapp has a register but no coverage claim")));
});

Deno.test("coverage answers per medium, and absent is absent", () => {
  assertEquals(coverageFor(profile(), "voice"), "real");
  assertEquals(coverageFor(profile(), "twitter"), "sandbox");
  assertEquals(coverageFor(profile(), "discord"), "absent");
  assertEquals(coverageFor(profile(), "slack_sandbox"), "absent");
});

Deno.test("a spoken surface gets its register and the channel corrections", () => {
  const cues = cuesFor(profile(), "meetings");
  assert(!("refused" in cues));
  if ("refused" in cues) return;
  assertEquals(cues.medium, "voice");
  assertEquals(cues.coverage, "real");
  assertEquals(cues.register, "warm, unhurried, contractions");
  assert(cues.prosody.includes("caps_to -> stress_not_volume"));
  assertEquals(cues.vocabulary.hedges, ["i think", "kind of"]);
  assertEquals(cues.warnings, []);
});

Deno.test("a sandbox-only room is a preview and says so", () => {
  const cues = cuesFor(profile(), "text");
  if ("refused" in cues) throw new Error("expected cues");
  assertEquals(cues.coverage, "sandbox");
  assert(cues.warnings.includes("sandbox only: preview, never a live surface"));
});

Deno.test("a room the profile never measured is refused rather than guessed", () => {
  const thin = profile({ coverage: { mediums_with_real_data: [], mediums_sandbox_only: [], mediums_absent: ["voice", "twitter"] } });
  const cues = cuesFor(thin, "meetings");
  assert("refused" in cues);
  if ("refused" in cues) assert(cues.refused.includes("guess in measured clothing"));
});

Deno.test("sung delivery does not come from a spoken profile at all", () => {
  const cues = cuesFor(profile(), "music");
  assert("refused" in cues);
  if ("refused" in cues) assert(cues.refused.includes("arrangement"));
});

Deno.test("timbre is the trained voice's, and a profile that sets it gets ignored out loud", () => {
  const p = { ...profile(), timbre: "husky" } as unknown as YaptelProfile;
  const cues = cuesFor(p, "audio");
  if ("refused" in cues) throw new Error("expected cues");
  assert(cues.warnings.some((w) => w.includes("timbre ignored")));
});

Deno.test("the profile digest changes with the version and not with key order", async () => {
  const a = await profileDigest(profile());
  const b = await profileDigest(profile({ version: "0.3.1" }));
  const reordered = profile();
  const c = await profileDigest(JSON.parse(JSON.stringify(reordered)) as YaptelProfile);
  assertEquals(a, c);
  assert(a !== b);
});
