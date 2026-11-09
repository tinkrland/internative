// per network clip facts, in one place, with their confidence attached.
//
// a limit that is wrong is worse than a limit that is flagged: a caption
// that silently gets truncated, or a clip that gets refused at upload, is
// the kind of failure that only shows up after publishing was turned on.
// so every number here carries `verified`. an unverified number is usable
// for planning a render, and must be confirmed in the app before the
// persona's publishing mode is raised above draft.
//
// these are the ceilings, not the recommendations. the persona's own
// register decides length and manners; this module only says what the
// network will accept.

export type ClipPlatform = "tiktok" | "reels" | "shorts";

export interface ClipSpec {
  platform: ClipPlatform;
  // the sizing key in sizes.ts that a clip for this network renders at
  target: string;
  maxDurationSec: number;
  captionMaxChars: number;
  // some networks put a separate title or description field on top of the
  // caption, with its own, much smaller, ceiling
  titleMaxChars?: number;
  coverTarget: string;
  verified: boolean;
  // what a human has to confirm before publishing is enabled for this
  // network, phrased as the check itself, not as a todo
  confirm?: string;
  notes: string;
}

export const CLIP_SPECS: Record<ClipPlatform, ClipSpec> = {
  tiktok: {
    platform: "tiktok",
    target: "vertical",
    maxDurationSec: 600,
    captionMaxChars: 2200,
    coverTarget: "vertical",
    verified: false,
    confirm: "the upload ceiling varies by account and has moved repeatedly: check the current in app limit before scheduling",
    notes: "9:16 with ui over the top and bottom 14 percent; captions live in the lower band and are not part of the frame",
  },
  reels: {
    platform: "reels",
    target: "vertical",
    maxDurationSec: 180,
    captionMaxChars: 2200,
    coverTarget: "vertical",
    verified: false,
    confirm: "reels duration has changed several times: confirm in app, and treat 3 minutes as a planning ceiling only",
    notes: "4:5 and 9:16 are both accepted; the persona renders 9:16 and crops nothing",
  },
  shorts: {
    platform: "shorts",
    target: "vertical",
    maxDurationSec: 180,
    captionMaxChars: 2200,
    titleMaxChars: 100,
    coverTarget: "vertical",
    verified: false,
    confirm: "shorts up to 3 minutes is documented, but the uploader still exposes per account variation: confirm once on the persona's own channel",
    notes: "9:16 up to 3 minutes with the same 14 percent bands as reels and tiktok",
  },
};

export function clipSpec(platform: string): ClipSpec {
  const key = platform.trim().toLowerCase() as ClipPlatform;
  const spec = CLIP_SPECS[key];
  if (!spec) throw new Error(`unknown clip platform: ${platform} (known: ${Object.keys(CLIP_SPECS).join(", ")})`);
  return spec;
}

// the one question that matters before publishing is turned on: are there
// unverified limits in the path of this network?
export function specReadyToPublish(platform: string): { ready: boolean; reason: string } {
  const spec = clipSpec(platform);
  if (!spec.verified) return { ready: false, reason: `${spec.platform}: ${spec.confirm}` };
  return { ready: true, reason: `${spec.platform}: limits verified` };
}
