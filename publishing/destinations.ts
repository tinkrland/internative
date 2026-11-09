// where a post can go, and what each place actually requires.
//
// this is the part everyone gets wrong by guessing: a destination is not a text
// box. each one has its own length unit, its own media rules, its own disclosure
// flag, and its own answer to "is there even an api for this". the table below is
// data, so a wrong number is a one line fix rather than a scattered assumption.

export type Destination =
  | "x"
  | "bluesky"
  | "threads"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "mastodon"
  | "discord"
  | "pinterest"
  | "rss"
  | "spotify";

export type MediaKind = "image" | "carousel" | "video" | "audio";

// how the post physically leaves this machine
export type Route = "api" | "self-hosted" | "no-api";

export interface DestinationSpec {
  destination: Destination;
  route: Route;
  // the tool that does the posting. a self-hosted scheduler earns its place only
  // here, and only when it is the honest answer for more than one destination.
  tool: string;
  tool_licence: string;
  // counted in graphemes, because a limit in code units fails on the first emoji
  text_chars: number;
  media: MediaKind[];
  carousel_max?: number;
  alt_text_required: boolean;
  // the platform's own "is this generated" switch. a plan that cannot set it does
  // not ship to that platform.
  ai_label: "required" | "available" | "none";
  // a conservative default, kept well inside the published limit. a rate limit is
  // a fuse, not a target.
  daily_cap: number;
  note: string;
}

export const DESTINATIONS: Record<Destination, DestinationSpec> = {
  x: {
    destination: "x",
    route: "api",
    tool: "x api v2",
    tool_licence: "platform terms, paid tiers",
    text_chars: 280,
    media: ["image", "carousel", "video"],
    carousel_max: 4,
    alt_text_required: false,
    ai_label: "none",
    daily_cap: 12,
    note: "the api is metered and the tiers move. treat posting here as a cost decision, not a default",
  },
  bluesky: {
    destination: "bluesky",
    route: "api",
    tool: "atproto (com.atproto.repo.createRecord, app.bsky.feed.post)",
    tool_licence: "MIT",
    text_chars: 300,
    media: ["image", "carousel", "video"],
    carousel_max: 4,
    alt_text_required: true,
    ai_label: "available",
    daily_cap: 24,
    note: "the cheapest real api in the set: an app password and a repo write, no review queue, and alt text is part of the blob record rather than an afterthought",
  },
  threads: {
    destination: "threads",
    route: "api",
    tool: "threads api (meta)",
    tool_licence: "platform terms",
    text_chars: 500,
    media: ["image", "carousel", "video"],
    carousel_max: 20,
    alt_text_required: true,
    ai_label: "available",
    daily_cap: 20,
    note: "media is a container that is created then published, and the published cap is 250 posts per profile per 24 hours",
  },
  instagram: {
    destination: "instagram",
    route: "api",
    tool: "instagram graph api",
    tool_licence: "platform terms",
    text_chars: 2200,
    media: ["image", "carousel", "video"],
    carousel_max: 10,
    alt_text_required: true,
    ai_label: "required",
    daily_cap: 10,
    note: "needs a business or creator account and an approved app, and the container step means a video is not posted until meta has finished ingesting it",
  },
  tiktok: {
    destination: "tiktok",
    route: "api",
    tool: "tiktok content posting api",
    tool_licence: "platform terms",
    text_chars: 2200,
    media: ["video", "carousel"],
    carousel_max: 35,
    alt_text_required: false,
    ai_label: "required",
    daily_cap: 8,
    note: "an unaudited client can only post privately, so a first real post here is a review milestone and not a config change",
  },
  youtube: {
    destination: "youtube",
    route: "api",
    tool: "youtube data api v3",
    tool_licence: "platform terms",
    text_chars: 5000,
    media: ["video"],
    alt_text_required: false,
    ai_label: "required",
    daily_cap: 6,
    note: "the quota is the limit that matters: an upload costs about 1600 of the 10000 daily units, so six uploads is the whole day",
  },
  linkedin: {
    destination: "linkedin",
    route: "api",
    tool: "linkedin rest posts api",
    tool_licence: "platform terms",
    text_chars: 3000,
    media: ["image", "video"],
    alt_text_required: false,
    ai_label: "none",
    daily_cap: 4,
    note: "a person posts as themselves and an organisation needs an admin grant. the persona is a person, so this is her own account",
  },
  mastodon: {
    destination: "mastodon",
    route: "api",
    tool: "mastodon rest api v1 statuses",
    tool_licence: "AGPL-3.0 (server), plain https client",
    text_chars: 500,
    media: ["image", "carousel", "video", "audio"],
    carousel_max: 4,
    alt_text_required: true,
    ai_label: "available",
    daily_cap: 30,
    note: "one app registration per instance, and the limits are per instance rather than per network. a scheduler that hardcodes mastodon.social will fail on the instance someone actually uses",
  },
  discord: {
    destination: "discord",
    route: "api",
    tool: "discord webhook",
    tool_licence: "platform terms",
    text_chars: 2000,
    media: ["image", "video"],
    alt_text_required: false,
    ai_label: "none",
    daily_cap: 10,
    note: "a webhook is the whole integration, and the rate limit is per webhook rather than per account",
  },
  pinterest: {
    destination: "pinterest",
    route: "api",
    tool: "pinterest api v5 pins",
    tool_licence: "platform terms",
    text_chars: 500,
    media: ["image", "video"],
    alt_text_required: false,
    ai_label: "none",
    daily_cap: 10,
    note: "a pin is a link with a picture, so a persona with no destination page has nothing to pin",
  },
  rss: {
    destination: "rss",
    route: "self-hosted",
    tool: "the feed the audio and music branches already build",
    tool_licence: "own code",
    text_chars: 4000,
    media: ["audio", "video"],
    alt_text_required: false,
    ai_label: "none",
    daily_cap: 24,
    note: "no review queue and no rate limit: the one destination a persona fully owns, which is why the feed is an episode's real home",
  },
  spotify: {
    destination: "spotify",
    route: "no-api",
    tool: "a distributor",
    tool_licence: "n/a",
    text_chars: 0,
    media: ["audio"],
    alt_text_required: false,
    ai_label: "none",
    daily_cap: 0,
    note: "there is no public upload endpoint. a track reaches spotify through a distributor, and pretending otherwise is how a release pipeline ends up doing nothing on release day",
  },
};

export const DESTINATION_NAMES = Object.keys(DESTINATIONS) as Destination[];

export function destinationProblems(destination: Destination): string[] {
  const spec = DESTINATIONS[destination];
  if (!spec) return [`"${destination}" is not a destination this head knows`];
  const problems: string[] = [];
  if (spec.route === "no-api") problems.push(`${destination}: ${spec.note}`);
  if (spec.route === "api" && !spec.tool) problems.push(`${destination}: an api destination names the api it uses`);
  if (spec.text_chars === 0 && spec.route !== "no-api") problems.push(`${destination}: a destination with no text is not a destination`);
  if (spec.daily_cap === 0 && spec.route !== "no-api") problems.push(`${destination}: no daily cap is an invitation to spam`);
  return problems;
}

// graphemes, not code units: a family emoji is one character to a reader and
// seven to a length check that counts wrong
export function graphemes(text: string): number {
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  return [...segmenter.segment(text)].length;
}
