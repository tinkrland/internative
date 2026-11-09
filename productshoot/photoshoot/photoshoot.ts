// a photoshoot: the persona rendered, on purpose.
//
// this is what proskena is for and the only thing it is for. the frames here
// are rendered from a real scene (the plate is proskena scene state, the
// subject is a 3d likeness), which is a different craft from generating an
// image with a diffusion model. the two are not interchangeable and they do
// not live in the same branch:
//
//   proskena (here)  a shoot: authored set, fixed lens, the same person every
//                    frame, because the geometry did not change
//   static (there)   diffusion: photographs of a persona the model has never
//                    met, held together by prompt text and a seed
//
// a shoot is planned as a shot list, because a photoshoot that is one frame
// is a screenshot.

import { buildPlateSpec, type Frame, type PlateSpec } from "../stage/plate.ts";
import { defaultSet, type SetSpec } from "../stage/set.ts";
import { streamerRoom, type RoomCamera } from "../stage/scene.ts";
import { target, type SocialTarget } from "../stage/sizes.ts";

export type ShotKind = "hero" | "portrait" | "detail" | "environment";

export interface Shot {
  id: string;
  kind: ShotKind;
  // how the frame is composed, in words a camera operator would use
  composition: string;
  // how close: the axis that most often breaks a shoot
  magnification: string;
  // where the camera stands, if it moves for this shot
  cam?: RoomCamera;
  notes?: string;
}

export interface Photoshoot {
  title: string;
  set: SetSpec;
  cam: RoomCamera;
  frameTarget: string;
  shots: Shot[];
}

export interface ShotSpec {
  shot: Shot;
  target: SocialTarget;
  frame: Frame;
  plate: PlateSpec;
}

// the shot list a shoot needs to be useful: a hero, a portrait, two details
// and the room itself. anything less and there is nothing to choose from.
const REQUIRED_KINDS: ShotKind[] = ["hero", "portrait", "detail", "environment"];

export function planPhotoshoot(input: {
  title: string;
  frameTarget: string;
  set?: SetSpec;
  cam?: RoomCamera;
  shots?: Partial<Shot>[];
}): Photoshoot {
  const frameTarget = input.frameTarget;
  target(frameTarget); // refuse an unknown frame here, not at render time
  const base: Shot[] = [
    { id: "hero", kind: "hero", composition: "subject centred, negative space above the eyeline", magnification: "waist up" },
    { id: "portrait", kind: "portrait", composition: "subject on the right third, set readable behind", magnification: "head and shoulders" },
    { id: "detail", kind: "detail", composition: "hands and the prop, set soft behind", magnification: "close, one plane sharp" },
    { id: "environment", kind: "environment", composition: "the room, subject small or absent", magnification: "wide" },
  ];
  const shots = base.map((shot) => ({ ...shot, ...(input.shots?.find((s) => s.id === shot.id) ?? {}) }));
  return {
    title: input.title,
    set: input.set ?? defaultSet(),
    cam: input.cam ?? streamerRoom().cam,
    frameTarget,
    shots,
  };
}

export function shotSpecs(shoot: Photoshoot, outDir = "out"): ShotSpec[] {
  const t = target(shoot.frameTarget);
  const frame: Frame = { width: t.width, height: t.height };
  return shoot.shots.map((shot) => ({
    shot,
    target: t,
    frame,
    // the subject stays null: the person is composited in front of the plate,
    // so a shoot never burns a likeness into the background
    plate: buildPlateSpec(shoot.set, shot.cam ?? shoot.cam, frame, `${outDir}/${shoot.title}-${shot.id}.png`, {
      subject: null,
    }),
  }));
}

export interface ShootProblem {
  shot: string;
  problem: string;
}

export function checkPhotoshoot(shoot: Photoshoot): ShootProblem[] {
  const problems: ShootProblem[] = [];
  const kinds = new Set(shoot.shots.map((s) => s.kind));
  for (const kind of REQUIRED_KINDS) {
    if (!kinds.has(kind)) problems.push({ shot: kind, problem: "missing: the shoot has no such frame to choose from" });
  }
  const magnifications = shoot.shots.map((s) => s.magnification.trim().toLowerCase());
  if (new Set(magnifications).size !== magnifications.length) {
    problems.push({ shot: "all", problem: "duplicate magnification: two frames that read the same are one frame" });
  }
  for (const shot of shoot.shots) {
    if (!shot.composition.trim()) problems.push({ shot: shot.id, problem: "no composition: the renderer will centre it and the shoot will look alike" });
  }
  return problems;
}
