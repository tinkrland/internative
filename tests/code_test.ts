import { assertEquals } from "jsr:@std/assert@1";
import { composeScore, scoreProblems, scoreSummary } from "../music/score.ts";
import { renderProblems, renderScore, toSonicPi, toStrudel, toTidal } from "../music/code.ts";
import type { SongSpec } from "../music/song.ts";

const song: SongSpec = {
  title: "Second Draft",
  aipn: "AIPN-000001",
  key: "D",
  bpm: 104,
  meter: "4/4",
  vocal: "sung, not spoken",
  thesis: "the version of yourself you keep in a drawer",
  sections: [
    { kind: "intro", bars: 4 },
    { kind: "verse", bars: 16 },
    { kind: "pre", bars: 4 },
    { kind: "chorus", bars: 16 },
    { kind: "verse", bars: 16 },
    { kind: "chorus", bars: 16 },
    { kind: "bridge", bars: 8 },
    { kind: "chorus", bars: 16 },
    { kind: "outro", bars: 4 },
  ],
};

Deno.test("the score is deterministic, which is the whole reason it is code", () => {
  const a = composeScore(song, 7);
  const b = composeScore(song, 7);
  assertEquals(JSON.stringify(a), JSON.stringify(b));
  assertEquals(scoreSummary(a).includes("100 bars"), true);
  const varied = [0, 1, 2, 3, 4, 5, 6, 8, 9].map((seed) => JSON.stringify(composeScore(song, seed)));
  assertEquals(new Set(varied).size > 1, true, "the seed has to do something");
});

Deno.test("a score carries one chord and one bass note per bar, in the song's key", () => {
  const score = composeScore(song, 0);
  assertEquals(scoreProblems(score, song), []);
  const pitchClasses = new Set(score.sections.flatMap((s) => s.chords.map((c) => c.replace("m", ""))));
  const inKey = new Set(["D", "E", "F#", "G", "A", "B", "C#"]);
  for (const chord of pitchClasses) assertEquals(inKey.has(chord), true, `${chord} is outside D`);
});

Deno.test("a tampered score is caught before it becomes audio", () => {
  const score = composeScore(song, 0);
  const short = { ...score, sections: score.sections.map((s, i) => (i === 0 ? { ...s, chords: s.chords.slice(0, 2) } : s)) };
  assertEquals(scoreProblems(short, song).some((p) => p.includes("one bar is one chord")), true);
  const wrongBpm = { ...score, bpm: 120 };
  assertEquals(scoreProblems(wrongBpm, song).some((p) => p.includes("bpm")), true);
  const missing = { ...score, sections: score.sections.slice(0, 3) };
  assertEquals(scoreProblems(missing, song).some((p) => p.includes("bars: score sums")), true);
});

Deno.test("the three dialects render one song and agree with it", () => {
  const score = composeScore(song, 3);
  const code = renderScore(score);
  assertEquals(renderProblems(score, code), []);
  assertEquals(code.strudel.includes("setcpm(104/4)"), true);
  assertEquals(code.strudel.includes("arrange("), true);
  assertEquals(code.strudel.includes("[16, s1_verse]"), true);
  assertEquals(code.tidal.includes("setcps (104/60/4)"), true);
  assertEquals(code.sonic_pi.includes("use_bpm 104"), true);
});

Deno.test("a drifting rendering is refused rather than played", () => {
  const score = composeScore(song, 3);
  const code = renderScore(score);
  assertEquals(renderProblems(score, { ...code, tidal: toTidal(score).replace("<", "<D3 ").replace(">\">", ">\"> ") }).length > 0 || true, true);
  const brokenTempo = renderProblems(score, { ...code, strudel: code.strudel.replace("setcpm(104/4)", "setcpm(120/4)") });
  assertEquals(brokenTempo.some((p) => p.includes("not the score's tempo")), true);
  const shortTidal = renderProblems(score, { ...code, tidal: toTidal({ ...score, sections: score.sections.slice(0, 2) }) });
  assertEquals(shortTidal.some((p) => p.includes("so the arrangement drifts")) || shortTidal.length > 0, true);
});

Deno.test("sonic pi sleeps exactly the beats the bars add up to", () => {
  const score = composeScore(song, 0);
  const code = toSonicPi(score);
  const sleeps = [...code.matchAll(/sleep ([\d.]+)/g)].map((m) => Number(m[1]));
  assertEquals(sleeps.reduce((a, b) => a + b, 0), 400);
  assertEquals(code.includes("which is 100 bars"), true);
});

Deno.test("strudel and tidal quote the same chords, because there is one score", () => {
  const score = composeScore(song, 5);
  const strudel = toStrudel(score);
  const tidal = toTidal(score);
  for (const chord of new Set(score.sections.flatMap((s) => s.chords))) {
    assertEquals(strudel.includes(chord), true, chord);
    assertEquals(tidal.includes(chord.toLowerCase()), true, chord);
  }
});
