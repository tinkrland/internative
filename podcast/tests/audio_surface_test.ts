import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { audioSurface, produceEpisode, segmentTimeline } from "../surface.ts";
import { buildFeed, type FeedConfig } from "../feed.ts";
import { loadPersonaFile } from "../../persona/loader.ts";
import type { EpisodePlan } from "../episode.ts";

const EXAMPLE = new URL("../../personas/example.persona.jsonc", import.meta.url).pathname;
const persona = await loadPersonaFile(EXAMPLE);

function plan(): EpisodePlan {
  return {
    title: "the plate is the product",
    promise: "why a real render beats a generated background",
    targetSeconds: 400,
    season: 1,
    episode: 4,
    segments: [
      { kind: "cold_open", title: "cold open", lines: ["generated backgrounds drift, quietly"] },
      { kind: "intro", title: "intro", lines: ["this is the show about showing the work"] },
      { kind: "beat", title: "the argument", lines: ["a prompt cannot hold a room twice"] },
      { kind: "beat", title: "the proof", lines: ["the lens is pinned, the light is a recipe"] },
      { kind: "beat", title: "the cost", lines: ["it is slower, and that is the trade"] },
      { kind: "close", title: "close", lines: ["next week, the light"] },
    ],
  };
}

Deno.test("the surface reads the persona's podcast register", () => {
  const surface = audioSurface(persona);
  assertEquals(surface.name, "audio");
  assertEquals(surface.platform, "rss");
  assertStringIncludes(surface.brief(), "surface: audio (podcast)");
  assertStringIncludes(surface.brief(), "in your ear");
  assertEquals(surface.voiceStyle().emotion, "determination");
});

Deno.test("an episode produces chapters, a transcript, a vtt and a feed item", async () => {
  const produced = await produceEpisode(persona, plan(), { slug: "plate" });
  assertEquals(produced.chapters.length, 6);
  assertEquals(produced.chapters[0].startLabel, "0:00");
  assertStringIncludes(produced.transcript, "## the argument");
  assertEquals(produced.vtt.startsWith("WEBVTT"), true);
  assertEquals(produced.feedItem.guid, "clawbuzz:example:s1:e4:plate");
  assertEquals(produced.feedItem.episode, 4);
});

Deno.test("the fake tts never claims a real render", async () => {
  const produced = await produceEpisode(persona, plan(), { slug: "plate" });
  assertEquals(produced.renders.length, 6);
  for (const render of produced.renders) assertEquals(render.real, false);
  const timeline = segmentTimeline(plan(), produced.renders);
  assertEquals(timeline.length, 6);
  assertEquals(timeline.every((segment) => segment.real === false), true);
  for (let i = 1; i < timeline.length; i++) {
    assertEquals(timeline[i].startSec >= timeline[i - 1].endSec, true);
  }
});

Deno.test("publishing is blocked, and says why", async () => {
  const produced = await produceEpisode(persona, plan(), { slug: "plate" });
  assertEquals(produced.publishable.ok, false);
  assertStringIncludes(produced.publishable.reason, "publishing blocked");
});

Deno.test("a refused plan never reaches a render", async () => {
  const bad = plan();
  bad.segments = bad.segments.filter((s) => s.kind !== "close");
  let threw = false;
  try {
    await produceEpisode(persona, bad, {});
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("a produced episode assembles into a valid feed", async () => {
  const produced = await produceEpisode(persona, plan(), {
    slug: "plate",
    transcriptUrl: "https://example.com/plate.vtt",
  });
  const config: FeedConfig = {
    title: "the plate is the product",
    link: "https://example.com/show",
    description: "showing the work",
    language: "en",
    author: "Example",
    ownerName: "Example",
    ownerEmail: "owner@example.com",
    coverUrl: "https://example.com/cover.jpg",
    category: "Technology",
    selfUrl: "https://example.com/feed.xml",
  };
  const xml = buildFeed(config, [
    {
      ...produced.feedItem,
      pubDate: new Date("2026-11-05T12:00:00Z"),
      audioUrl: "https://example.com/plate.mp3",
      lengthBytes: 4242,
    },
  ]);
  assertEquals(xml.includes("<itunes:episode>4</itunes:episode>"), true);
  assertEquals(xml.includes('<psc:chapter start="0:00" title="cold open"/>'), true);
  assertEquals(xml.includes('podcast:transcript url="https://example.com/plate.vtt"'), true);
});
