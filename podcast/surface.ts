// the audio surface, wired to the head.
//
// the persona's register for audio is the reading voice: unhurried, one
// host, no radio voice. the brief is what a writer uses to draft segments,
// the voice style is what the tts receives once a provider exists, and the
// memory is how an episode can be remembered as made, not just published.
//
// produceEpisode runs the whole pipeline with the pieces that exist: plan
// checked, chapters computed, transcript and vtt generated, feed item
// assembled, and one tts call per segment against whatever adapter is
// registered (none, by default). the fake adapter makes it testable; its
// result says `real: false` so nothing here can pretend it rendered audio.

import { loadPersona } from "../persona/loader.ts";
import { defineSurface, type Surface } from "../core/surface.ts";
import type { PersonaManifest } from "../persona/schema.ts";
import { canPublishTo } from "../core/publishing.ts";
import {
  chaptersFor,
  checkEpisode,
  episodeSeconds,
  segmentSeconds,
  type Chapter,
  type EpisodePlan,
} from "./episode.ts";
import { transcriptText, transcriptVtt } from "./transcript.ts";
import { guidFor, type FeedItem } from "./feed.ts";
import { fakeTts, getTts, type TtsResult } from "./tts.ts";

export function audioSurface(persona: PersonaManifest): Surface {
  return defineSurface("audio", { persona, platform: "rss" });
}

export interface ProducedEpisode {
  plan: EpisodePlan;
  chapters: Chapter[];
  durationSec: number;
  transcript: string;
  vtt: string;
  renders: TtsResult[];
  feedItem: Omit<FeedItem, "audioUrl" | "lengthBytes" | "pubDate">;
  publishable: { ok: boolean; reason: string };
  warnings: string[];
}

export async function produceEpisode(
  persona: PersonaManifest,
  plan: EpisodePlan,
  opts: {
    ttsName?: string;
    workDir?: string;
    slug?: string;
    transcriptUrl?: string;
    audioUrl?: string;
  } = {},
): Promise<ProducedEpisode> {
  const check = checkEpisode(plan);
  if (!check.ok) {
    throw new Error(`episode: plan refused\n  ${check.errors.join("\n  ")}`);
  }
  const surface = audioSurface(persona);
  const chapters = chaptersFor(plan);
  const adapter = opts.ttsName ? getTts(opts.ttsName) : fakeTts();
  if (!adapter) throw new Error(`episode: no tts adapter named ${opts.ttsName}`);

  const workDir = opts.workDir ?? ".";
  const renders: TtsResult[] = [];
  for (const segment of plan.segments) {
    const text = segment.lines.join("\n");
    if (!text.trim()) continue;
    const outPath = `${workDir}/${(opts.slug ?? "episode")}-${segment.kind}-${renders.length}.mp3`;
    renders.push(await adapter.speak({ text, style: surface.voiceStyle(), outPath }));
  }

  const durationSec = episodeSeconds(plan);
  const decision = surface.publishing();
  const gate = canPublishTo(decision, { token: opts.audioUrl ?? null, approved: false });

  return {
    plan,
    chapters,
    durationSec,
    transcript: transcriptText(plan),
    vtt: transcriptVtt(plan),
    renders,
    feedItem: {
      title: plan.title,
      guid: guidFor({
        personaId: persona.memory.persona_id,
        season: plan.season,
        episode: plan.episode,
        slug: opts.slug ?? plan.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      }),
      durationSec,
      description: plan.promise,
      season: plan.season,
      episode: plan.episode,
      explicit: false,
      transcriptUrl: opts.transcriptUrl,
      chapters,
    },
    publishable: { ok: gate.ok, reason: gate.reason },
    warnings: check.warnings,
  };
}

// the per segment plan a mixer needs, in order, with the real durations a
// tts returned (or the planned ones from the fake).
export function segmentTimeline(
  plan: EpisodePlan,
  renders: TtsResult[],
): { title: string; kind: string; startSec: number; endSec: number; real: boolean }[] {
  const out: { title: string; kind: string; startSec: number; endSec: number; real: boolean }[] = [];
  let clock = 0;
  plan.segments.forEach((segment, index) => {
    if (!segment.lines.filter((l) => l.trim()).length) return;
    const render = renders[index];
    const seconds = render?.durationSec ?? segmentSeconds(segment);
    out.push({
      title: segment.title,
      kind: segment.kind,
      startSec: Number(clock.toFixed(2)),
      endSec: Number((clock + seconds).toFixed(2)),
      real: render?.real ?? false,
    });
    clock += seconds + 0.8;
  });
  return out;
}

export async function currentSurface(): Promise<Surface> {
  return audioSurface(await loadPersona());
}
