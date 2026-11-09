// long form is a shape, not a crop.
//
// a vertical clip and a twenty minute video are different objects: one is a
// single idea compressed, the other is an argument with a spine. what they
// share is the frame family, so the numbers live next to the shortform ones
// rather than being reinvented: 16:9 1080p is the recommended upload, 4k is
// supported, burned captions sit in the bottom tenth, and a custom
// thumbnail is 3840x2160 with the duration badge over the bottom right.
//
// these are ported values with their sourcing kept, because a wrong frame
// size is a re-upload, not a re-render.

export interface LongTarget {
  key: string;
  label: string;
  width: number;
  height: number;
  // fraction of frame height covered by burned captions or player chrome
  safeBottom: number;
  // the recommended bitrate, when one is known, for the encoder step
  bitrateKbps?: number;
}

export const LONG_TARGETS: Record<string, LongTarget> = {
  youtube_1080: {
    key: "youtube_1080",
    label: "16:9 · 1920x1080",
    width: 1920,
    height: 1080,
    safeBottom: 0.1,
    bitrateKbps: 8000,
  },
  youtube_4k: {
    key: "youtube_4k",
    label: "16:9 · 3840x2160",
    width: 3840,
    height: 2160,
    safeBottom: 0.1,
    bitrateKbps: 35000,
  },
  thumbnail: {
    key: "thumbnail",
    label: "16:9 · 3840x2160 (2026 guidance)",
    width: 3840,
    height: 2160,
    // the duration badge owns the bottom right corner
    safeBottom: 0.05,
  },
};

export function longTarget(key: string): LongTarget {
  const target = LONG_TARGETS[key];
  if (!target) throw new Error(`unknown long form target: ${key} (known: ${Object.keys(LONG_TARGETS).join(", ")})`);
  return target;
}

// the thumbnail's own safe area: the badge sits bottom right, at roughly
// 12 percent of the width and 5 percent of the height, so nothing critical
// goes there.
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function thumbnailSafeArea(target: LongTarget = LONG_TARGETS.thumbnail): Box {
  const badgeWidth = Math.round(target.width * 0.12);
  const badgeHeight = Math.round(target.height * 0.05);
  return {
    x: 0,
    y: 0,
    width: target.width - badgeWidth,
    height: target.height - badgeHeight,
  };
}
