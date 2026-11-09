// the shortform surface: the persona as an internet personality, not just
// a presence in a call.
//
// this module is the sizing half, ported from the socmed work, which took
// its numbers from proskena rather than inventing a second set:
//
// - presets mirror proskena's export sizes verbatim: square 1:1, portrait
//   4:5, vertical 9:16, wide 16:9, plus the call frame 16:9 and
//   pinterest's 2:3.
// - the platform facts come from proskena's platform reference (checked
//   against 2026 sources: instagram, tiktok and pinterest post counts).
//   tiktok and reels/stories are 9:16 with a top and bottom ui safe zone
//   of about 14 percent; instagram and facebook feeds are 4:5 (3:4 is also
//   native); pinterest pins are 2:3.
//
// the principle is proskena's too: aspect is a render-time value, not a
// redesign. the same pinned camera re-renders into any ratio, and one
// authored set serves every channel. what this branch renders is not what
// gets posted: posting is gated by the persona's publishing permission and
// stays a separate, explicit step.

import type { Placement } from "./frame.ts";

export interface SocialTarget {
  key: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  // fractions of frame height kept clear of critical content (platform ui:
  // captions over the bottom, profile chrome over the top). 0.14 for the
  // 9:16 verticals, per the platform reference.
  safeTop: number;
  safeBottom: number;
  // where posting actually happens, if anything: the pipeline renders, it
  // does not publish. parked channels stay explicit.
  surface: "call" | "feed" | "vertical" | "pin" | "longform";
}

export const SOCIAL_TARGETS: Record<string, SocialTarget> = {
  call: {
    key: "call",
    label: "16:9 · 1280x720",
    platform: "meeting / livekit",
    width: 1280,
    height: 720,
    safeTop: 0,
    safeBottom: 0,
    surface: "call",
  },
  wide: {
    key: "wide",
    label: "16:9 · 1920x1080",
    platform: "youtube / landscape",
    width: 1920,
    height: 1080,
    safeTop: 0,
    safeBottom: 0,
    surface: "feed",
  },
  square: {
    key: "square",
    label: "1:1 · 1080",
    platform: "instagram / facebook carousel",
    width: 1080,
    height: 1080,
    safeTop: 0,
    safeBottom: 0,
    surface: "feed",
  },
  portrait: {
    key: "portrait",
    label: "4:5 · 1080x1350",
    platform: "instagram / facebook feed",
    width: 1080,
    height: 1350,
    safeTop: 0,
    safeBottom: 0,
    surface: "feed",
  },
  vertical: {
    key: "vertical",
    label: "9:16 · 1080x1920",
    platform: "reels / stories / tiktok / idea pins",
    width: 1080,
    height: 1920,
    safeTop: 0.14,
    safeBottom: 0.14,
    surface: "vertical",
  },
  pin: {
    key: "pin",
    label: "2:3 · 1000x1500",
    platform: "pinterest standard pin",
    width: 1000,
    height: 1500,
    safeTop: 0,
    safeBottom: 0,
    surface: "pin",
  },
};

// long form lives on its own branch, but its targets belong in the same
// table: a persona re-renders one set into every ratio, so the numbers
// have to agree. youtube long form is 16:9 1080p (4k supported) with
// burned captions in the bottom tenth; shorts are 9:16 up to 3 minutes
// with the same 14 percent bands; a twitch vod inherits the 1080p60
// broadcast; custom thumbnails are 3840x2160 per the 2026 guidance.
export const LONGFORM_TARGETS: Record<string, SocialTarget> = {
  youtube_long: {
    key: "youtube_long",
    label: "16:9 · 1920x1080",
    platform: "youtube long form",
    width: 1920,
    height: 1080,
    safeTop: 0,
    safeBottom: 0.1,
    surface: "longform",
  },
  youtube_4k: {
    key: "youtube_4k",
    label: "16:9 · 3840x2160",
    platform: "youtube long form, 4k upload",
    width: 3840,
    height: 2160,
    safeTop: 0,
    safeBottom: 0.1,
    surface: "longform",
  },
  shorts: {
    key: "shorts",
    label: "9:16 · 1080x1920",
    platform: "youtube shorts (up to 3 minutes)",
    width: 1080,
    height: 1920,
    safeTop: 0.14,
    safeBottom: 0.14,
    surface: "vertical",
  },
  twitch_vod: {
    key: "twitch_vod",
    label: "16:9 · 1920x1080",
    platform: "twitch vod / streamer republish",
    width: 1920,
    height: 1080,
    safeTop: 0,
    safeBottom: 0.1,
    surface: "longform",
  },
  thumbnail: {
    key: "thumbnail",
    label: "16:9 · 3840x2160",
    platform: "youtube custom thumbnail (2026 guidance)",
    width: 3840,
    height: 2160,
    // the duration badge sits over the bottom-right corner: nothing
    // critical in the last ~12 percent of width, ~5 percent up from the
    // bottom
    safeTop: 0,
    safeBottom: 0.05,
    surface: "longform",
  },
};

export function target(key: string): SocialTarget {
  const t = SOCIAL_TARGETS[key] ?? LONGFORM_TARGETS[key];
  if (!t) throw new Error(`unknown social target: ${key}`);
  return t;
}

// the safe zone is the one place sizing changes the framing rather than
// the pixels: on a 9:16 vertical the top and bottom 14 percent get covered
// by platform ui, so critical content cannot live there. the head must
// clear the top band, and the whole figure must fit between the bands. the
// arithmetic is applied to the placement the camera already decided, so
// the shot is still the authored lens and only the crop is the surface's.
export function placementInSafeZone(placement: Placement, target: SocialTarget): Placement {
  const usable = Math.max(0.2, 1 - target.safeTop - target.safeBottom);
  const fitHeight = Math.min(placement.fitHeight, usable);
  const anchorY = Math.max(placement.anchorY, target.safeTop);
  return { ...placement, fitHeight, anchorY };
}

// one authored set, every channel: the capture plan for a target is the
// composite plan's framing values, nothing re-composed. `key` names the
// surface; the caller renders one plate and composites per target. long
// form and vertical targets share the same clamping: a caption band moves
// the person up exactly the way a ui band does.
export interface CaptureTargets {
  rendered: SocialTarget;
  safe: boolean; // whether the safe zone moved the framing
}

export function captureTarget(key: string, placement: Placement): CaptureTargets {
  const t = target(key);
  const clamped = placementInSafeZone(placement, t);
  return {
    rendered: t,
    safe: clamped.fitHeight !== placement.fitHeight || clamped.anchorY !== placement.anchorY,
  };
}
