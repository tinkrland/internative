// the song contract: the smallest set of decisions that make a song a song rather
// than a mood board.

import { type HeadBrief, briefProblems } from "./brief.ts";

export type SectionKind = "intro" | "verse" | "pre" | "chorus" | "bridge" | "solo" | "outro";

export interface Section {
  kind: SectionKind;
  bars: number;
}

export interface SongSpec {
  title: string;
  aipn: string;
  key: string;
  bpm: number;
  meter: string;
  // sung, not spoken: the register the head declared, quoted back so a song cannot
  // drift into an announcer voice between releases
  vocal: string;
  sections: Section[];
  // one idea per song. a through-composed piece says so instead of pretending to
  // have a chorus it does not have.
  thesis: string;
  through_composed?: boolean;
}

export const KEYS = ["C", "G", "D", "A", "E", "F", "Bb", "Eb", "Ab", "Db"];
export const SECTION_KINDS: SectionKind[] = ["intro", "verse", "pre", "chorus", "bridge", "solo", "outro"];

export function songProblems(song: SongSpec): string[] {
  const problems: string[] = [];
  if (!song.title?.trim()) problems.push("title: required");
  if (!/^AIPN-\d{6}$/.test(song.aipn ?? "")) problems.push("aipn: a song is released under an aipn");
  const key = (song.key ?? "").replace("m", "");
  if (!KEYS.includes(key)) problems.push(`key: "${song.key}" is not a key this branch arranges in`);
  if (!Number.isFinite(song.bpm) || song.bpm < 50 || song.bpm > 200) problems.push("bpm: outside 50..200");
  if (!/^\d+\/\d+$/.test(song.meter ?? "")) problems.push("meter: expected something like 4/4");
  if (!song.vocal?.trim()) problems.push("vocal: who is singing, in the head's register");
  if (!song.thesis?.trim()) problems.push("thesis: one idea, in one sentence, before any lyrics");

  const sections = song.sections ?? [];
  if (sections.length < 3) problems.push("sections: fewer than three is a loop, not a song");
  for (const section of sections) {
    if (!SECTION_KINDS.includes(section.kind)) problems.push(`sections: "${section.kind}" is not a section this branch knows`);
    if (!Number.isInteger(section.bars) || section.bars < 1) problems.push(`sections: ${section.kind} needs a whole number of bars`);
  }
  const hasChorus = sections.some((s) => s.kind === "chorus");
  if (!hasChorus && !song.through_composed) {
    problems.push("sections: no chorus, and the song does not declare itself through composed");
  }
  const verses = sections.filter((s) => s.kind === "verse").length;
  if (verses === 0) problems.push("sections: no verse, so nothing is being said");

  const bars = sections.reduce((total, s) => total + s.bars, 0);
  const seconds = Math.round((bars * 4 * 60) / (song.bpm || 1));
  if (seconds > 330) problems.push(`sections: ${bars} bars at ${song.bpm} bpm is ${Math.round(seconds / 60)} minutes, and a song that long loses the room`);
  return problems;
}

export function barCount(song: SongSpec): number {
  return (song.sections ?? []).reduce((total, s) => total + s.bars, 0);
}

export function estimatedSeconds(song: SongSpec): number {
  const beatsPerBar = Number((song.meter ?? "4/4").split("/")[0]) || 4;
  return Math.round((barCount(song) * beatsPerBar * 60) / (song.bpm || 1));
}

// the plan a song starts from, so a brief becomes a shape before anyone writes a line
export function planFromBrief(brief: HeadBrief, song: Omit<SongSpec, "vocal">): { song?: SongSpec; problems: string[] } {
  const problems = briefProblems(brief);
  if (problems.length) return { problems };
  const candidate: SongSpec = { ...song, vocal: brief.register.register };
  const songProblems_ = songProblems(candidate);
  return songProblems_.length ? { problems: songProblems_ } : { problems: [], song: candidate };
}
