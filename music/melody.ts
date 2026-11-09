// the bridge between the words and the singing.
//
// a lyric line is a sentence. a performance is a note per syllable. the join is a
// melody: one slot per beat, filled in order, so the same words land on the same
// notes every time and the words can be rewritten without regenerating the music.
//
// this is also the cross check that catches the classic failure: words that do not
// fit. a line with eighteen syllables over four beats is not a fast line, it is a
// line that will be squeezed and mispronounced.

import type { LyricSheet } from "./lyrics.ts";
import { syllableHint } from "./lyrics.ts";
import { noteToMidi } from "./render.ts";
import type { Score } from "./score.ts";

export interface NoteEvent {
  bar: number;
  beat: number;
  beats: number;
  midi: number;
  syllable: string;
}

export interface SvsScript {
  bpm: number;
  language: string;
  notes: { start: number; duration: number; midi: number; syllable: string }[];
}

const VOICING = [0, 4, 7, 12];

export function beatsPerBar(score: Score): number {
  const beats = Number(score.meter.split("/")[0]);
  return Number.isFinite(beats) && beats > 0 ? beats : 4;
}

export function totalBars(score: Score): number {
  return score.sections.reduce((n, s) => n + s.bars, 0);
}

// deterministic and dialect free: vowel groups, with a silent final e. it is the same
// count the lyric sheet already warns with, so a writer sees the number early.
export function splitSyllables(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z\s']/g, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const word of words) {
    const groups = word.replace(/e$/, "").match(/[aeiouy]+/g) ?? [];
    const count = Math.max(groups.length, 1);
    if (count === 1) {
      out.push(word);
      continue;
    }
    // split after each vowel group so a syllable keeps its consonants
    let rest = word;
    for (let i = 1; i < count; i += 1) {
      const m = rest.match(/^(.*?[aeiouy]+[^aeiouy]*)/);
      if (!m) break;
      out.push(m[1]);
      rest = rest.slice(m[1].length);
    }
    if (rest) out.push(rest);
  }
  return out;
}

function barChords(score: Score): string[] {
  const chords: string[] = [];
  for (const section of score.sections) {
    for (let i = 0; i < section.bars; i += 1) chords.push(section.chords[i % section.chords.length]);
  }
  return chords;
}

function chordTones(chord: string): number[] {
  const minor = /m(?!aj)/.test(chord);
  const root = noteToMidi(`${chord.replace(/[^A-G#b]/g, "")}4`);
  if (root === undefined) return [60, 64, 67, 72];
  return (minor ? [0, 3, 7, 12] : VOICING).map((step) => root + step);
}

export function melodyFor(score: Score, sheet: LyricSheet): { notes: NoteEvent[]; problems: string[] } {
  const problems: string[] = [];
  const perBar = beatsPerBar(score);
  const chords = barChords(score);
  const capacity = chords.length * perBar;
  const notes: NoteEvent[] = [];
  let slot = 0;

  const lines = sheet.sections.flatMap((s) => s.lines);
  lines.forEach((line, index) => {
    const syllables = splitSyllables(line.text);
    if (!syllables.length) {
      problems.push(`line ${index + 1} has no words to sing`);
      return;
    }
    // a line starts on a new bar so a phrase cannot straddle a section change
    slot = Math.ceil(slot / perBar) * perBar;
    if (slot + syllables.length > capacity) {
      problems.push(`line ${index + 1} has ${syllables.length} syllables and the song has ${capacity - slot} slots left`);
      return;
    }
    const tones = chordTones(chords[Math.floor(slot / perBar)] ?? "C");
    syllables.forEach((syllable, i) => {
      const at = slot + i;
      notes.push({
        bar: Math.floor(at / perBar),
        beat: at % perBar,
        beats: 1,
        midi: tones[i % tones.length],
        syllable,
      });
    });
    slot += syllables.length;
  });

  return { notes, problems };
}

export function toSvs(score: Score, melody: { notes: NoteEvent[] }): SvsScript {
  const secondsPerBeat = 60 / score.bpm;
  return {
    bpm: score.bpm,
    language: "en",
    notes: melody.notes.map((n) => ({
      start: Number(((n.bar * beatsPerBar(score) + n.beat) * secondsPerBeat).toFixed(4)),
      duration: Number((n.beats * secondsPerBeat).toFixed(4)),
      midi: n.midi,
      syllable: n.syllable,
    })),
  };
}

// the lyric lane only knows how many syllables a line wants. this is where that
// number and the melody have to agree before a single note is rendered.
export function fitProblems(score: Score, sheet: LyricSheet): string[] {
  const problems: string[] = [];
  const capacity = totalBars(score) * beatsPerBar(score);
  const lines = sheet.sections.flatMap((s) => s.lines);
  const wanted = lines.reduce((n: number, l) => n + syllableHint(l.text), 0);
  if (wanted > capacity) {
    problems.push(`${wanted} syllables will not fit in ${capacity} slots without a rewrite`);
  }
  const crowded = lines.filter((l: { text: string }) => syllableHint(l.text) > beatsPerBar(score));
  for (const line of crowded) {
    problems.push(`"${line.text.slice(0, 32)}" needs ${syllableHint(line.text)} beats in a bar that has ${beatsPerBar(score)}`);
  }
  return problems;
}
