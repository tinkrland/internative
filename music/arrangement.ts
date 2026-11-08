// the arrangement brief: what plays when, and how loud it is allowed to get.

import { barCount, estimatedSeconds, type SongSpec } from "./song.ts";

export interface ArrangementLine {
  section: string;
  bars: number;
  instruments: string[];
  dynamic: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

export interface Arrangement {
  key: string;
  bpm: number;
  lines: ArrangementLine[];
  // the arc is the thing a listener remembers, not the chord chart
  arc: string;
}

// the default kit. an arrangement that adds an instrument says why.
export const BASE_KIT = ["lead vocal", "kick", "snare", "bass", "electric guitar"];

export function arrangementFor(song: SongSpec, overrides: Record<string, string[]> = {}): Arrangement {
  const total = barCount(song);
  const lines: ArrangementLine[] = song.sections.map((section, index) => {
    const position = index / Math.max(song.sections.length - 1, 1);
    const dynamic = (index === 0 ? 2 : index === song.sections.length - 1 ? 2 : position < 0.5 ? 3 : 4) as 1 | 2 | 3 | 4 | 5;
    const instruments = overrides[`${section.kind}-${index}`] ?? overrides[section.kind] ?? BASE_KIT;
    return {
      section: `${section.kind} ${index + 1}`,
      bars: section.bars,
      instruments,
      dynamic,
      note: section.kind === "chorus" ? "everything the listener can sing, nothing they have to concentrate on" : undefined,
    };
  });
  return {
    key: song.key,
    bpm: song.bpm,
    lines,
    arc: `${total} bars, ${estimatedSeconds(song)} seconds: open lighter than the chorus, keep the last chorus the loudest thing in the song`,
  };
}

export function arrangementProblems(arrangement: Arrangement): string[] {
  const problems: string[] = [];
  if (!arrangement.lines?.length) problems.push("lines: an arrangement with no sections is a click track");
  for (const line of arrangement.lines ?? []) {
    if (!line.instruments?.length) problems.push(`${line.section}: no instruments, so nothing is playing`);
    if (line.instruments?.includes("lead vocal") && line.dynamic === 1) {
      problems.push(`${line.section}: a lead vocal at dynamic 1 is a vocal nobody can hear`);
    }
  }
  const loudest = Math.max(...(arrangement.lines ?? []).map((l) => l.dynamic), 0);
  if (loudest < 4) problems.push("arc: nothing gets above dynamic 3, so the song never arrives");
  if (!arrangement.arc?.trim()) problems.push("arc: say what the shape is");
  return problems;
}

export function arrangementBrief(song: SongSpec, arrangement: Arrangement): string {
  const lines = arrangement.lines.map(
    (l) => `${l.section}: ${l.bars} bars, ${l.instruments.join(", ")}, dynamic ${l.dynamic}/5${l.note ? ` (${l.note})` : ""}`,
  );
  return [
    `${song.title} in ${arrangement.key}, ${arrangement.bpm} bpm.`,
    arrangement.arc + ".",
    ...lines,
  ].join("\n");
}
