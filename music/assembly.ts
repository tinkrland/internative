// putting the three lanes back together, on purpose.
//
// the point of separating them is that a re-sing does not touch the music, a lyric
// rewrite does not touch the vocal take's melody, and a remix is a new mixdown of
// stems that already exist. that only works if reassembly refuses stems that came
// from different generations, which is the failure a listener hears immediately and
// a pipeline never notices.

import { STREAMING_TARGET } from "./master.ts";
import type { Lane } from "./lanes.ts";

export interface Stem {
  lane: Lane;
  path: string;
  sample_rate: number;
  channels: number;
  // a vocal with the reverb baked in cannot be remixed later
  dry?: boolean;
  // which generation of this lane produced it
  digest: string;
}

export interface AssemblyPlan {
  aipn: string;
  title: string;
  // one digest per lane, so a stem can be traced to the take it came from
  takes: Record<Lane, string>;
  stems: Stem[];
  mix: { vocal_db: number; music_db: number };
  master: { integrated_lufs: number; true_peak_db: number; bit_depth: number };
}

export function assemblyProblems(plan: AssemblyPlan): string[] {
  const problems: string[] = [];
  const byLane = (lane: Lane) => plan.stems.filter((s) => s.lane === lane);

  if (!byLane("musicality").length) problems.push("no musicality stem: there is nothing to sing over");
  const vocals = byLane("performance");
  if (!vocals.length) problems.push("no performance stem: this is a backing track, not a song");

  for (const lane of ["musicality", "lyric", "performance"] as Lane[]) {
    if (!plan.takes[lane]) problems.push(`${lane}: no take digest, so no stem here can be traced`);
  }

  for (const stem of plan.stems) {
    const take = plan.takes[stem.lane];
    if (take && stem.digest !== take) {
      problems.push(`${stem.path} came from ${stem.digest} but ${stem.lane} is on ${take}, so this is two songs`);
    }
  }

  const rates = new Set(plan.stems.map((s) => s.sample_rate));
  if (rates.size > 1) problems.push(`stems disagree on sample rate (${[...rates].join(", ")})`);

  for (const vocal of vocals) {
    if (vocal.dry !== true) problems.push(`${vocal.path} is not a dry vocal, so it can never be remixed`);
  }

  if (plan.mix.vocal_db > 0 || plan.mix.music_db > 0) problems.push("mix levels are cuts, not boosts");
  if (plan.mix.music_db > plan.mix.vocal_db) problems.push("the music sits above the voice, so the words are a texture");

  const wanted = STREAMING_TARGET;
  if (plan.master.integrated_lufs !== wanted.integrated_lufs) problems.push(`master must target ${wanted.integrated_lufs} LUFS, not ${plan.master.integrated_lufs}`);
  if (plan.master.true_peak_db !== wanted.true_peak_db) problems.push(`master must stop at ${wanted.true_peak_db} dBTP`);
  if (plan.master.bit_depth !== wanted.bit_depth) problems.push(`master is ${wanted.bit_depth} bit`);

  return problems;
}

// the mixdown is arithmetic on stems, so it is written out as arguments rather than
// left to a chain of filters nobody can read back.
export function mixdownArgs(plan: AssemblyPlan, out = "mix.wav"): string[] {
  const vocal = plan.stems.find((s) => s.lane === "performance")!;
  const music = plan.stems.find((s) => s.lane === "musicality")!;
  return [
    "-y",
    "-i", vocal.path,
    "-i", music.path,
    "-filter_complex",
    `[0:a]volume=${plan.mix.vocal_db}dB[v];[1:a]volume=${plan.mix.music_db}dB[m];[v][m]amix=inputs=2:normalize=0[out]`,
    "-map", "[out]",
    "-c:a", `pcm_s${plan.master.bit_depth}le`,
    "-ar", String(vocal.sample_rate),
    out,
  ];
}

// what a remix actually is: the same three takes, a different two numbers.
export function remix(plan: AssemblyPlan, vocal_db: number, music_db: number): AssemblyPlan {
  return { ...plan, mix: { vocal_db, music_db } };
}
