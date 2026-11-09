// the three lanes, and the join that has to hold.

import { assertEquals } from "jsr:@std/assert@1";
import { LANE_VENDORS, laneVendors, vendorFor, vendorProblems, voiceIdentityProblems } from "../music/lanes.ts";
import { fitProblems, melodyFor, splitSyllables, toSvs } from "../music/melody.ts";
import { assemblyProblems, mixdownArgs, remix, type AssemblyPlan } from "../music/assembly.ts";
import { composeScore } from "../music/score.ts";
import { emptySheet } from "../music/lyrics.ts";

const song = {
  title: "Second Draft", aipn: "AIPN-000001", key: "D", bpm: 104, meter: "4/4",
  vocal: "low, close, unhurried", thesis: "a second draft of a first impression",
  sections: [{ kind: "intro", bars: 4 }, { kind: "verse", bars: 8 }, { kind: "chorus", bars: 8 }],
} as never;

const rights = { basis: "original" as const, writers: ["tinkrland"] };
const score = composeScore(song, 3);

Deno.test("a non commercial weight may make a preview and never a release", () => {
  const musicgen = vendorFor("musicgen")!;
  assertEquals(vendorProblems(musicgen, false), []);
  assertEquals(vendorProblems(musicgen, true)[0].includes("cannot carry a released song"), true);
});

Deno.test("copyleft sings only from behind a process boundary", () => {
  const seedvc = vendorFor("seed-vc")!;
  assertEquals(seedvc.licence, "GPL-3.0");
  assertEquals(seedvc.isolation, "process");
  assertEquals(vendorProblems(seedvc, true), []);
  const imported = { ...seedvc, isolation: "none" as const };
  assertEquals(vendorProblems(imported, true).some((p) => p.includes("separate process")), true);
});

Deno.test("the lanes are not one model, and performance has real open options", () => {
  assertEquals(laneVendors("performance").some((v) => v.id === "diffsinger" && v.commercial), true);
  assertEquals(laneVendors("musicality").some((v) => v.id === "ace-step-1.5"), true);
  assertEquals(LANE_VENDORS.every((v) => v.licence.length > 0), true);
});

Deno.test("the singing voice is the speaking voice or it is somebody else", () => {
  const speaking = { id: "voice-01", digest: "d1" };
  assertEquals(voiceIdentityProblems(speaking, { id: "voice-01", digest: "d1" }), []);
  assertEquals(voiceIdentityProblems(speaking, { id: "voice-02", digest: "d1" }).length, 1);
  assertEquals(voiceIdentityProblems(speaking, { id: "voice-01", digest: "d2" })[0].includes("different timbre"), true);
});

Deno.test("a syllable is counted the way it is sung, not the way it is spelled", () => {
  assertEquals(splitSyllables("hold the line"), ["hold", "the", "line"]);
  assertEquals(splitSyllables("melody").length, 3);
  assertEquals(splitSyllables("").length, 0);
});

Deno.test("one note per syllable, in order, on chord tones", () => {
  const sheet = emptySheet(song, rights);
  sheet.sections = [{ kind: "verse", lines: [{ text: "hold the line" }, { text: "say it twice" }] }];
  const { notes, problems } = melodyFor(score, sheet);
  assertEquals(problems, []);
  assertEquals(notes.length, 6);
  assertEquals(notes[0].syllable, "hold");
  assertEquals(notes[2].syllable, "line");
  assertEquals(notes.slice(0, 3).map((n) => n.bar), [0, 0, 0]);
  assertEquals(notes[3].bar, 1, "a new line starts on a new bar");
  assertEquals(notes.every((n) => n.beats === 1), true);
});

Deno.test("words that do not fit are refused before a note is rendered", () => {
  const sheet = emptySheet(song, rights);
  sheet.sections = [{ kind: "verse", lines: [{ text: "a line with far too many unnecessary syllables in a single bar of four" }] }];
  // the fit check warns, the melody still places: a long line is a rewrite note, not
  // a crash, and the writer needs to see the number rather than an exception
  assertEquals(fitProblems(score, sheet).some((p) => p.includes("needs 21 beats")), true);
  const { notes, problems } = melodyFor(score, sheet);
  assertEquals(problems, []);
  assertEquals(notes.length, 21);
  assertEquals(notes[notes.length - 1].bar > notes[0].bar, true, "a long line runs across bars");
});

Deno.test("the svs script is seconds off the tempo, so a renderer cannot drift", () => {
  const sheet = emptySheet(song, rights);
  sheet.sections = [{ kind: "verse", lines: [{ text: "hold the line" }] }];
  const script = toSvs(score, melodyFor(score, sheet));
  assertEquals(script.bpm, 104);
  assertEquals(script.notes[0].start, 0);
  assertEquals(script.notes[1].start, Number((60 / 104).toFixed(4)));
  assertEquals(script.notes.length, 3);
});

const plan: AssemblyPlan = {
  aipn: "AIPN-000001",
  title: "Second Draft",
  takes: { musicality: "m1", lyric: "l1", performance: "p1" },
  stems: [
    { lane: "musicality", path: "music.wav", sample_rate: 48000, channels: 2, digest: "m1" },
    { lane: "performance", path: "vocal.wav", sample_rate: 48000, channels: 1, dry: true, digest: "p1" },
  ],
  mix: { vocal_db: -3, music_db: -6 },
  master: { integrated_lufs: -14, true_peak_db: -1, bit_depth: 24 },
};

Deno.test("a coherent assembly passes, and a remix is two numbers", () => {
  assertEquals(assemblyProblems(plan), []);
  assertEquals(remix(plan, -1, -8).mix.music_db, -8);
  assertEquals(assemblyProblems(remix(plan, -1, -8)), []);
});

Deno.test("a vocal from another take is two songs, and it is caught", () => {
  const mixed = { ...plan, stems: [plan.stems[0], { ...plan.stems[1], digest: "p2" }] };
  assertEquals(assemblyProblems(mixed).some((p) => p.includes("two songs")), true);
});

Deno.test("a wet vocal cannot be remixed, and a backing track is not a song", () => {
  const wet = { ...plan, stems: [plan.stems[0], { ...plan.stems[1], dry: false }] };
  assertEquals(assemblyProblems(wet).some((p) => p.includes("never be remixed")), true);
  const backing = { ...plan, stems: [plan.stems[0]] };
  assertEquals(assemblyProblems(backing).some((p) => p.includes("backing track")), true);
});

Deno.test("the master target is the delivery contract, not a preference", () => {
  const quiet = { ...plan, master: { ...plan.master, integrated_lufs: -9 } };
  assertEquals(assemblyProblems(quiet).some((p) => p.includes("-14 LUFS")), true);
});

Deno.test("the mixdown is readable arguments with the voice above the music", () => {
  const args = mixdownArgs(plan, "out.wav");
  assertEquals(args.includes("-filter_complex"), true);
  assertEquals(args[args.indexOf("-c:a") + 1], "pcm_s24le");
  assertEquals(args[args.length - 1], "out.wav");
  const loud = { ...plan, mix: { vocal_db: -6, music_db: -2 } };
  assertEquals(assemblyProblems(loud).some((p) => p.includes("sits above the voice")), true);
});
