// the master contract, measured instead of asserted.
//
// master.ts declares -14 LUFS integrated and -1 dBTP. this measures a real file and
// says whether the file agrees, using ffmpeg's loudnorm filter, which implements
// EBU R128 / ITU-R BS.1770 loudness. no wrapper library: the filter is already in
// the tool everyone has, and a wrapper would only hide which numbers came from where.

export interface Measurement {
  integrated_lufs: number;
  true_peak_db: number;
  lra: number;
}

export interface MeasureResult {
  measurement?: Measurement;
  problems: string[];
}

const NUMBER = /"([a-z_]+)"\s*:\s*"(-?[0-9.]+|inf)"/g;

// parse the json block loudnorm prints to stderr. it prints one object per pass and
// the last one wins, which is why this walks every match and keeps the last.
export function parseLoudnorm(stderr: string): Measurement | undefined {
  const values = new Map<string, string>();
  for (const match of stderr.matchAll(NUMBER)) values.set(match[1], match[2]);
  const read = (key: string) => {
    const raw = values.get(key);
    if (raw === undefined || raw === "inf" || raw === "-inf") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  const integrated = read("input_i");
  const truePeak = read("input_tp");
  const lra = read("input_lra") ?? 0;
  if (integrated === undefined || truePeak === undefined) return undefined;
  return { integrated_lufs: integrated, true_peak_db: truePeak, lra };
}

export async function measureLoudness(path: string): Promise<MeasureResult> {
  const problems: string[] = [];
  let output: Deno.CommandOutput;
  try {
    output = await new Deno.Command("ffmpeg", {
      args: ["-hide_banner", "-nostats", "-i", path, "-af", "loudnorm=print_format=json", "-f", "null", "-"],
      stdout: "null",
      stderr: "piped",
    }).output();
  } catch {
    return { problems: ["ffmpeg is not installed here, so nothing was measured"] };
  }
  const stderr = new TextDecoder().decode(output.stderr);
  if (!output.success && !stderr.includes("input_i")) {
    return { problems: [`ffmpeg could not read ${path}`] };
  }
  const measurement = parseLoudnorm(stderr);
  if (!measurement) problems.push(`${path}: no loudness in the output, so the file has no audio this can measure`);
  return { measurement, problems };
}

// how far off the contract a file is, in the units the contract is written in
export function loudnessProblems(measured: Measurement, target: { integrated_lufs: number; true_peak_db: number }, tolerance = 0.5): string[] {
  const problems: string[] = [];
  const off = measured.integrated_lufs - target.integrated_lufs;
  if (Math.abs(off) > tolerance) {
    problems.push(
      `integrated: ${measured.integrated_lufs.toFixed(1)} LUFS against a target of ${target.integrated_lufs}, which is ${off > 0 ? "louder" : "quieter"} by ${Math.abs(off).toFixed(1)}`,
    );
  }
  if (measured.true_peak_db > target.true_peak_db) {
    problems.push(`true peak: ${measured.true_peak_db.toFixed(1)} dBTP, above the ${target.true_peak_db} dBTP ceiling`);
  }
  return problems;
}

// the two pass shape, written down so nobody invents a third. pass one measures,
// pass two applies the measured values, and the gain is not guessed from a preview.
export function normaliseArgs(path: string, measured: Measurement, target = { integrated_lufs: -14, true_peak_db: -1 }): string[] {
  const offset = (target.integrated_lufs - measured.integrated_lufs).toFixed(2);
  return [
    "-hide_banner",
    "-i",
    path,
    "-af",
    `volume=${offset}dB,loudnorm=I=${target.integrated_lufs}:TP=${target.true_peak_db}:LRA=11:linear=true`,
    "-c:a",
    "pcm_s24le",
  ];
}
