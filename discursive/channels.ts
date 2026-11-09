// six networks, one personality.
//
// a written surface is not one surface. x rewards a claim with room to
// argue, linkedin rewards what something cost and what it taught, discord
// is a room you are a member of rather than a broadcast, and instagram's
// caption is read after the frame has already said something. the
// differences are manners, and manners live in the persona's register
// overrides. what lives here is the machinery: the ceilings, the counting
// rule, and how much confidence to place in each number.
//
// counting is per grapheme, not per byte and not per code unit. an emoji
// with a zero width joiner is one character to a reader and several to a
// naive .length, and getting that wrong is how a post gets refused at the
// last step.

export type TextChannel =
  | "x"
  | "bluesky"
  | "threads"
  | "instagram"
  | "linkedin"
  | "discord";

export interface ChannelSpec {
  channel: TextChannel;
  // the platform class the head already knows (core/connections.ts)
  platform: string;
  // ceiling per post, in graphemes
  maxGraphemes: number;
  // does the network carry multi part posts natively, and how many parts
  // will this surface ever produce
  threads: { supported: boolean; maxParts: number };
  // whether links in the body are clickable (instagram's are not)
  linksInBody: boolean;
  // images per post, for the surfaces that attach a still
  maxAttachments: number;
  // what a human must confirm before publishing is enabled here
  verified: boolean;
  confirm?: string;
  notes: string;
}

export const CHANNELS: Record<TextChannel, ChannelSpec> = {
  x: {
    channel: "x",
    platform: "x",
    maxGraphemes: 280,
    threads: { supported: true, maxParts: 12 },
    linksInBody: true,
    maxAttachments: 4,
    verified: true,
    notes: "threads are reply chains: each part must stand alone and the last one must land",
  },
  bluesky: {
    channel: "bluesky",
    platform: "bluesky",
    maxGraphemes: 300,
    threads: { supported: true, maxParts: 12 },
    linksInBody: true,
    maxAttachments: 4,
    verified: true,
    notes: "300 graphemes per post, and links and mentions are byte indexed facets, so offsets are computed on utf8 bytes while the limit is on graphemes",
  },
  threads: {
    channel: "threads",
    platform: "threads",
    maxGraphemes: 500,
    threads: { supported: true, maxParts: 10 },
    linksInBody: true,
    maxAttachments: 10,
    verified: false,
    confirm: "confirm the current per post ceiling in the app before enabling publishing",
    notes: "conversational: replies are the point, a monologue underperforms",
  },
  instagram: {
    channel: "instagram",
    platform: "instagram",
    maxGraphemes: 2200,
    threads: { supported: false, maxParts: 1 },
    linksInBody: false,
    maxAttachments: 20,
    verified: true,
    notes: "no clickable links in the caption: the link goes in the bio or the first comment",
  },
  linkedin: {
    channel: "linkedin",
    platform: "linkedin",
    maxGraphemes: 3000,
    threads: { supported: false, maxParts: 1 },
    linksInBody: true,
    maxAttachments: 20,
    verified: false,
    confirm: "the post ceiling is reported by third parties, not published: confirm before enabling publishing",
    notes: "the first two lines are all that shows before the more fold",
  },
  discord: {
    channel: "discord",
    platform: "discord",
    maxGraphemes: 2000,
    threads: { supported: false, maxParts: 4 },
    linksInBody: true,
    maxAttachments: 10,
    verified: true,
    notes: "2000 per message; long text is split across messages, never inside a code block",
  },
};

export function channelSpec(channel: string): ChannelSpec {
  const key = channel.trim().toLowerCase() as TextChannel;
  const spec = CHANNELS[key];
  if (!spec) {
    throw new Error(`unknown text channel: ${channel} (known: ${Object.keys(CHANNELS).join(", ")})`);
  }
  return spec;
}

// graphemes, the way a reader counts.
const SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" });

export function graphemes(text: string): string[] {
  return Array.from(SEGMENTER.segment(text), (s) => s.segment);
}

export function graphemeLength(text: string): number {
  return graphemes(text).length;
}

// the fold: linkedin shows only the opening, and a post whose first two
// lines are setup has already lost. used by the composer to warn, not to
// rewrite.
export function foldPreview(text: string, lines = 2): string {
  return text.split("\n").slice(0, lines).join("\n");
}
