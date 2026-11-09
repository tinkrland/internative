// presence: what it means for the persona to be live, and what each state
// does to the picture.
//
// a stream is not a switch. offline, walking on, live, stepping away and
// ending are different promises to the room, and each one has a different
// picture and a different audio route. keeping them as one state machine
// means the stream cannot be "live" with the stream stopped, and cannot
// "step away" from an offline stream.

export type PresenceState = "offline" | "starting" | "live" | "brb" | "ending";

export interface PresencePlan {
  scene: "idle" | "live" | "brb";
  cameraVisible: boolean;
  streaming: boolean;
  // what the room is told, when the surface has a chat to say it in
  announcement?: string;
}

export const PRESENCE_PLANS: Record<PresenceState, PresencePlan> = {
  offline: { scene: "idle", cameraVisible: false, streaming: false },
  starting: { scene: "idle", cameraVisible: false, streaming: false, announcement: "starting" },
  live: { scene: "live", cameraVisible: true, streaming: true, announcement: "live" },
  brb: { scene: "brb", cameraVisible: false, streaming: true, announcement: "away" },
  ending: { scene: "idle", cameraVisible: false, streaming: false, announcement: "ended" },
};

const ALLOWED: Record<PresenceState, PresenceState[]> = {
  offline: ["starting"],
  starting: ["live", "ending"],
  live: ["brb", "ending"],
  brb: ["live", "ending"],
  ending: ["offline"],
};

// the session this machine drives: obs, or a fake in tests.
export interface PresenceSession {
  switchScene(scene: string): Promise<void>;
  setCameraVisible(visible: boolean): Promise<void>;
  startStream(): Promise<void>;
  stopStream(): Promise<void>;
}

export class Presence {
  state: PresenceState = "offline";

  constructor(private session: PresenceSession) {}

  async to(next: PresenceState): Promise<PresencePlan> {
    if (!ALLOWED[this.state].includes(next)) {
      throw new Error(`presence: cannot go from ${this.state} to ${next}`);
    }
    const plan = PRESENCE_PLANS[next];
    // order matters: the scene and camera settle before the encoder starts,
    // so the first second of a stream is never the wrong picture, and the
    // encoder stops before the scene clears so the last frame is not black.
    if (plan.streaming && !PRESENCE_PLANS[this.state].streaming) {
      await this.session.switchScene(plan.scene);
      await this.session.setCameraVisible(plan.cameraVisible);
      await this.session.startStream();
    } else if (!plan.streaming && PRESENCE_PLANS[this.state].streaming) {
      await this.session.stopStream();
      await this.session.switchScene(plan.scene);
      await this.session.setCameraVisible(plan.cameraVisible);
    } else {
      await this.session.switchScene(plan.scene);
      await this.session.setCameraVisible(plan.cameraVisible);
    }
    this.state = next;
    return plan;
  }
}

// the normal march, so a caller does not have to remember the graph.
export async function openStream(presence: Presence): Promise<PresencePlan[]> {
  const out = [await presence.to("starting"), await presence.to("live")];
  return out;
}

export async function closeStream(presence: Presence): Promise<PresencePlan[]> {
  const out = [await presence.to("ending"), await presence.to("offline")];
  return out;
}
