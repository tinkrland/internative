// stylometry: the part of how she writes that a reader recognises without being able to name.
//
// the field this borrows from is old and unfashionable in exactly the useful way. authorship
// attribution does not compare what a writer says, it compares the scaffolding: function word
// frequencies, punctuation habits, sentence length and its variance, vocabulary richness.
// Burrows's Delta z-scores the most frequent words and is still the baseline everything else
// is measured against, and Yule's K is the richness measure that does not move just because
// the sample got longer.
//
// three refusals make it usable here rather than decorative:
//
//   a feature with no window is not a measurement   forty words say nothing about sentence
//                                                   length, and type-token ratio climbs with
//                                                   sample size, which is why Yule's K exists
//   an impression is not a feature                  "punchy", "witty", "warm" are what a
//                                                   reader concludes FROM the scaffolding
//   a drift is a named feature that moved           not "she sounds different now"

import { digestOf } from "../lock.ts";

export type FeatureName =
  | "sentence_length"
  | "sentence_variance"
  | "function_word_rate"
  | "contraction_rate"
  | "punctuation_rate"
  | "ellipsis_rate"
  | "emoji_rate"
  | "hedge_rate"
  | "yule_k";

export interface Feature {
  name: FeatureName;
  // the number, in the unit the name implies
  value: number;
  unit: "tokens" | "per_1000_words" | "per_100_words" | "per_message" | "index";
  // what it was measured over, and how. a feature without both is a rumour with a decimal
  window: { tokens: number; messages: number; register: string };
  method: string;
}

export interface StyleProfile {
  id: string;
  version: string;
  // whose writing this is. one profile is one internative, on one register.
  subject: string;
  register: string;
  features: Feature[];
}

// minimum sample, per feature family. below this the number is arithmetic, not style.
const MIN_TOKENS: Partial<Record<FeatureName, number>> = {
  sentence_length: 300,
  sentence_variance: 300,
  function_word_rate: 500,
  contraction_rate: 200,
  punctuation_rate: 200,
  ellipsis_rate: 200,
  emoji_rate: 50,
  hedge_rate: 300,
  yule_k: 1000,
};

// words that carry no content and therefore carry the writer. the closed-class list is
// deliberately short: it is the most frequent few, which is what Delta uses.
export const FUNCTION_WORDS = [
  "the", "a", "an", "and", "but", "or", "if", "then", "so", "because", "that", "this",
  "of", "to", "in", "on", "for", "with", "as", "at", "by", "from", "i", "you", "it", "we",
  "is", "was", "be", "have", "not", "no", "just", "still", "very", "quite", "rather",
];

const IMPRESSION_STEMS = [
  "punchy", "witty", "warm", "dry", "snappy", "punch", "sassy", "confiden", "playful",
  "magnetic", "vibey", "vibe", "energy", "aura", "voice-y", "cool", "quirky", "genuine",
];

export function impressionWords(text: string): string[] {
  const lower = text.toLowerCase();
  return IMPRESSION_STEMS.filter((stem) => new RegExp(`\\b${stem}`, "i").test(lower));
}

const HEDGES = ["i think", "maybe", "probably", "sort of", "kind of", "i guess", "perhaps", "roughly", "about"];

// what counts as "moved" for each feature, in its own unit. these are deliberately loose:
// the point is to catch a different writer, not to catch a bad day.
const TOLERANCE: Record<FeatureName, number> = {
  sentence_length: 2,
  sentence_variance: 4,
  function_word_rate: 5,
  contraction_rate: 1,
  punctuation_rate: 1,
  ellipsis_rate: 0.5,
  emoji_rate: 1,
  hedge_rate: 1,
  yule_k: 10,
};

export function featureProblems(feature: Feature, who = "feature"): string[] {
  const problems: string[] = [];
  const min = MIN_TOKENS[feature.name];
  if (!feature.window?.tokens || !feature.window?.register?.trim() || !feature.window?.messages) {
    problems.push(`${who}: ${feature.name} has no window, and a feature with no window is a rumour with a decimal`);
  } else if (min && feature.window.tokens < min) {
    problems.push(`${who}: ${feature.name} measured over ${feature.window.tokens} tokens, and ${min} is the floor before the number is style rather than arithmetic`);
  }
  if (!feature.method?.trim()) {
    problems.push(`${who}: ${feature.name} does not say how it was counted`);
  }
  const impressions = impressionWords(`${feature.method} ${feature.window?.register ?? ""}`);
  if (impressions.length) {
    problems.push(`${who}: "${impressions[0]}" is what a reader concludes, not a feature`);
  }
  if (!Number.isFinite(feature.value) || feature.value < 0) {
    problems.push(`${who}: ${feature.name} is not a number a measurement can produce`);
  }
  if (feature.name === "function_word_rate" && feature.value > 700) {
    problems.push(`${who}: a function word rate of ${feature.value} per thousand is not a register, it is a stopword list`);
  }
  return problems;
}

export function profileProblems(profile: StyleProfile): string[] {
  const problems: string[] = [];
  if (!profile.id?.trim() || !profile.version?.trim()) problems.push("profile: an id and a version, or nothing downstream can pin it");
  if (!profile.subject?.trim()) problems.push("profile: no subject, so this style belongs to nobody in particular");
  if (!profile.register?.trim()) problems.push("profile: no register, and she does not write the same in a caption and a longform piece");
  if (!profile.features?.length) problems.push("profile: no features, which is a mood board rather than a measurement");
  const seen = new Set<string>();
  for (const feature of profile.features ?? []) {
    if (seen.has(feature.name)) problems.push(`feature: ${feature.name} measured twice, so which one is hers`);
    seen.add(feature.name);
    problems.push(...featureProblems(feature, `feature ${feature.name}`));
  }
  return problems;
}

