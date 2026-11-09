// the dataset: what a trainer is fed, built from the reference set that already
// passed the gate. this is the half of training that runs on a cpu, which means it
// is the half that can run on a plain box before anyone pays for a gpu.

import {
  type ReferenceSet,
  type ReferenceTake,
  referenceProblems,
  totalSeconds,
  type TrainOptions,
} from "./reference.ts";
import { PREP_STEP, TRAIN_STEP, type TrainJob } from "./trainer.ts";

// training audio convention: mono, 44.1k, one take per file. a resample here means the
// trainer never has to know what a phone recorded.
export const DATASET_RATE = 44100;
// the python half lives beside this file, so a step never names a module that is not shipped
export const TRAINER_MODULES = ["voice/trainer/prep.py", "voice/trainer/train.py", "voice/trainer/dataset.py"];

export function prepArgs(input: string, output: string): string[] {
  return ["-y", "-i", input, "-ac", "1", "-ar", String(DATASET_RATE), "-c:a", "pcm_s16le", output];
}

export interface DatasetManifest {
  voice_id: string;
  identity_digest: string;
  seconds: number;
  takes: { id: string; file: string; seconds: number; sung: boolean; text?: string }[];
}

// only takes that could be aligned are shipped: a six second clip trains nothing and a
// forty second one drags the aligner off the beat
export function buildManifest(set: ReferenceSet, opts: TrainOptions): { manifest: DatasetManifest; problems: string[] } {
  const problems = referenceProblems(set, opts);
  const usable = set.takes.filter((t: ReferenceTake) => t.seconds >= 3 && t.seconds <= 30);
  const manifest: DatasetManifest = {
    voice_id: set.voice_id,
    identity_digest: set.identity_digest,
    seconds: totalSeconds(usable),
    takes: usable.map((t) => ({
      id: t.id,
      file: `wavs/${t.id}.wav`,
      seconds: t.seconds,
      sung: t.sung,
      ...(t.text ? { text: t.text } : {}),
    })),
  };
  if (!manifest.takes.length) problems.push(`${set.voice_id}: nothing survived the length window, so there is no dataset`);
  return { manifest, problems };
}

export function jobFor(
  set: ReferenceSet,
  manifest: DatasetManifest,
  opts: { vendor: string; licence: string; device: "cpu" | "gpu"; estimate_hours: number; for_release: boolean },
): TrainJob {
  return {
    voice_id: set.voice_id,
    vendor: opts.vendor,
    vendor_licence: opts.licence,
    device: opts.device,
    reference_digest: set.identity_digest,
    dataset: {
      manifest_path: "dataset/manifest.json",
      digest: `${manifest.voice_id}:${manifest.seconds}:${manifest.takes.length}`,
      minutes: Math.floor(manifest.seconds / 60),
      takes: manifest.takes.length,
    },
    steps: [
      {
        name: PREP_STEP,
        command: ["python3", "-m", "voice.trainer.prep", "--manifest", "dataset/manifest.json", "--out", "dataset"],
      },
      {
        name: TRAIN_STEP,
        command: [
          "python3", "-m", "voice.trainer.train",
          "--manifest", "dataset/manifest.json",
          "--dataset", "dataset",
          "--out", "model",
          "--device", opts.device,
        ],
      },
    ],
    artifacts: [
      { path: "model/model.onnx", kind: "model" },
      { path: "model/config.json", kind: "config" },
    ],
    estimate_hours: opts.estimate_hours,
    for_release: opts.for_release,
  };
}
