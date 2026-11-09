// captions and on frame text, in the persona's own voice.
//
// two different things share this module because they must not disagree:
// the description a network shows under the clip, and the text burned into
// the frame. both come from the plan and the persona's register, so a clip
// whose caption is dry and whose on frame text is shouty is a bug, not a
// style choice.
//
// the register's policies are enforced here rather than left to the writer:
// no hashtags when the policy is none, no more than three when it is
// sparing, the platform ceiling always wins over the persona's preference.

import type { ResolvedRegister } from "../persona/registers.ts";
import type { ClipSpec } from "./clip_specs.ts";
import type { ClipPlan } from "./clip.ts";

export interface Caption {
  text: string;
  chars: number;
  truncated: boolean;
  hashtags: string[];
  droppedHashtags: string[];
  withinCeiling: boolean;
}

// split at sentence boundaries where possible, at word boundaries always,
// never mid word. used for both the description and the burned captions.
export function chunkText(text: string, maxChars: number): string[] {
  if (maxChars <= 0) throw new Error("caption: maxChars must be positive");
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    current = word;
  }
  if (current) chunks.push(current);
  return chunks;
}

function limitFor(register: ResolvedRegister, spec: ClipSpec): number {
  const personaLimit = register.max_chars ?? spec.captionMaxChars;
  return Math.min(personaLimit, spec.captionMaxChars);
}

// the description under the clip. the hook leads because that is what a
// reader sees before the "more", and the payoff follows because it is the
// reason to tap it.
export function captionFor(
  plan: ClipPlan,
  register: ResolvedRegister,
  spec: ClipSpec,
  opts: { tags?: string[]; includeSource?: boolean } = {},
): Caption {
  const limit = limitFor(register, spec);
  const body = [plan.hook.trim(), plan.payoff.trim()].filter(Boolean).join("\n\n");
  const source = opts.includeSource && plan.source?.uri ? `\nsource: ${plan.source.uri}` : "";

  const offered = (opts.tags ?? []).map((t) => (t.startsWith("#") ? t : `#${t}`));
  let hashtags: string[] = [];
  let droppedHashtags: string[] = [];
  if (register.hashtags === "none") {
    droppedHashtags = offered;
  } else if (register.hashtags === "sparing") {
    hashtags = offered.slice(0, 3);
    droppedHashtags = offered.slice(3);
  } else {
    hashtags = offered;
  }

  const tail = hashtags.length ? `\n\n${hashtags.join(" ")}` : "";
  const full = `${body}${source}${tail}`;
  if (full.length <= limit) {
    return {
      text: full,
      chars: full.length,
      truncated: false,
      hashtags,
      droppedHashtags,
      withinCeiling: true,
    };
  }

  // over the ceiling: cut the body at a sentence, then a word, and keep
  // the tags only if they still fit.
  const reserve = tail.length + 1;
  const room = Math.max(1, limit - reserve);
  const pieces = chunkText(body, room);
  const kept = pieces[0];
  const rebuilt = `${kept}${source}${tail}`;
  if (rebuilt.length <= limit) {
    return {
      text: rebuilt,
      chars: rebuilt.length,
      truncated: true,
      hashtags,
      droppedHashtags,
      withinCeiling: true,
    };
  }
  const withoutTags = `${kept}${source}`.slice(0, limit);
  return {
    text: withoutTags,
    chars: withoutTags.length,
    truncated: true,
    hashtags: [],
    droppedHashtags: [...droppedHashtags, ...hashtags],
    withinCeiling: true,
  };
}

// on frame captions: short chunks, timed against the spoken lines. a
// vertical frame cannot hold a sentence, so the ceiling is set by what a
// viewer can read in about a second, not by the network.

export interface CaptionCue {
  text: string;
  startSec: number;
  endSec: number;
}

export const ON_FRAME_MAX_CHARS = 42;

export function onFrameCues(
  plan: ClipPlan,
  opts: { maxChars?: number; wordsPerSecond: number; linePauseSec: number },
): CaptionCue[] {
  const maxChars = opts.maxChars ?? ON_FRAME_MAX_CHARS;
  const lines = [plan.hook, ...plan.beats, plan.payoff, ...(plan.close ? [plan.close] : [])]
    .map((l) => l.trim())
    .filter(Boolean);
  const cues: CaptionCue[] = [];
  let clock = 0;
  lines.forEach((line, lineIndex) => {
    const chunks = chunkText(line, maxChars);
    const lineStart = clock;
    const totalWords = line.split(/\s+/).filter(Boolean).length;
    const lineSeconds = totalWords / opts.wordsPerSecond;
    let consumed = 0;
    chunks.forEach((chunk, chunkIndex) => {
      const words = chunk.split(/\s+/).filter(Boolean).length;
      const share = totalWords ? words / totalWords : 1 / chunks.length;
      const start = lineStart + lineSeconds * consumed;
      const end = lineIndex === lines.length - 1 && chunkIndex === chunks.length - 1
        ? lineStart + lineSeconds
        : start + lineSeconds * share;
      cues.push({
        text: chunk,
        startSec: Number(start.toFixed(2)),
        endSec: Number(end.toFixed(2)),
      });
      consumed += share;
    });
    clock = lineStart + lineSeconds + (lineIndex < lines.length - 1 ? opts.linePauseSec : 0);
  });
  return cues;
}