export interface StyleComparison {
  distance: number;
  shared: FeatureName[];
  unshared: FeatureName[];
  problems: string[];
}

// only features both sides measured can be compared. a distance computed over one shared
// feature is a coincidence with a number attached.
export function styleDistance(a: StyleProfile, b: StyleProfile): StyleComparison {
  const problems: string[] = [];
  if (a.subject !== b.subject && a.register === b.register) {
    problems.push(`${a.subject} and ${b.subject} are different internatives, so this is authorship attribution, not drift`);
  }
  const byName = (p: StyleProfile) => new Map(p.features.map((f) => [f.name, f]));
  const left = byName(a);
  const right = byName(b);
  const shared: FeatureName[] = [];
  const unshared: FeatureName[] = [];
  let total = 0;
  for (const name of left.keys()) {
    const one = left.get(name);
    const two = right.get(name);
    if (!one || !two) {
      unshared.push(name);
      continue;
    }
    shared.push(name);
    total += Math.abs(one.value - two.value) / TOLERANCE[name];
  }
  if (shared.length < 4) {
    problems.push(`only ${shared.length} feature(s) in common, and a comparison over fewer than four is a hunch`);
  }
  const distance = shared.length ? total / shared.length : 0;
  return { distance, shared, unshared, problems };
}

// the drift report a series or an episode runs before it ships.
export function styleDrift(before: StyleProfile, after: StyleProfile): string[] {
  const moved: string[] = [];
  const right = new Map(after.features.map((f) => [f.name, f]));
  for (const one of before.features) {
    const two = right.get(one.name);
    if (!two) {
      moved.push(`${one.name}: gone from the later sample`);
      continue;
    }
    const delta = Math.abs(one.value - two.value);
    if (delta > TOLERANCE[one.name] * 2) {
      moved.push(`${one.name}: ${one.value} -> ${two.value} ${two.unit} (moved ${delta.toFixed(2)}, tolerance ${TOLERANCE[one.name]})`);
    }
  }
  return moved;
}

// Yule's K: a richness measure that does not move just because the sample got longer, which
// type-token ratio does. K = 10^4 * (sum(i^2 * Vi) - N) / N^2, Vi = words occurring i times.
export function yuleK(words: string[]): number {
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  const n = words.length;
  if (n === 0) return 0;
  let m2 = 0;
  for (const frequency of counts.values()) m2 += frequency * frequency;
  return (10000 * (m2 - n)) / (n * n);
}

export interface MeasureOptions {
  register: string;
  messages?: number;
  method?: string;
}

// measure a real sample. this is deliberately plain arithmetic over the text, so the numbers
// can be re-derived by anybody reading the note.
export function measureStyle(text: string, options: MeasureOptions): Feature[] {
  const sentences = text.split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter(Boolean);
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const tokens = words.length;
  const messages = options.messages ?? 1;
  const method = options.method ?? "plain count over the sample";
  const per = (count: number, base: number) => (base ? (count / base) * 1000 : 0);
  const window = { tokens, messages, register: options.register };
  const lengths = sentences.map((s) => (s.match(/[a-z']+/gi) ?? []).length);
  const mean = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const variance = lengths.length
    ? lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length
    : 0;
  const functionWords = words.filter((w) => FUNCTION_WORDS.includes(w)).length;
  const contractions = (text.match(/\b\w+'(?:s|t|re|ve|ll|d|m)\b/gi) ?? []).length;
  const punctuation = (text.match(/[,;:()\-]/g) ?? []).length;
  const ellipses = (text.match(/\.\.\.|…/g) ?? []).length;
  const emoji = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const hedges = HEDGES.reduce((sum, hedge) => sum + (text.toLowerCase().split(hedge).length - 1), 0);
  return [
    { name: "sentence_length", value: Number(mean.toFixed(2)), unit: "tokens", window, method },
    { name: "sentence_variance", value: Number(variance.toFixed(2)), unit: "index", window, method },
    { name: "function_word_rate", value: Number(per(functionWords, tokens).toFixed(2)), unit: "per_1000_words", window, method },
    { name: "contraction_rate", value: Number(((contractions / (tokens || 1)) * 100).toFixed(2)), unit: "per_100_words", window, method },
    { name: "punctuation_rate", value: Number(((punctuation / (tokens || 1)) * 100).toFixed(2)), unit: "per_100_words", window, method },
    { name: "ellipsis_rate", value: Number(((ellipses / (tokens || 1)) * 100).toFixed(2)), unit: "per_100_words", window, method },
    { name: "emoji_rate", value: Number((emoji / messages).toFixed(2)), unit: "per_message", window, method },
    { name: "hedge_rate", value: Number(((hedges / (tokens || 1)) * 100).toFixed(2)), unit: "per_100_words", window, method },
    { name: "yule_k", value: Number(yuleK(words).toFixed(2)), unit: "index", window, method },
  ];
}

export async function styleDigest(profile: StyleProfile): Promise<string> {
  return await digestOf({ kind: "stylometry", id: profile.id, version: profile.version, subject: profile.subject, register: profile.register, features: profile.features });
}
