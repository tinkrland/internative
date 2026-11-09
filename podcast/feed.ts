// the feed: an rss 2.0 document with the itunes namespace, and the fields a
// directory actually rejects an episode for.
//
// a podcast is not published by uploading a file, it is published by a feed
// that a directory reads. so the feed is not a report on the work, it is the
// artifact: required channel fields, one item per episode, an enclosure with
// a byte length and a duration, and a guid that never changes for the same
// episode even if the title is edited later.
//
// no hosting is assumed here. the audio url and the cover url are inputs,
// because where a file lives is a deployment decision, not a surface one.

import type { Chapter } from "./episode.ts";

export interface FeedConfig {
  title: string;
  link: string;
  description: string;
  language: string;
  author: string;
  ownerName: string;
  ownerEmail: string;
  coverUrl: string;
  category: string;
  // where the feed itself lives, for atom:link self
  selfUrl: string;
  explicit?: boolean;
}

export interface FeedItem {
  title: string;
  // stable, opaque, and never derived from the title
  guid: string;
  pubDate: Date;
  audioUrl: string;
  lengthBytes: number;
  durationSec: number;
  description: string;
  season?: number;
  episode?: number;
  explicit?: boolean;
  transcriptUrl?: string;
  chapters?: Chapter[];
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch]);
}

export function durationLabel(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function validateFeed(config: FeedConfig, items: FeedItem[]): string[] {
  const errors: string[] = [];
  if (!config.title.trim()) errors.push("channel: title required");
  if (!config.link.trim()) errors.push("channel: link required");
  if (!config.description.trim()) errors.push("channel: description required");
  if (!config.ownerEmail.trim()) errors.push("itunes:owner: email required, directories reject a feed without one");
  if (!config.coverUrl.trim()) errors.push("itunes:image: cover required");
  if (!config.category.trim()) errors.push("itunes:category: required");
  if (!config.selfUrl.trim()) errors.push("atom:link self: required so a directory can see the feed url");
  if (!items.length) errors.push("items: a feed with no episodes is a stub, not a podcast");
  const guids = new Set<string>();
  for (const item of items) {
    if (!item.title.trim()) errors.push("item: title required");
    if (!item.guid.trim()) errors.push(`item "${item.title}": guid required`);
    else if (guids.has(item.guid)) errors.push(`item "${item.title}": duplicate guid`);
    guids.add(item.guid);
    if (!Number.isFinite(item.lengthBytes) || item.lengthBytes <= 0) {
      errors.push(`item "${item.title}": enclosure length must be a positive byte count`);
    }
    if (!Number.isFinite(item.durationSec) || item.durationSec <= 0) {
      errors.push(`item "${item.title}": duration must be positive`);
    }
    if (!/^https?:\/\//i.test(item.audioUrl)) errors.push(`item "${item.title}": audio url must be absolute`);
  }
  return errors;
}

export function buildFeed(config: FeedConfig, items: FeedItem[]): string {
  const errors = validateFeed(config, items);
  if (errors.length) throw new Error(`feed: refusing to emit\n  ${errors.join("\n  ")}`);

  const channel = [
    `    <title>${escapeXml(config.title)}</title>`,
    `    <link>${escapeXml(config.link)}</link>`,
    `    <description>${escapeXml(config.description)}</description>`,
    `    <language>${escapeXml(config.language)}</language>`,
    `    <itunes:author>${escapeXml(config.author)}</itunes:author>`,
    `    <itunes:summary>${escapeXml(config.description)}</itunes:summary>`,
    `    <itunes:explicit>${config.explicit ? "true" : "false"}</itunes:explicit>`,
    `    <itunes:image href="${escapeXml(config.coverUrl)}"/>`,
    `    <itunes:category text="${escapeXml(config.category)}"/>`,
    `    <itunes:owner>`,
    `      <itunes:name>${escapeXml(config.ownerName)}</itunes:name>`,
    `      <itunes:email>${escapeXml(config.ownerEmail)}</itunes:email>`,
    `    </itunes:owner>`,
    `    <atom:link href="${escapeXml(config.selfUrl)}" rel="self" type="application/rss+xml"/>`,
  ];

  const entries = items.map((item) => {
    const lines = [
      `    <item>`,
      `      <title>${escapeXml(item.title)}</title>`,
      `      <description>${escapeXml(item.description)}</description>`,
      `      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>`,
      `      <pubDate>${item.pubDate.toUTCString()}</pubDate>`,
      `      <enclosure url="${escapeXml(item.audioUrl)}" length="${Math.round(item.lengthBytes)}" type="audio/mpeg"/>`,
      `      <itunes:duration>${durationLabel(item.durationSec)}</itunes:duration>`,
      `      <itunes:explicit>${item.explicit ? "true" : "false"}</itunes:explicit>`,
    ];
    if (item.season !== undefined) lines.push(`      <itunes:season>${item.season}</itunes:season>`);
    if (item.episode !== undefined) lines.push(`      <itunes:episode>${item.episode}</itunes:episode>`);
    if (item.transcriptUrl) {
      lines.push(`      <podcast:transcript url="${escapeXml(item.transcriptUrl)}" type="text/vtt"/>`);
    }
    for (const chapter of item.chapters ?? []) {
      lines.push(
        `      <psc:chapter start="${escapeXml(chapter.startLabel)}" title="${escapeXml(chapter.title)}"/>`,
      );
    }
    lines.push(`    </item>`);
    return lines.join("\n");
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:psc="http://podlove.org/simple-chapters">`,
    `  <channel>`,
    ...channel,
    ...entries,
    `  </channel>`,
    `</rss>`,
    ``,
  ].join("\n");
}

// a stable guid from what an episode IS, not from what it is called. the
// persona, the season and the episode number survive a title edit, which is
// the whole point of a guid.
export function guidFor(parts: { personaId: string; season?: number; episode?: number; slug: string }): string {
  return [
    "clawbuzz",
    parts.personaId,
    `s${parts.season ?? 1}`,
    `e${parts.episode ?? 1}`,
    parts.slug,
  ].join(":");
}
