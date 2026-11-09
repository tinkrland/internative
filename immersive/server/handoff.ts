// the handoff protocol: one voice, two rooms, and a sentence that is never
// cut.
//
// ported from the prixie face work. what is kept is the part that matters
// when the camera goes off mid-stream: the visual goes dark immediately, the
// rendered clip keeps playing to its last syllable, then the audio switches
// and the voice owns the voice from the next utterance on. the versions that
// depend on a livekit room and a specific avatar provider are not here; the
// streaming branch reaches them through the seam below.

// what a rendered turn hands back. the same turn produced the audio and the
// picture, so the room hears exactly the render the mouth moves to.
export interface Render {
  turnId: string;
  audioUrl: string;
  videoUrl: string;
  turnLiveUrl: string;
  fromSpeakCache: boolean;
  elapsedMs: number;
}

// the only thing this branch needs from the voice side: whether the persona
// is currently on camera, so the next turn routes to a face or to tts.
export interface PersonaVoice {
  onCamera: boolean;
}

export interface CameraOffPlan {
  hideVisual: "now";
  keepAudioUntilMs: number;
  voiceSwitch: { atMs: number; to: "voice" };
  cutMidSentence: false;
}

export function planCameraOff(clipMs: number): CameraOffPlan {
  if (clipMs < 0) throw new Error("clipMs cannot be negative");
  return {
    hideVisual: "now",
    keepAudioUntilMs: clipMs,
    voiceSwitch: { atMs: clipMs, to: "voice" },
    cutMidSentence: false,
  };
}

export interface Timer {
  sleep(ms: number): Promise<void>;
}

// the executor. hideCamera() is the browser-level switch (obs source
// visibility). nothing in here can end the audio early: the sleep before
// unpublishMaskyAudio() IS the protocol.
export class CameraOffAdapter {
  constructor(
    private deps: {
      hideCamera(): Promise<void>;
      unpublishMaskyAudio(): Promise<void>;
      onSwitched?(): Promise<void>;
    },
    private timer: Timer = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
  ) {}

  async cameraOff(render: Render, clipMs: number): Promise<CameraOffPlan> {
    const plan = planCameraOff(clipMs);
    void render; // the pending render is what the room is hearing; nothing to swap here
    await this.deps.hideCamera();
    await this.timer.sleep(plan.keepAudioUntilMs);
    await this.deps.unpublishMaskyAudio();
    await this.deps.onSwitched?.();
    return plan;
  }
}
