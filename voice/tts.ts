// the tts seam: one interface, no provider.
//
// a podcast is the one surface where the voice is the whole product, so the
// seam is deliberately narrow: give it text and the persona's delivery
// cues, get back a file path and a duration. anything a provider needs
// (voice id, speed, format) belongs inside the adapter, not in the plan.
//
// no provider is registered here. the fake in this file exists so the
// pipeline can be tested end to end without a network call, and it says
// what it is in its return value: a fake never claims a real render.

import type { VoiceStyle } from "../persona/voice_adapter.ts";

export interface TtsRequest {
  text: string;
  style: VoiceStyle;
  outPath: string;
}

export interface TtsResult {
  path: string;
  durationSec: number;
  // false for the fake, so a caller can never mistake a test for a render
  real: boolean;
}

export interface TtsAdapter {
  name: string;
  // the credential it needs, read at call time
  credentialEnv: string;
  speak(request: TtsRequest): Promise<TtsResult>;
}

const ADAPTERS = new Map<string, TtsAdapter>();

export function registerTts(adapter: TtsAdapter): void {
  ADAPTERS.set(adapter.name, adapter);
}

export function ttsAdapters(): string[] {
  return Array.from(ADAPTERS.keys());
}

export function getTts(name: string): TtsAdapter | null {
  return ADAPTERS.get(name) ?? null;
}

// the fake: deterministic duration from the words, no file written, and
// `real: false` so nothing downstream can present it as audio.
export function fakeTts(wordsPerSecond = 2.4): TtsAdapter {
  return {
    name: "fake",
    credentialEnv: "UNUSED",
    speak: ({ text, outPath }) => {
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      return Promise.resolve({
        path: outPath,
        durationSec: Number((words / wordsPerSecond).toFixed(2)),
        real: false,
      });
    },
  };
}
