// a still is the same plate at a different frame, never a generated
// background.
//
// this is the whole reason the static surface exists separately from a
// picture generator: the frame a persona posts on tuesday and the frame it
// posts in six months come from one authored room, one lens and one light
// recipe, so they match by construction rather than by prompt discipline.
//
// the person is not on this stage. a still composites the person in front of
// the plate when a person is wanted, and the plate alone is a legitimate
// still: a set, a lens, a light rig, nothing else.

import { buildPlateSpec, type Frame, type PlateSpec } from "../stage/plate.ts";
import { streamerRoom, type RoomCamera } from "../stage/scene.ts";
import { defaultSet, type SetSpec } from "../stage/set.ts";
import { SOCIAL_TARGETS, target, type SocialTarget } from "../stage/sizes.ts";

export interface StillRequest {
  // the authored room. same spec, every time, which is the point.
  set?: SetSpec;
  camera?: RoomCamera;
  // the frame family: a feed post, a pin, a vertical, a wide
  target: string;
  // which plate file the renderer writes
  out?: string;
  // burn in a caption band, when the still carries words
  withCaptionBand?: boolean;
}

export interface StillJob {
  target: SocialTarget;
  frame: Frame;
  // the plate spec the renderer consumes: proskena scene state, subject null
  plate: PlateSpec;
  // where a caption may sit without landing under platform chrome
  textBand: { top: number; bottom: number };
  // a still has no matte and no person layer on this stage
  person: null;
}

export function stillJob(request: StillRequest): StillJob {
  const frameTarget = target(request.target);
  const frame: Frame = { width: frameTarget.width, height: frameTarget.height };
  const plate = buildPlateSpec(
    request.set ?? defaultSet(),
    request.camera ?? streamerRoom().cam,
    frame,
    request.out ?? `still-${frameTarget.key}.png`,
    { subject: null },
  );
  const band = request.withCaptionBand
    ? { top: 1 - Math.max(frameTarget.safeBottom, 0.08), bottom: 1 - frameTarget.safeTop }
    : { top: 1, bottom: 1 };
  return { target: frameTarget, frame, plate, textBand: band, person: null };
}

// one authored set serves every channel: the aspect is a render time value,
// so switching from a 4:5 feed post to a 2:3 pin is another render, not
// another design.
export function setSizesAvailable(): string[] {
  return Object.keys(SOCIAL_TARGETS);
}
