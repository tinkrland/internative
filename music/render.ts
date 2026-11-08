// the score, played.
//
// this is the part that makes "music as code" audible rather than aspirational: the
// score is synthesised to wav by arithmetic, with no model and no plugin, so a song
// exists as a file you can measure, before any model is asked to make it beautiful.
// the model lane then replaces a voice or an instrument in a mix that already plays.
//
// everything here is deterministic: same score, same options, same bytes.

import type { Score } from "./score.ts";

export type Voice = "mix" | "chords" | "bass" | "click";

export interface RenderOptions {
  sample_rate?: number;
  // render the first N bars only, which is what a test and a preview both want
  bars?: number;
  voice?: Voice;
  // master gain, before the integer conversion. the mix sits low on purpose and the
  // loudness contract is met later, in the master step, not here.
  gain?: number;
}

const PITCH_CLASS: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const MIDI_A4 = 69;
const HZ_A4 = 440;

// "F#3" to 54, "Bb2" to 46. an unreadable note is refused rather than defaulted,
// because a silent default is how a song ends up in the wrong key.
export function noteToMidi(note: string): number | undefined {
  const match = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(note?.trim() ?? "");
  if (!match) return undefined;
  const [, letter, accidental, octave] = match;
  const pitch = PITCH_CLASS[`${letter.toUpperCase()}${accidental}`];
  if (pitch === undefined) return undefined;
  return pitch + (Number(octave) + 1) * 12;
}

export function midiToHz(midi: number): number {
  return HZ_A4 * Math.pow(2, (midi - MIDI_A4) / 12);
}

export function chordToMidis(chord: string, octave = 4): number[] {
  const minor = chord.endsWith("m") && !chord.endsWith("maj");
  const root = noteToMidi(`${chord.replace(/m$/, "")}${octave}`);
  if (root === undefined) return [];
  return [0, minor ? 3 : 4, 7].map((interval) => root + interval);
}

const beatsPerBar = (meter: string) => Number(meter.split("/")[0]) || 4;

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

// a canonical 44 byte pcm wav header. 16 bit, mono, one data chunk: enough for every
// tool that will ever look at this file, and nothing to argue with.
export function wavHeader(data_bytes: number, sample_rate: number, channels = 1, bits = 16): Uint8Array {
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);
  const byte_rate = (sample_rate * channels * bits) / 8;
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + data_bytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sample_rate, true);
  view.setUint32(28, byte_rate, true);
  view.setUint16(32, (channels * bits) / 8, true);
  view.setUint16(34, bits, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, data_bytes, true);
  return header;
}

// bars of the score in order, flattened, so a bar knows its chord and its bass note
interface Bar {
  chord: string;
  bass: string;
  // a hit bar carries a click, so a section's pulse is audible and countable
  hit: boolean;
}

export function barsOf(score: Score): Bar[] {
  return score.sections.flatMap((section) =>
    section.chords.map((chord, index) => ({ chord, bass: section.bass[index] ?? section.bass[0] ?? "C2", hit: index === 0 || section.kind === "chorus" }))
  );
}

function envelope(t: number, duration: number): number {
  const attack = 0.012;
  const release = Math.min(0.08, duration * 0.25);
  if (t < attack) return t / attack;
  if (t > duration - release) return Math.max(0, (duration - t) / release);
  return 1;
}

export function renderScoreToWav(score: Score, options: RenderOptions = {}): Uint8Array {
  const sampleRate = options.sample_rate ?? 44100;
  const voice = options.voice ?? "mix";
  const gain = options.gain ?? 0.5;
  const beats = beatsPerBar(score.meter);
  const secondsPerBar = (beats * 60) / score.bpm;
  const samplesPerBar = Math.round(secondsPerBar * sampleRate);
  const allBars = barsOf(score);
  const bars = options.bars === undefined ? allBars : allBars.slice(0, Math.max(0, options.bars));
  const total = samplesPerBar * bars.length;
  const samples = new Float32Array(total);

  bars.forEach((bar, barIndex) => {
    const offset = barIndex * samplesPerBar;
    const duration = samplesPerBar / sampleRate;
    const chordMidis = voice === "bass" || voice === "click" ? [] : chordToMidis(bar.chord, 4);
    const bassMidi = voice === "chords" || voice === "click" ? undefined : noteToMidi(bar.bass);
    const chordHz = chordMidis.map(midiToHz);
    const bassHz = bassMidi === undefined ? undefined : midiToHz(bassMidi);

    for (let i = 0; i < samplesPerBar; i += 1) {
      const t = i / sampleRate;
      const env = envelope(t, duration);
      let value = 0;
      if (voice !== "bass" && voice !== "click") {
        for (const hz of chordHz) value += Math.sin(2 * Math.PI * hz * t) * 0.16;
      }
      if (voice !== "chords" && voice !== "click" && bassHz !== undefined) {
        value += Math.sin(2 * Math.PI * bassHz * t) * 0.26;
      }
      if (voice !== "chords" && voice !== "bass" && bar.hit && t < 0.03) {
        // a short 1 khz ping rather than noise, so the render stays deterministic to
        // the byte and a click is still countable
        value += Math.sin(2 * Math.PI * 1000 * t) * 0.22 * (1 - t / 0.03);
      }
      samples[offset + i] = value * env * gain;
    }
  });

  const dataBytes = total * 2;
  const header = wavHeader(dataBytes, sampleRate);
  const wav = new Uint8Array(44 + dataBytes);
  wav.set(header, 0);
  const view = new DataView(wav.buffer);
  for (let i = 0; i < total; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }
  return wav;
}

// what a render should be, checked rather than assumed: the duration arithmetic is
// where a tempo bug hides, and a half rendered bar is silent rather than wrong sounding
export function renderProblems(score: Score, wav: Uint8Array, options: RenderOptions = {}): string[] {
  const problems: string[] = [];
  if (wav.length < 45) return ["render: that is not a wav, it is a stub"];
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const asText = (offset: number) => String.fromCharCode(...wav.slice(offset, offset + 4));
  if (asText(0) !== "RIFF" || asText(8) !== "WAVE") problems.push("render: missing the RIFF/WAVE signature");
  const dataBytes = view.getUint32(40, true);
  if (44 + dataBytes !== wav.length) problems.push(`render: header claims ${dataBytes} bytes and the file holds ${wav.length - 44}`);
  const sampleRate = view.getUint32(24, true);
  const seconds = dataBytes / 2 / sampleRate;
  const beats = beatsPerBar(score.meter);
  const allBars = barsOf(score).length;
  const bars = options.bars === undefined ? allBars : Math.min(options.bars, allBars);
  const expected = (bars * beats * 60) / score.bpm;
  if (Math.abs(seconds - expected) > 0.05) problems.push(`render: ${seconds.toFixed(2)}s rendered against ${expected.toFixed(2)}s expected`);
  return problems;
}
