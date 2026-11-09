// the transcript is part of the episode, not an extra.
//
// two outputs, because two audiences: plain text with timestamps for a
// person scanning what was said, and WebVTT for a player that needs cues.
// both are generated from the same timed lines, so they cannot disagree.
//
// timing comes from the plan (words at the persona's pace), which means a
// transcript can exist before the audio does. when a real render is added,
// its durations replace these, and every timestamp below is recomputed from
// the same function.

import { SEGMENT_PAUSE_SEC, spokenSeconds, timestamp, type EpisodePlan } from "./episode.ts";

export interface TimedLine {
  startSec: number;
  endSec: number;
  text: string;
  segment: string;
}

export function timedLines(plan: EpisodePlan): TimedLine[] {
  const out: TimedLine[] = [];
  let clock = 0;
  plan.segments.forEach((segment, index) => {
    for (const line of segment.lines.map((l) => l.trim()).filter(Boolean)) {
      const duration = spokenSeconds(line);
      out.push({
        startSec: Number(clock.toFixed(2)),
        endSec: Number((clock + duration).toFixed(2)),
        text: line,
        segment: segment.title,
      });
      clock += duration;
    }
    if (index < plan.segments.length - 1) clock += SEGMENT_PAUSE_SEC;
  });
  return out;
}

export function transcriptText(plan: EpisodePlan): string {
  const lines: string[] = [`${plan.title}`, "", plan.promise, ""];
  let lastSegment = "";
  for (const line of timedLines(plan)) {
    if (line.segment !== lastSegment) {
      lines.push(`## ${line.segment}`, "");
      lastSegment = line.segment;
    }
    lines.push(`[${timestamp(line.startSec)}] ${line.text}`, "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

function vttStamp(seconds: number): string {
  const ms = Math.round((seconds % 1) * 1000);
  const total = Math.floor(seconds);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}.${String(ms).padStart(3, "0")}`;
}

export function transcriptVtt(plan: EpisodePlan, opts: { maxCueSeconds?: number } = {}): string {
  const maxCue = opts.maxCueSeconds ?? 8;
  const cues = timedLines(plan).map((line) => ({
    start: vttStamp(line.startSec),
    // a long line is given a ceiling so one cue cannot claim the whole
    // episode in a player's timeline
    end: vttStamp(Math.min(line.endSec, line.startSec + maxCue)),
    text: line.text,
  }));
  const body = cues.map((cue, i) => `${i + 1}\n${cue.start} --> ${cue.end}\n${cue.text}`).join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}
