// a training job is a plan someone can refuse, and a dataset is the part a cpu can do.

import { assertEquals } from "jsr:@std/assert@1";
import {
  artifactProblems,
  hoursOn,
  trainerProblems,
  type HostFacts,
  type TrainJob,
} from "../trainer.ts";
import { buildManifest, DATASET_RATE, jobFor, prepArgs } from "../manifest.ts";
import type { ReferenceSet, ReferenceTake } from "../reference.ts";

const DIGEST = "voice-digest-1";
const opts = { speech_digest: DIGEST, for_release: true };
const CPU_HOST: HostFacts = { gpu: false, cpu_cores: 4, memory_gb: 8 };
const GPU_HOST: HostFacts = { gpu: true, cpu_cores: 16, memory_gb: 64 };

function take(over: Partial<ReferenceTake> = {}): ReferenceTake {
  return {
    id: "t1", path: "/tmp/t1.wav", seconds: 12, sample_rate: 48000, channels: 1,
    source: "tts", tts: "fake", sung: true, language: "en",
    text: "a line of ordinary words, usually sunny", pitch_range: [55, 67], ...over,
  };
}
function set(takes: ReferenceTake[]): ReferenceSet {
  return { voice_id: "voice-1", identity_digest: DIGEST, takes };
}
const takes = Array.from({ length: 60 }, (_, i) => take({ id: `t${i}` }));
const refSet = set(takes);

Deno.test("the manifest keeps only what can be aligned, and says the rate", () => {
  const { manifest, problems } = buildManifest(refSet, opts);
  assertEquals(problems, []);
  assertEquals(manifest.takes.length, 60);
  assertEquals(manifest.seconds, 720);
  assertEquals(manifest.takes[0].file, "wavs/t0.wav");
  assertEquals(prepArgs("in.wav", "out.wav").includes(String(DATASET_RATE)), true);
  const mixed = set([...takes, take({ id: "tiny", seconds: 1 }), take({ id: "long", seconds: 90 })]);
  assertEquals(buildManifest(mixed, opts).manifest.takes.length, 60);
});

Deno.test("a gate failure travels with the manifest instead of being swallowed", () => {
  const bad = set(takes.map((t) => ({ ...t, channels: 2 })));
  const { problems } = buildManifest(bad, opts);
  assertEquals(problems.some((p) => p.includes("mono take")), true);
});

Deno.test("a job names its vendor, its licence and what it will produce", () => {
  const { manifest } = buildManifest(refSet, opts);
  const job = jobFor(refSet, manifest, { vendor: "diffsinger", licence: "MIT", device: "gpu", estimate_hours: 6, for_release: true });
  assertEquals(trainerProblems(job, GPU_HOST), []);
  assertEquals(job.dataset.minutes, 12);
  assertEquals(job.artifacts.map((a) => a.kind), ["model", "config"]);
});

Deno.test("no gpu on the host means the job is a plan, and it is said out loud", () => {
  const { manifest } = buildManifest(refSet, opts);
  const job = jobFor(refSet, manifest, { vendor: "diffsinger", licence: "MIT", device: "gpu", estimate_hours: 6, for_release: true });
  const problems = trainerProblems(job, CPU_HOST);
  assertEquals(problems.some((p) => p.includes("plan and not a run")), true);
});

Deno.test("a non commercial licence cannot train a released voice", () => {
  const { manifest } = buildManifest(refSet, opts);
  const job = jobFor(refSet, manifest, { vendor: "musicgen", licence: "CC-BY-NC-4.0", device: "gpu", estimate_hours: 6, for_release: true });
  assertEquals(trainerProblems(job, GPU_HOST).some((p) => p.includes("gets released")), true);
});

Deno.test("too little audio is called what it is", () => {
  const thin = set(Array.from({ length: 10 }, (_, i) => take({ id: `s${i}` })));
  const { manifest } = buildManifest(thin, opts);
  assertEquals(manifest.seconds, 120, "the short set still builds a manifest");
  const job = jobFor(thin, manifest, { vendor: "rvc", licence: "MIT", device: "cpu", estimate_hours: 2, for_release: true });
  assertEquals(trainerProblems(job, CPU_HOST).some((p) => p.includes("trains an impression")), true);
});

Deno.test("a shell in a step is refused, because it cannot be sandboxed", () => {
  const { manifest } = buildManifest(refSet, opts);
  const job = jobFor(refSet, manifest, { vendor: "rvc", licence: "MIT", device: "cpu", estimate_hours: 2, for_release: true });
  const sneaky: TrainJob = { ...job, steps: [{ name: "prep", command: ["bash", "-lc", "rm -rf /tmp/x && python3 -m voice.prep"] }, ...job.steps.slice(1)] };
  assertEquals(trainerProblems(sneaky, CPU_HOST).some((p) => p.includes("shell in it")), true);
});

Deno.test("prep after train is a job that trains on nothing", () => {
  const { manifest } = buildManifest(refSet, opts);
  const job = jobFor(refSet, manifest, { vendor: "rvc", licence: "MIT", device: "cpu", estimate_hours: 2, for_release: true });
  const reversed: TrainJob = { ...job, steps: [job.steps[1], job.steps[0]] };
  assertEquals(trainerProblems(reversed, CPU_HOST).some((p) => p.includes("after the train step")), true);
});

Deno.test("artifacts are checked on disk, and a model without a config is not loadable", () => {
  const { manifest } = buildManifest(refSet, opts);
  const job = jobFor(refSet, manifest, { vendor: "rvc", licence: "MIT", device: "cpu", estimate_hours: 2, for_release: true });
  assertEquals(artifactProblems(job, ["model/model.onnx", "model/config.json"]), []);
  assertEquals(artifactProblems(job, ["model/model.onnx"]).some((p) => p.includes("cannot be loaded")), true);
  const nothing = artifactProblems(job, []);
  assertEquals(nothing.some((p) => p.startsWith("model/model.onnx")), true);
  assertEquals(nothing.some((p) => p.startsWith("model/config.json") && p.includes("missing")), true);
});

Deno.test("the cpu night is admitted rather than discovered", () => {
  const { manifest } = buildManifest(refSet, opts);
  const job = jobFor(refSet, manifest, { vendor: "rvc", licence: "MIT", device: "cpu", estimate_hours: 2, for_release: true });
  assertEquals(hoursOn(job, "gpu"), 2);
  assertEquals(hoursOn(job, "cpu"), 24);
});

Deno.test("every step names a module that is actually shipped", async () => {
  const { manifest } = buildManifest(refSet, opts);
  const job = jobFor(refSet, manifest, { vendor: "diffsinger", licence: "MIT", device: "gpu", estimate_hours: 8, for_release: true });
  for (const step of job.steps) {
    const moduleArg = step.command.find((a) => a.startsWith("voice.trainer."));
    assertEquals(typeof moduleArg, "string", `${step.name} names no module`);
    const path = `${moduleArg!.replaceAll(".", "/")}.py`;
    const exists = await Deno.stat(path).then(() => true).catch(() => false);
    assertEquals(exists, true, `${path} is named by a step and is not on disk`);
  }
});
