import { assertEquals } from "jsr:@std/assert@1";
import { briefProblems, type HeadBrief } from "../music/brief.ts";
import { barCount, estimatedSeconds, planFromBrief, songProblems, type SongSpec } from "../music/song.ts";
import { arrangementBrief, arrangementFor, arrangementProblems } from "../music/arrangement.ts";
import { deliverySheet, masterProblems, REQUIRED_STEMS, STREAMING_TARGET } from "../music/master.ts";
import { emptySheet, lyricProblems, rightsProblems, syllableHint } from "../music/lyrics.ts";
import { canShip, releaseProblems, type Release } from "../music/release.ts";

const brief: HeadBrief = {
  persona: "example",
  aipn: "AIPN-000001",
  register: { register: "sung, not spoken: one voice, close mic, no announcer", energy: 0.7, formality: 0.15, lines: "verses and a chorus" },
};

const song: SongSpec = {
  title: "Second Draft",
  aipn: "AIPN-000001",
  key: "D",
  bpm: 104,
  meter: "4/4",
  vocal: brief.register.register,
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

const release: Release = {
  title: song.title,
  aipn: song.aipn,
  targets: ["spotify", "bandcamp"],
  rights: { basis: "original", writers: ["example"] },
  master: STREAMING_TARGET,
  cover_handoff: "one frame, 3000x3000, the grade from appearance/grade",
  explicit: false,
  ai_disclosure: "written and sung by an ai personality",
};

Deno.test("a song is planned against the head's brief, and a brief with no aipn is refused", () => {
  const planned = planFromBrief(brief, song);
  assertEquals(planned.problems, []);
  assertEquals(planned.song?.vocal, brief.register.register);
  assertEquals(briefProblems({ ...brief, aipn: "v3" }).some((p) => p.includes("not an aipn")), true);
  assertEquals(planFromBrief({ ...brief, aipn: "AIPN-1" }, song).problems.length > 0, true);
});

Deno.test("a song declares one idea, a key it can be arranged in, and a shape with a chorus", () => {
  assertEquals(songProblems(song), []);
  assertEquals(songProblems({ ...song, thesis: "" }).some((p) => p.includes("one idea")), true);
  assertEquals(songProblems({ ...song, key: "F#" }).some((p) => p.includes("not a key")), true);
  const noChorus = songProblems({ ...song, sections: song.sections.filter((s) => s.kind !== "chorus") });
  assertEquals(noChorus.some((p) => p.includes("no chorus")), true);
  assertEquals(songProblems({ ...song, through_composed: true, sections: song.sections.filter((s) => s.kind !== "chorus") }).length, 0);
});

Deno.test("the shape has a length, and a song that outstays it is refused", () => {
  assertEquals(barCount(song), 100);
  assertEquals(estimatedSeconds(song), 231);
  const selfIndulgent: SongSpec = {
    ...song,
    sections: [{ kind: "verse", bars: 60 }, { kind: "chorus", bars: 60 }, { kind: "verse", bars: 60 }, { kind: "chorus", bars: 60 }],
  };
  assertEquals(songProblems(selfIndulgent).some((p) => p.includes("loses the room")), true);
});

Deno.test("the arrangement knows what plays when, and arrives somewhere", () => {
  const arrangement = arrangementFor(song, { chorus: ["lead vocal", "kick", "snare", "bass", "electric guitar", "strings"] });
  assertEquals(arrangementProblems(arrangement), []);
  assertEquals(arrangement.lines.length, song.sections.length);
  const briefText = arrangementBrief(song, arrangement);
  assertEquals(briefText.includes("D, 104 bpm"), true);
  assertEquals(briefText.includes("strings"), true);
  const flat = arrangementFor(song);
  flat.lines = flat.lines.map((l) => ({ ...l, dynamic: 2 as const }));
  assertEquals(arrangementProblems(flat).some((p) => p.includes("never arrives")), true);
});

Deno.test("a master is a delivery contract: loudness, peak, and the stems that cannot be recovered later", () => {
  assertEquals(masterProblems(STREAMING_TARGET), []);
  assertEquals(masterProblems({ ...STREAMING_TARGET, integrated_lufs: -6 }).some((p) => p.includes("turned back down")), true);
  assertEquals(masterProblems({ ...STREAMING_TARGET, true_peak_db: 0 }).some((p) => p.includes("lossy encode")), true);
  const noDry = masterProblems({ ...STREAMING_TARGET, stems: STREAMING_TARGET.stems.filter((s) => s !== "dry vocal") });
  assertEquals(noDry.some((p) => p.includes("dry vocal")), true);
  assertEquals(REQUIRED_STEMS.length, 4);
  assertEquals(deliverySheet(STREAMING_TARGET, song.title).includes("-14 LUFS"), true);
});

Deno.test("a lyric sheet follows the song's sections, and a licence is a reference, not a feeling", () => {
  const sheet = emptySheet(song, release.rights);
  assertEquals(sheet.sections.length, song.sections.length);
  const filled = { ...sheet, sections: sheet.sections.map((s) => ({ ...s, lines: [{ text: "a line that fits" }] })) };
  assertEquals(lyricProblems(filled, song), []);
  const reordered = { ...filled, sections: [...filled.sections].reverse() };
  assertEquals(lyricProblems(reordered, song).some((p) => p.includes("lyrics are")), true);
  assertEquals(rightsProblems({ basis: "licensed", writers: ["someone"] }).some((p) => p.includes("licence without a reference")), true);
  assertEquals(rightsProblems({ basis: "public_domain", writers: ["trad"] }).some((p) => p.includes("entered the public domain")), true);
});

Deno.test("borrowed audio is refused unless the rights basis carries paper", () => {
  const sheet = emptySheet(song, { basis: "original", writers: ["example"] });
  const borrowing = { ...sheet, sections: sheet.sections.map((s) => ({ ...s, lines: [{ text: "sample of the old record" }] })) };
  assertEquals(lyricProblems(borrowing, song).some((p) => p.includes("rights")), true);
});

Deno.test("a release names its person, its destinations, its disclosure and its cover handoff", () => {
  assertEquals(releaseProblems(release), []);
  assertEquals(canShip(release), true);
  assertEquals(releaseProblems({ ...release, aipn: "" }).some((p) => p.includes("under an aipn")), true);
  assertEquals(releaseProblems({ ...release, targets: ["myspace"] }).some((p) => p.includes("not a destination")), true);
  assertEquals(releaseProblems({ ...release, ai_disclosure: "" }).some((p) => p.includes("the store wants to know")), true);
  assertEquals(releaseProblems({ ...release, cover_handoff: "" }).some((p) => p.includes("static's job")), true);
});

Deno.test("the syllable hint is a hint, and it counts vowels rather than declaring truth", () => {
  assertEquals(syllableHint("second draft"), 3);
  assertEquals(syllableHint("a"), 1);
  assertEquals(syllableHint("the version of yourself"), 6);
});
