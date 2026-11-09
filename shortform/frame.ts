// the framing values the sizing rules operate on.
//
// the full composite module (ffmpeg argument builders, the matte stage,
// the plate) lives on the branches that actually raster frames. the
// shortform surface only needs the placement a camera already decided,
// so that is all it declares here: fit height, the fraction of the frame
// the person fills, and where the top of them sits.
//
// same values, same meaning, as the composite work this was ported from,
// so a job spec produced here is directly consumable by a renderer that
// knows the composite plan.

export interface Placement {
  fitHeight: number; // fraction of frame height the person fills
  anchorY: number; // where their top sits, fraction of frame height
  anchorX?: number; // horizontal centre, fraction of frame width; undefined = centred
}

export interface Frame {
  width: number;
  height: number;
}
