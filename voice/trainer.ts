// the trainer: a job you can read, argue with, and refuse.
//
// training a singing voice is the one step that costs a machine and hours, so it is
// the step where a vague plan is most expensive. everything a job needs to be
// reproducible is in the job: which reference digest it came from, which device it
// expects, what it will produce, and how long the vendor says it takes.

export type Device = "cpu" | "gpu";
export type ArtifactKind = "model" | "config" | "index" | "transcriptions";

export interface TrainJob {
  voice_id: string;
  vendor: string;
  vendor_licence: string;
  device: Device;
  // digest of the reference set the dataset was built from, so a job cannot train on
  // audio nobody reviewed
  reference_digest: string;
  dataset: { manifest_path: string; digest: string; minutes: number; takes: number };
  // ordered, each step a command with no shell in it
  steps: { name: string; command: string[] }[];
  artifacts: { path: string; kind: ArtifactKind }[];
  estimate_hours: number;
  // a released voice must be trained on a permission that allows released voices
  for_release: boolean;
}

export interface HostFacts {
  // what the machine actually has, measured rather than assumed
  gpu: boolean;
  cpu_cores: number;
  memory_gb: number;
}

// an svs model wants a gpu for days of work and a conversion model can be coaxed on
// cpu for a long night. below this the trainer is a space heater.
export const GPU_MIN_VRAM_GB = 8;
export const MIN_TRAIN_MINUTES = 10;
export const PREP_STEP = "prep";
export const TRAIN_STEP = "train";

export function trainerProblems(job: TrainJob, host: HostFacts): string[] {
  const problems: string[] = [];
  const commercial = !/NC|non commercial|GPL/i.test(job.vendor_licence);
  if (job.for_release && !commercial) {
    problems.push(`${job.vendor}: ${job.vendor_licence} cannot train a voice that gets released`);
  }
  if (!job.reference_digest) problems.push(`${job.voice_id}: no reference digest, so nobody can say what it learned`);
  if (job.dataset.minutes < MIN_TRAIN_MINUTES) {
    problems.push(`${job.voice_id}: ${job.dataset.minutes} minutes of audio trains an impression, not a voice`);
  }
  if (job.dataset.takes < 1) problems.push(`${job.voice_id}: a dataset with no takes is a folder`);
  if (job.device === "gpu" && !host.gpu) {
    problems.push(`${job.voice_id}: the job expects a gpu and this host has none, so it is a plan and not a run`);
  }
  if (job.device === "gpu" && host.gpu && host.memory_gb < GPU_MIN_VRAM_GB) {
    problems.push(`${job.voice_id}: ${host.memory_gb}GB is under the ${GPU_MIN_VRAM_GB}GB an svs run needs`);
  }
  if (job.estimate_hours <= 0) problems.push(`${job.voice_id}: an estimate of zero hours is a guess pretending to be a plan`);
  const order = job.steps.map((s) => s.name);
  if (!order.includes(PREP_STEP)) problems.push(`${job.voice_id}: no prep step, so the audio goes in raw`);
  if (!order.includes(TRAIN_STEP)) problems.push(`${job.voice_id}: no train step`);
  if (order.indexOf(PREP_STEP) > order.indexOf(TRAIN_STEP) && order.includes(TRAIN_STEP)) {
    problems.push(`${job.voice_id}: the prep step runs after the train step`);
  }
  for (const step of job.steps) {
    if (step.command.some((a) => /[;&|]|\$\(|`/.test(a))) {
      problems.push(`${step.name}: a command with a shell in it is a command nobody can sandbox`);
    }
  }
  if (!job.artifacts.some((a) => a.kind === "model")) problems.push(`${job.voice_id}: no model in the artifacts`);
  return problems;
}

// a job whose artifacts are not all on disk produced a log, not a voice.
export function artifactProblems(job: TrainJob, present: string[]): string[] {
  const problems: string[] = [];
  for (const artifact of job.artifacts) {
    if (!present.includes(artifact.path)) problems.push(`${artifact.path}: ${artifact.kind} missing, so the job did not finish`);
  }
  if (!job.artifacts.some((a) => a.kind === "config" && present.includes(a.path))) {
    problems.push(`${job.voice_id}: a model without its config cannot be loaded by anything`);
  }
  return problems;
}

export function hoursOn(job: TrainJob, device: Device): number {
  // a conversion run on cpu is roughly an overnight job where a gpu run is minutes of
  // wall clock, and saying so is cheaper than discovering it at hour nine
  return device === "gpu" ? job.estimate_hours : Number((job.estimate_hours * 12).toFixed(1));
}
