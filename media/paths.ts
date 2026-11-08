// how each surface gets its pictures, and why the two paths never mix.
//
// this used to be one pipeline: a rendered plate of a room, with the subject
// composited in, used for everything. it outgrew itself. proskena still renders,
// and rendered is the right answer for a photoshoot, where the point is that the
// same room is exactly the same room on tuesday. diffusion generates, and
// generated is the right answer for volume stills and carousels, where the point
// is forty variations before lunch.
//
// a plate is deterministic and authored. a generated image is a sample. the
// failure this module exists to prevent is one series that contains both, because
// that is how a personality ends up with three faces and no way to say which is
// hers.

import { SURFACES, type SurfaceName } from "../persona/schema.ts";
import { consistencyDrift, type ConsistencyBlocks } from "../persona/consistency.ts";

export type MediaPath = "rendered" | "generated" | "captured" | "none";

// proskena renders but does not speak: it owns assets, not a register, so it has
// a media path and is deliberately absent from SURFACES.
export type MediaSurface = SurfaceName | "proskena";

export interface SurfaceMedia {
  path: MediaPath;
  owns: string;
  why: string;
}

export const SURFACE_MEDIA: Record<MediaSurface, SurfaceMedia> = {
  proskena: {
    path: "rendered",
    owns: "photoshoots: hero, portrait, detail, environment, one authored plate per shot",
    why: "a photoshoot needs the same room twice, and a sample cannot promise that",
  },
  music: {
    path: "none",
    owns: "songs: one arrangement brief, a master, a stem set, and a cover handoff",
    why: "a song is heard, and the cover is static's job, not the mix's",
  },
  static: {
    path: "generated",
    owns: "stills and carousels through the diffusion seam",
    why: "volume wants samples, and the four consistency blocks are what hold them together",
  },
  shortform: {
    path: "rendered",
    owns: "clips, cut from a rendered plate and the subject's framing",
    why: "a 9:16 cut is a crop of a decision, not a new sample",
  },
  longform: {
    path: "rendered",
    owns: "episodes written as video: chapters, frames, thumbnails",
    why: "an episode keeps one look for forty minutes, which is a render's job",
  },
  streaming: {
    path: "rendered",
    owns: "the live frame: composed plate, face bridge, overlay",
    why: "a stream cannot re-roll the face between minutes",
  },
  meetings: {
    path: "captured",
    owns: "the call camera and the receipts it produces",
    why: "a meeting is evidence, so it is captured and never composed",
  },
  audio: {
    path: "none",
    owns: "episodes, chapters, transcripts, feeds",
    why: "the mouth does not draw the face",
  },
  text: {
    path: "none",
    owns: "posts, threads, alt text",
    why: "the mouth does not draw the face",
  },
};

export const MEDIA_SURFACES: MediaSurface[] = [...SURFACES, "proskena"];

export function mediaPathFor(surface: string): MediaPath | undefined {
  return (SURFACE_MEDIA as Record<string, SurfaceMedia>)[surface]?.path;
}

// an asset series: one shoot, one carousel, one episode's keyframes. the items in
// it are meant to be the same person in the same place, so the series carries the
// source as a property of the whole thing rather than of each item.
export interface SeriesItem {
  id: string;
  blocks: ConsistencyBlocks;
  wardrobe: string;
}

export interface AssetSeries {
  surface: MediaSurface;
  source: Exclude<MediaPath, "none">;
  subject: string;
  items: SeriesItem[];
}

export interface SeriesProblem {
  series: string;
  problem: string;
}

// the contract a series has to keep. character, location and wardrobe are locked
// across a series; composition is the axis a series is allowed to vary, which is
// the whole point of shooting several frames in one room.
export const SERIES_LOCKED = ["character", "location"] as const;

export function checkSeries(series: AssetSeries): SeriesProblem[] {
  const problems: SeriesProblem[] = [];
  const declared = mediaPathFor(series.surface);
  if (!declared) {
    problems.push({ series: series.subject, problem: `"${series.surface}" is not a surface with a media path` });
  } else if (declared === "none") {
    problems.push({ series: series.subject, problem: `${series.surface} produces no pictures, so it cannot carry a series` });
  } else if (declared !== series.source) {
    problems.push({
      series: series.subject,
      problem: `${series.surface} is ${declared} and this series is ${series.source}, which is how one face becomes two`,
    });
  }
  if (!series.subject.trim()) problems.push({ series: series.subject, problem: "a series with no subject cannot be tied to a persona" });
  if (series.items.length < 2) problems.push({ series: series.subject, problem: "one item is a picture, not a series" });

  const [first, ...rest] = series.items;
  if (first) {
    for (const item of rest) {
      const moved = consistencyDrift(first.blocks, item.blocks).filter((axis) =>
        (SERIES_LOCKED as readonly string[]).includes(axis)
      );
      if (moved.length) {
        problems.push({ series: series.subject, problem: `${item.id} moved ${moved.join(" and ")} away from ${first.id}` });
      }
      if (item.wardrobe.trim() !== first.wardrobe.trim()) {
        problems.push({ series: series.subject, problem: `${item.id} is wearing something else: wardrobe is locked across a series` });
      }
    }
  }
  return problems;
}

// a persona may only claim surfaces the head knows how to feed, and claiming the
// generated surface without a look leaves diffusion with no anchor to keep her.
export function checkMediaContract(claimed: string[], look?: string): string[] {
  const problems: string[] = [];
  for (const surface of claimed) {
    if (!mediaPathFor(surface)) problems.push(`${surface} is claimed but has no media path, so nothing says how it gets pictures`);
  }
  if (claimed.includes("static") && !(look ?? "").trim()) {
    problems.push("static generates her and the persona declares no look, so the samples have nothing to be consistent with");
  }
  const paths = new Set(claimed.map((s) => mediaPathFor(s)).filter((p) => p && p !== "none"));
  if (paths.has("rendered") && paths.has("generated") && !look) {
    problems.push("claims both a render path and a generation path with no look to hold them together");
  }
  return problems;
}
