// run the real gate over a real probed directory.
//
// the facts here are measured, not assumed: ffprobe said 24 takes of 30.0s at
// 44100 Hz mono after prep, and the host said 4 cores, 8 GB, no gpu.

import probe from "../probe.json" with { type: "json" };
import { buildManifest, jobFor } from "./manifest.ts";
import { trainerProblems, hoursOn, type HostFacts } from "./trainer.ts";

const takes = probe.map((p, i) => ({
  id: `take_${i + 1}`,
  path: `wavs/${p.file}`,
  seconds: p.seconds,
  sample_rate: p.sample_rate,
  channels: p.channels,
  source: "tts" as const,
  tts: "tenki-probe",
  sung: true,
  text: "a line of ordinary words, usually sunny",
  pitch_range: [55, 62] as [number, number],
  language: "en",
}));

const set = { voice_id: "aipn-probe-01", identity_digest: "digest-measured", takes };
const opts = { speech_digest: "digest-measured", for_release: true };
const { manifest, problems } = buildManifest(set, opts);
console.log(`takes ${manifest.takes.length}, ${manifest.seconds}s, gate problems: ${problems.length}`);
for (const p of problems) console.log(`  gate: ${p}`);

const job = jobFor(set, manifest, { vendor: "diffsinger", licence: "MIT", device: "gpu", estimate_hours: 8, for_release: true });
for (const host of [
  { gpu: false, cpu_cores: 4, memory_gb: 8 },
  { gpu: true, cpu_cores: 16, memory_gb: 64 },
] as HostFacts[]) {
  const refuse = trainerProblems(job, host);
  console.log(`host gpu=${host.gpu}: ${refuse.length ? refuse.join(" | ") : "job is runnable"}, cpu night would be ${hoursOn(job, "cpu")}h`);
}
