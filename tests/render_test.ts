import { assertEquals } from "jsr:@std/assert@1";
import { barsOf, chordToMidis, midiToHz, noteToMidi, renderProblems, renderScoreToWav, wavHeader } from "../music/render.ts";
import { composeScore } from "../music/score.ts";
import { loudnessProblems, measureLoudness } from "../music/master_check.ts";
import { STREAMING_TARGET } from "../music/master.ts";
import type { SongSpec } from "../music/song.ts";
import { toolsAvailable } from "./tools.ts";

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
    { kind: "verse", bars: 8 },
    { kind: "chorus", bars: 8 },
  ],
};

const score = composeScore(song, 0);

Deno.test("notes are notes: a name becomes a midi number or nothing at all", () => {
  assertEquals(noteToMidi("A4"), 69);
  assertEquals(Math.round(midiToHz(69)), 440);
  assertEquals(noteToMidi("C4"), 60);
  assertEquals(Math.round(midiToHz(60)), 262);
  assertEquals(noteToMidi("F#3"), 54);
  assertEquals(noteToMidi("Bb2"), 46);
  assertEquals(noteToMidi("H4"), undefined);
  assertEquals(noteToMidi(""), undefined);
});

Deno.test("a chord is a root and a third, because that is the difference between the two", () => {
  assertEquals(chordToMidis("D"), [62, 66, 69]);
  assertEquals(chordToMidis("Dm"), [62, 65, 69]);
  assertEquals(chordToMidis("F#m", 3), [54, 57, 61]);
  assertEquals(chordToMidis("??"), []);
});

Deno.test("the wav header is the one every tool expects", () => {
  const header = wavHeader(1000, 44100);
  assertEquals(header.length, 44);
  const view = new DataView(header.buffer);
  assertEquals(view.getUint32(4, true), 1036);
  assertEquals(view.getUint16(20, true), 1);
  assertEquals(view.getUint16(22, true), 1);
  assertEquals(view.getUint32(24, true), 44100);
  assertEquals(view.getUint32(40, true), 1000);
});

Deno.test("a bar list is the score flattened, one chord and one bass note per bar", () => {
  const bars = barsOf(score);
  assertEquals(bars.length, 20);
  assertEquals(bars.every((b) => typeof b.chord === "string" && typeof b.bass === "string"), true);
  assertEquals(bars[0].hit, true, "the first bar of a section is a hit");
});

Deno.test("the score renders to a wav whose duration is the arithmetic, not an accident", () => {
  const wav = renderScoreToWav(score, { bars: 4 });
  assertEquals(wav.slice(0, 4), new Uint8Array([0x52, 0x49, 0x46, 0x46]));
  assertEquals(renderProblems(score, wav, { bars: 4 }), []);
  const four = renderScoreToWav(score, { bars: 4 });
  const two = renderScoreToWav(score, { bars: 2 });
  assertEquals(Math.abs((four.length - 44) - 2 * (two.length - 44)) < 8, true, "four bars of data is two bars of data twice, and the header is not data");
  const wrong = renderProblems(score, wav, { bars: 8 });
  assertEquals(wrong.length > 0, true);
});

Deno.test("a render is deterministic, and the seed is audible rather than decorative", () => {
  // the intro is the same four chords in every seed, so the comparison has to reach
  // past it or the seeds look identical when they are not
  const a = renderScoreToWav(score, { bars: 12 });
  const b = renderScoreToWav(score, { bars: 12 });
  assertEquals(a.length, b.length);
  assertEquals(a.every((byte, i) => byte === b[i]), true, "same score and same options, same bytes");

  // a seed only picks which progression a section borrows, so find one that picks
  // differently and show that the audio moves with it
  const changed = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map((seed) => composeScore(song, seed))
    .find((candidate) => JSON.stringify(barsOf(candidate)) !== JSON.stringify(barsOf(score)));
  assertEquals(Boolean(changed), true, "some seed has to choose a different progression");
  const other = renderScoreToWav(changed!, { bars: 12 });
  assertEquals(other.length === a.length && a.every((byte, i) => byte === other[i]), false, "different chords, different audio");
});

const haveFfmpeg = toolsAvailable("ffmpeg", "ffprobe");

Deno.test({
  name: "a real render is measured by ffmpeg, and the master contract has something to judge",
  ignore: !haveFfmpeg,
  fn: async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/render.wav`;
  await Deno.writeFile(path, renderScoreToWav(score, { bars: 8 }));
  const probe = await new Deno.Command("ffprobe", {
    args: ["-v", "error", "-show_entries", "stream=codec_name,sample_rate,channels", "-of", "csv=p=0", path],
    stdout: "piped",
    stderr: "null",
  }).output();
  const info = new TextDecoder().decode(probe.stdout).trim();
  assertEquals(probe.success, true);
  assertEquals(info.startsWith("pcm_s16le,44100,1"), true, info);

  const measured = await measureLoudness(path);
  assertEquals(measured.problems, []);
  assertEquals(Number.isFinite(measured.measurement!.integrated_lufs), true);
  // a bare additive mix is nowhere near a master, and saying so is the point
  const against = loudnessProblems(measured.measurement!, STREAMING_TARGET);
  assertEquals(against.length > 0, true, "the render is a mix, not a master");
  await Deno.remove(dir, { recursive: true });
  },
});

Deno.test("stems come from the same score, so a mixdown can never disagree with them", () => {
  const mix = renderScoreToWav(score, { bars: 2 });
  const bass = renderScoreToWav(score, { bars: 2, voice: "bass" });
  const chords = renderScoreToWav(score, { bars: 2, voice: "chords" });
  const click = renderScoreToWav(score, { bars: 2, voice: "click" });
  const differs = (x: Uint8Array, y: Uint8Array) => x.some((byte, i) => byte !== y[i]);
  assertEquals(differs(mix, bass), true);
  assertEquals(differs(mix, chords), true);
  assertEquals(differs(bass, click), true);
  assertEquals(bass.length, mix.length, "a stem is the same length as the mix it belongs to");
});
