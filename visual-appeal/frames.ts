// the frames a still is delivered in.
//
// these numbers are platform facts, not proskena facts, so they sit here and
// not on the photoshoot branch. the safe bands are the same 14 percent the
// verticals always carry: platform ui eats the top and the bottom, and text
// that lands there is text nobody reads.
//
// note: this table should move to the head once core owns frame sizes, so
// proskena and static cannot disagree about what a 9:16 is.

export interface Frame {
  key: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
}

export const FRAMES: Record<string, Frame> = {
  square: { key: "square", label: "feed square", platform: "instagram", width: 1080, height: 1080, safeTop: 0.06, safeBottom: 0.1 },
  portrait: { key: "portrait", label: "feed portrait", platform: "instagram", width: 1080, height: 1350, safeTop: 0.08, safeBottom: 0.12 },
  vertical: { key: "vertical", label: "story, reel, tiktok, short", platform: "tiktok", width: 1080, height: 1920, safeTop: 0.14, safeBottom: 0.14 },
  wide: { key: "wide", label: "landscape", platform: "youtube", width: 1920, height: 1080, safeTop: 0.06, safeBottom: 0.1 },
  pin: { key: "pin", label: "pin", platform: "pinterest", width: 1000, height: 1500, safeTop: 0.1, safeBottom: 0.12 },
};

export function frameFor(key: string): Frame {
  const frame = FRAMES[key];
  if (!frame) throw new Error(`unknown still frame: ${key}`);
  return frame;
}

// the band the caption owns, as fractions from the top
export function textBand(frame: Frame): { top: number; bottom: number } {
  return { top: 1 - frame.safeBottom, bottom: 1 - frame.safeTop };
}
