// the lyric sheet, section tagged, so a line knows where it is sung.

import type { SongSpec } from "./song.ts";

export interface LyricLine {
  text: string;
}

export interface LyricSection {
  kind: string;
  lines: LyricLine[];
}

export interface LyricSheet {
  title: string;
  sections: LyricSection[];
  rights: Rights;
}

export type RightsBasis = "original" | "public_domain" | "licensed" | "cover";

export interface Rights {
  basis: RightsBasis;
  // a cover of a living writer is a licence, and a sample of a recording is a
  // clearance, and neither one is a feeling. the reference is the paper.
  reference?: string;
  writers: string[];
}

const BORROWED = [/\bsample of\b/i, /\binterpolat/i];

export function lyricProblems(sheet: LyricSheet, song: SongSpec): string[] {
  const problems: string[] = [];
  const expected = song.sections.map((s) => s.kind);
  const actual = sheet.sections.map((s) => s.kind);
  if (actual.join(",") !== expected.join(",")) {
    problems.push(`sections: lyrics are ${actual.join(", ")} and the song is ${expected.join(", ")}`);
  }
  for (const section of sheet.sections) {
    if (!section.lines?.length) problems.push(`${section.kind}: a section with no lines is a gap in the vocal`);
    for (const line of section.lines ?? []) {
      if (line.text.trim().length > 90) problems.push(`${section.kind}: a line of ${line.text.trim().length} characters is a paragraph`);
    }
  }
  problems.push(...rightsProblems(sheet.rights));
  const corpus = sheet.sections.flatMap((s) => s.lines.map((l) => l.text)).join(" ");
  for (const pattern of BORROWED) {
    if (pattern.test(corpus) && sheet.rights.basis !== "licensed") {
      problems.push(`rights: the lyric sheet mentions ${pattern.source.replace(/[\\/\\b]/g, "")} and the rights basis is ${sheet.rights.basis}`);
    }
  }
  return problems;
}

export function rightsProblems(rights: Rights): string[] {
  const problems: string[] = [];
  if (!rights?.writers?.length) problems.push("rights: a song with no writers declared is a song with no owner");
  if ((rights?.basis === "licensed" || rights?.basis === "cover") && !rights.reference?.trim()) {
    problems.push(`rights: basis is ${rights.basis} with no reference, and a licence without a reference is a hope`);
  }
  if (rights?.basis === "public_domain" && !rights.reference?.trim()) {
    problems.push("rights: public domain needs the work and the year it entered the public domain");
  }
  return problems;
}

// the shape a lyric sheet gets, so writing starts inside the song and not beside it
export function emptySheet(song: SongSpec, rights: Rights): LyricSheet {
  return {
    title: song.title,
    rights,
    sections: song.sections.map((section) => ({ kind: section.kind, lines: [{ text: "" }] })),
  };
}

// a rough syllable count by vowel groups. wrong often enough that it is only ever
// used as a hint for a line that will not sit on the bar.
export function syllableHint(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z\s']/g, "").split(/\s+/).filter(Boolean);
  return words.reduce((total, word) => {
    const groups = word.replace(/e\b/g, "").match(/[aeiouy]+/g);
    return total + Math.max(groups?.length ?? 1, 1);
  }, 0);
}
