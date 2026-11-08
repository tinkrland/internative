// one score, three renderings.
//
// songs here are code before they are audio. a score is the deterministic middle
// layer: chords, bass and hits per section, derived from the song's key, tempo and a
// seed, so strudel, tidal and sonic pi all play the same song rather than three
// cousins of it. same seed and same song means the same score, which is what makes a
// song reviewable in a diff.

import type { SongSpec } from "./song.ts";

export interface SectionScore {
  kind: string;
  bars: number;
  // chord names as they are written in every lead sheet
  chords: string[];
  // one root per bar for the bass, in the octave a bass actually plays
  bass: string[];
  // which bars the snare lands on, 0 based
  hits: number[];
}

export interface Score {
  title: string;
  key: string;
  bpm: number;
  meter: string;
  seed: number;
  sections: SectionScore[];
}

// deterministic, tiny, and good enough: the point is reproducibility, not randomness
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (const char of text) {
    h ^= char.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DEGREES = ["I", "ii", "iii", "IV", "V", "vi"];

// the four progressions a song like this is allowed to borrow from. a chorus gets
// the one that resolves, because that is what a chorus is for.
const PROGRESSIONS: Record<string, number[][]> = {
  verse: [
    [0, 4, 5, 3],
    [0, 3, 4, 4],
    [0, 5, 3, 4],
  ],
  chorus: [
    [3, 0, 4, 5],
    [0, 4, 3, 4],
  ],
  bridge: [
    [5, 3, 0, 4],
    [1, 4, 0, 0],
  ],
  default: [
    [0, 3, 0, 4],
  ],
};

// major and natural minor spelled out, so a chord name is a chord name and not a
// pattern to be guessed at render time
const SCALES: Record<string, [string, string[]]> = {
  C: ["C", ["C", "D", "E", "F", "G", "A", "B"]],
  G: ["G", ["G", "A", "B", "C", "D", "E", "F#"]],
  D: ["D", ["D", "E", "F#", "G", "A", "B", "C#"]],
  A: ["A", ["A", "B", "C#", "D", "E", "F#", "G#"]],
  E: ["E", ["E", "F#", "G#", "A", "B", "C#", "D#"]],
  F: ["F", ["F", "G", "A", "Bb", "C", "D", "E"]],
  Bb: ["Bb", ["Bb", "C", "D", "Eb", "F", "G", "A"]],
  Eb: ["Eb", ["Eb", "F", "G", "Ab", "Bb", "C", "D"]],
  Ab: ["Ab", ["Ab", "Bb", "C", "Db", "Eb", "F", "G"]],
  Db: ["Db", ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"]],
};

const MINOR_THIRD = new Set([1, 2, 5]);

export function scoreProblems(score: Score, song: SongSpec): string[] {
  const problems: string[] = [];
  if (!SCALES[score.key?.replace("m", "") ?? ""]) problems.push(`key: "${score.key}" is not spelled here`);
  if (score.bpm !== song.bpm) problems.push(`bpm: score is ${score.bpm}, song is ${song.bpm}`);
  const scoreBars = (score.sections ?? []).reduce((total, s) => total + s.bars, 0);
  const songBars = (song.sections ?? []).reduce((total, s) => total + s.bars, 0);
  if (scoreBars !== songBars) problems.push(`bars: score sums to ${scoreBars} and the song to ${songBars}`);
  const kinds = (score.sections ?? []).map((s) => s.kind).join(",");
  const expected = (song.sections ?? []).map((s) => s.kind).join(",");
  if (kinds !== expected) problems.push(`sections: score is ${kinds}, song is ${expected}`);
  for (const section of score.sections ?? []) {
    if (section.chords?.length !== section.bars) problems.push(`${section.kind}: ${section.chords?.length} chords for ${section.bars} bars, and one bar is one chord here`);
    if (section.bass?.length !== section.bars) problems.push(`${section.kind}: ${section.bass?.length} bass notes for ${section.bars} bars`);
  }
  return problems;
}

export function composeScore(song: SongSpec, seed = 0): Score {
  const key = (song.key ?? "C").replace("m", "");
  const [, scale] = SCALES[key] ?? SCALES.C;
  const random = mulberry32(hash(`${song.title}:${key}:${seed}`));
  const sections: SectionScore[] = (song.sections ?? []).map((section) => {
    const pool = PROGRESSIONS[section.kind] ?? PROGRESSIONS.default;
    const progression = pool[Math.floor(random() * pool.length)] ?? PROGRESSIONS.default[0];
    const chords: string[] = [];
    const bass: string[] = [];
    for (let bar = 0; bar < section.bars; bar += 1) {
      const degree = progression[bar % progression.length];
      const root = scale[degree];
      const minor = MINOR_THIRD.has(degree);
      chords.push(`${root}${minor ? "m" : ""}`);
      bass.push(`${root}2`);
    }
    const hits: number[] = [];
    for (let bar = 0; bar < section.bars; bar += 1) {
      if (section.kind === "chorus" || bar % 2 === 0) hits.push(bar);
    }
    return { kind: section.kind, bars: section.bars, chords, bass, hits };
  });
  return { title: song.title, key, bpm: song.bpm, meter: song.meter, seed, sections };
}

export function scoreSummary(score: Score): string {
  const total = score.sections.reduce((sum, s) => sum + s.bars, 0);
  return `${score.title} in ${score.key}, ${score.bpm} bpm, ${total} bars, seed ${score.seed}: ${score.sections.map((s) => `${s.kind} ${s.chords.slice(0, 4).join("-")}${s.chords.length > 4 ? "-..." : ""}`).join(" | ")}`;
}

export { DEGREES };
