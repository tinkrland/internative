// the master and the stems. the numbers here are the delivery contract, not taste:
// a streaming service normalises to about -14 LUFS, so mastering louder only loses
// the transients on the way in.

export interface MasterSpec {
  integrated_lufs: number;
  true_peak_db: number;
  sample_rate: number;
  bit_depth: number;
  stems: string[];
}

export const STREAMING_TARGET: MasterSpec = {
  integrated_lufs: -14,
  true_peak_db: -1,
  sample_rate: 48000,
  bit_depth: 24,
  stems: ["lead vocal", "dry vocal", "backing vocals", "drums", "bass", "guitars", "keys", "fx"],
};

// a dry vocal stem is what makes the song usable by someone else: a sync pitch, a
// remix, a live set. it is cheap to keep and impossible to recover later.
export const REQUIRED_STEMS = ["lead vocal", "dry vocal", "drums", "bass"];

export function masterProblems(spec: MasterSpec): string[] {
  const problems: string[] = [];
  if (spec.integrated_lufs > -8) problems.push("integrated_lufs: louder than -8 LUFS is a master that will be turned back down");
  if (spec.integrated_lufs < -18) problems.push("integrated_lufs: quieter than -18 LUFS is a master nobody hears over a playlist");
  if (spec.true_peak_db > -1) problems.push("true_peak_db: above -1 dBTP clips the lossy encode the service makes");
  if (spec.sample_rate < 44100) problems.push("sample_rate: below 44.1 kHz loses what the mix put there");
  if (spec.bit_depth < 24) problems.push("bit_depth: delivery is 24 bit");
  for (const stem of REQUIRED_STEMS) {
    if (!spec.stems.includes(stem)) problems.push(`stems: "${stem}" is missing, and it cannot be recovered from a mixdown`);
  }
  return problems;
}

export function deliverySheet(spec: MasterSpec, title: string): string {
  return [
    `${title}`,
    `master: ${spec.integrated_lufs} LUFS integrated, ${spec.true_peak_db} dBTP true peak, ${spec.bit_depth} bit ${spec.sample_rate / 1000} kHz`,
    `stems (${spec.stems.length}): ${spec.stems.join(", ")}`,
  ].join("\n");
}
