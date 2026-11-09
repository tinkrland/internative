import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { buildFeed, durationLabel, escapeXml, guidFor, validateFeed, type FeedConfig, type FeedItem } from "../feed.ts";

const CONFIG: FeedConfig = {
  title: "the plate is the product",
  link: "https://example.com/show",
  description: "showing the work, one episode at a time",
  language: "en",
  author: "Example",
  ownerName: "Example",
  ownerEmail: "owner@example.com",
  coverUrl: "https://example.com/cover.jpg",
  category: "Technology",
  selfUrl: "https://example.com/feed.xml",
};

const ITEM: FeedItem = {
  title: "the plate is the product",
  guid: guidFor({ personaId: "example", season: 1, episode: 1, slug: "the-plate" }),
  pubDate: new Date("2026-11-05T12:00:00Z"),
  audioUrl: "https://example.com/ep1.mp3",
  lengthBytes: 12345678,
  durationSec: 3725,
  description: "a real render, not a generated background",
  season: 1,
  episode: 1,
  transcriptUrl: "https://example.com/ep1.vtt",
  chapters: [{ title: "cold open", startSec: 0, startLabel: "0:00" }],
};

// a balance check, so "well formed" is tested rather than assumed. no xml
// parser is added for this: the check catches the failure mode that
// matters here (an unclosed or mismatched tag) without a dependency.
function wellFormed(xml: string): boolean {
  const stack: string[] = [];
  const tag = /<(\/?)([a-zA-Z:][\w:.-]*)([^>]*?)(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(xml))) {
    const [, closing, name, , selfClose] = match;
    if (selfClose) continue;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else {
      stack.push(name);
    }
  }
  return stack.length === 0;
}

Deno.test("a feed for one episode is well formed and carries the directory fields", () => {
  const xml = buildFeed(CONFIG, [ITEM]);
  assertEquals(wellFormed(xml), true);
  assertEquals(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), true);
  for (
    const needle of [
      '<rss version="2.0"',
      "<itunes:author>",
      "<itunes:owner>",
      "<itunes:email>owner@example.com</itunes:email>",
      '<itunes:image href="https://example.com/cover.jpg"/>',
      '<itunes:category text="Technology"/>',
      '<atom:link href="https://example.com/feed.xml" rel="self"',
      '<guid isPermaLink="false">clawbuzz:example:s1:e1:the-plate</guid>',
      '<enclosure url="https://example.com/ep1.mp3" length="12345678" type="audio/mpeg"/>',
      "<itunes:duration>1:02:05</itunes:duration>",
      "<itunes:season>1</itunes:season>",
      "<itunes:episode>1</itunes:episode>",
      '<podcast:transcript url="https://example.com/ep1.vtt" type="text/vtt"/>',
      '<psc:chapter start="0:00" title="cold open"/>',
      "<pubDate>Thu, 05 Nov 2026 12:00:00 GMT</pubDate>",
    ]
  ) {
    assertEquals(xml.includes(needle), true, needle);
  }
});

Deno.test("a feed without an owner email is refused, because directories reject it", () => {
  assertThrows(() => buildFeed({ ...CONFIG, ownerEmail: "" }, [ITEM]), Error, "owner");
});

Deno.test("a feed without episodes is a stub, not a podcast", () => {
  assertThrows(() => buildFeed(CONFIG, []), Error, "items");
});

Deno.test("an enclosure without a byte length is refused", () => {
  assertThrows(() => buildFeed(CONFIG, [{ ...ITEM, lengthBytes: 0 }]), Error, "enclosure length");
});

Deno.test("duplicate guids are refused: a directory treats them as one episode", () => {
  assertThrows(() => buildFeed(CONFIG, [ITEM, ITEM]), Error, "duplicate guid");
});

Deno.test("a relative audio url is refused", () => {
  assertThrows(() => buildFeed(CONFIG, [{ ...ITEM, audioUrl: "/ep1.mp3" }]), Error, "absolute");
});

Deno.test("titles and descriptions are escaped, not trusted", () => {
  const xml = buildFeed({ ...CONFIG, title: `a & b <c> "d"` }, [ITEM]);
  assertEquals(xml.includes("a &amp; b &lt;c&gt; &quot;d&quot;"), true);
  assertEquals(escapeXml("&<>\"'"), "&amp;&lt;&gt;&quot;&apos;");
  assertEquals(wellFormed(xml), true);
});

Deno.test("durations read the way directories expect", () => {
  assertEquals(durationLabel(45), "0:45");
  assertEquals(durationLabel(605), "10:05");
  assertEquals(durationLabel(3725), "1:02:05");
});

Deno.test("a guid survives a title edit", () => {
  const before = guidFor({ personaId: "example", season: 1, episode: 3, slug: "the-plate" });
  const after = guidFor({ personaId: "example", season: 1, episode: 3, slug: "the-plate" });
  assertEquals(before, after);
  assertEquals(before.includes("e3"), true);
});

Deno.test("validateFeed reports every problem at once", () => {
  const errors = validateFeed({ ...CONFIG, coverUrl: "", category: "" }, []);
  assertEquals(errors.length >= 3, true);
});
