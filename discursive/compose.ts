// the composer: written presence that sounds like the persona and fits the
// network.
//
// it does not write the idea. an idea comes in as text from whatever the
// persona uses to think, and this module does the parts that a language
// model is bad at and a machine is good at: grapheme safe lengths,
// splitting only where a sentence actually ends, and enforcing the
// register's policies on hashtags and emoji instead of trusting a prompt
// to remember them.
//
// the rule about threads is a rule, not a preference: a thread is offered
// only when the idea genuinely does not fit in one post. padding a short
// idea into four parts is engagement bait with extra steps.

import type { ResolvedRegister } from "../persona/registers.ts";
import { channelSpec, type ChannelSpec, type TextChannel, graphemeLength, graphemes } from "./channels.ts";

const EMOJI = /\p{Extended_Pictographic}/gu;
const SENTENCE_END = /(?<=[.!?…])\s+/u;

export function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(SENTENCE_END)
    .map((s) => s.trim())
    .filter(Boolean);
}

// split a single too long sentence at word boundaries. only reached when
// one sentence is longer than the whole network ceiling, which is a
// writing problem the composer must survive rather than crash on.
export function splitAtWords(text: string, max: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (graphemeLength(next) <= max) {
      current = next;
      continue;
    }
    if (current) out.push(current);
    current = word;
  }
  if (current) out.push(current);
  return out;
}

// group sentences into parts that each fit, without breaking a sentence
// unless a single sentence is over the ceiling on its own.
export function packParts(sentences: string[], max: number): string[] {
  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const pieces = graphemeLength(sentence) > max ? splitAtWords(sentence, max) : [sentence];
    for (const piece of pieces) {
      const next = current ? `${current} ${piece}` : piece;
      if (graphemeLength(next) <= max) {
        current = next;
        continue;
      }
      if (current) parts.push(current);
      current = piece;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export interface ComposeRequest {
  text: string;
  channel: TextChannel;
  register: ResolvedRegister;
  tags?: string[];
}

export interface Composed {
  channel: TextChannel;
  // one part is a post, more than one is a thread. the caller does not
  // decide which: the length does.
  parts: string[];
  isThread: boolean;
  graphemes: number[];
  // everything the register made the composer drop, named so a receipt
  // can say what was changed
  dropped: { emoji: number; hashtags: string[] };
  warnings: string[];
}

export function composePost(req: ComposeRequest): Composed {
  const spec: ChannelSpec = channelSpec(req.channel);
  const warnings: string[] = [];
  let text = req.text.trim();
  if (!text) throw new Error("compose: empty text");

  // emoji policy
  let droppedEmoji = 0;
  if (req.register.emoji === "none") {
    const found = text.match(EMOJI);
    droppedEmoji = found ? found.length : 0;
    if (droppedEmoji > 0) {
      text = text.replace(EMOJI, "").replace(/[ \t]{2,}/g, " ").replace(/\s+\n/g, "\n").trim();
      warnings.push(`emoji: ${droppedEmoji} removed, this register has emoji policy "none"`);
    }
  }

  // inline hashtags go when the policy is none; a sparing policy keeps
  // three at the end rather than sprinkled through the sentence
  const inlineTags = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  text = text.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/[ \t]{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();

  const offered = [...inlineTags, ...(req.tags ?? []).map((t) => (t.startsWith("#") ? t : `#${t}`))];
  const unique = Array.from(new Set(offered));
  const droppedHashtags: string[] = [];
  let kept: string[] = [];
  if (req.register.hashtags === "none") {
    droppedHashtags.push(...unique);
  } else if (req.register.hashtags === "sparing") {
    kept = unique.slice(0, 3);
    droppedHashtags.push(...unique.slice(3));
  } else {
    kept = unique;
  }
  if (kept.length) {
    const tail = kept.join(" ");
    if (graphemeLength(`${text}\n\n${tail}`) <= spec.maxGraphemes) text = `${text}\n\n${tail}`;
    else {
      droppedHashtags.push(...kept);
      kept = [];
      warnings.push("hashtags: dropped, they did not fit under the ceiling");
    }
  }

  if (!spec.linksInBody && /https?:\/\//i.test(text)) {
    warnings.push("links: this network does not make body links clickable, the link belongs in the bio or first comment");
  }

  const sentences = splitSentences(text);
  if (req.register.max_sentences && sentences.length > req.register.max_sentences) {
    warnings.push(
      `length: ${sentences.length} sentences against a register that asks for ${req.register.max_sentences}`,
    );
  }

  const parts = packParts(sentences, spec.maxGraphemes);
  const isThread = parts.length > 1;
  if (isThread && !spec.threads.supported) {
    throw new Error(`compose: ${spec.channel} does not carry threads, and this text needs ${parts.length} parts`);
  }
  if (parts.length > spec.threads.maxParts) {
    throw new Error(`compose: ${parts.length} parts exceeds the ${spec.threads.maxParts} part limit on ${spec.channel}`);
  }
  if (isThread) {
    const last = parts[parts.length - 1];
    if (graphemeLength(last) < 12) {
      warnings.push("thread: the last part is very short, the thread may not land");
    }
  }

  return {
    channel: spec.channel,
    parts,
    isThread,
    graphemes: parts.map(graphemeLength),
    dropped: { emoji: droppedEmoji, hashtags: droppedHashtags },
    warnings,
  };
}

// the single post rule: if it fits, it is not a thread. exposed separately
// because a caller sometimes wants to ask the question without composing.
export function fitsInOnePost(text: string, channel: TextChannel): boolean {
  return graphemeLength(text.trim()) <= channelSpec(channel).maxGraphemes;
}

// alt text for an attached still. the persona describes what is in the
// frame, never what it hopes the frame conveys.
export function altTextFor(description: string, maxGraphemes = 420): string {
  const trimmed = description.trim();
  if (!trimmed) throw new Error("alt: a description is required for an image");
  if (graphemeLength(trimmed) <= maxGraphemes) return trimmed;
  const cut = graphemes(trimmed).slice(0, maxGraphemes).join("");
  return `${cut.replace(/\s+\S*$/, "")}…`;
}
