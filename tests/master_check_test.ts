import { assertEquals } from "jsr:@std/assert@1";
import { loudnessProblems, measureLoudness, normaliseArgs, parseLoudnorm } from "../music/master_check.ts";
import { STREAMING_TARGET } from "../music/master.ts";
import { toolsAvailable } from "./tools.ts";

const stderr = `
[Parsed_loudnorm_0 @ 0x55] 
{
	"input_i" : "-9.02",
	"input_tp" : "-8.99",
	"input_lra" : "0.00",
	"input_thresh" : "-19.02",
	"output_i" : "-24.02",
	"output_tp" : "-23.99",
	"output_lra" : "0.00",
	"output_thresh" : "-34.02",
	"normalization_type" : "dynamic",
	"target_offset" : "0.24"
}
`;

Deno.test("the loudness json ffmpeg prints is read as a measurement", () => {
  const measured = parseLoudnorm(stderr)!;
  assertEquals(measured.integrated_lufs, -9.02);
  assertEquals(measured.true_peak_db, -8.99);
  assertEquals(measured.lra, 0);
  assertEquals(parseLoudnorm("no json here"), undefined);
});

Deno.test("the last pass wins, because loudnorm prints one object per pass", () => {
  const twoPasses = `{"input_i" : "-20.00", "input_tp" : "-18.00", "input_lra" : "1.00"}\n{"input_i" : "-14.10", "input_tp" : "-1.20", "input_lra" : "6.00"}`;
  const measured = parseLoudnorm(twoPasses)!;
  assertEquals(measured.integrated_lufs, -14.1);
  assertEquals(measured.true_peak_db, -1.2);
});

Deno.test("a master is judged in the units its contract is written in", () => {
  const onSpec = { integrated_lufs: -14.2, true_peak_db: -1.3, lra: 6 };
  assertEquals(loudnessProblems(onSpec, STREAMING_TARGET), []);
  const loud = loudnessProblems({ ...onSpec, integrated_lufs: -11.4 }, STREAMING_TARGET);
  assertEquals(loud.some((p) => p.includes("louder by 2.6")), true);
  const clipping = loudnessProblems({ ...onSpec, true_peak_db: -0.2 }, STREAMING_TARGET);
  assertEquals(clipping.some((p) => p.includes("dBTP ceiling")), true);
});

Deno.test("normalising is two passes: measure, then apply the measurement", () => {
  const args = normaliseArgs("mix.wav", { integrated_lufs: -20, true_peak_db: -6, lra: 5 });
  assertEquals(args.includes("volume=6.00dB,loudnorm=I=-14:TP=-1:LRA=11:linear=true"), true, "the gain comes from the measurement, not from a guess");
  assertEquals(args.includes("pcm_s24le"), true);
  const louder = normaliseArgs("mix.wav", { integrated_lufs: -9, true_peak_db: -2, lra: 4 });
  assertEquals(louder.some((a) => a.startsWith("volume=-5.00dB")), true, "a loud mix is turned down, not up");
});

Deno.test({
  name: "a real file is measured with ffmpeg, and a quiet tone is caught",
  ignore: !toolsAvailable("ffmpeg", "ffprobe"),
  fn: async () => {
  const dir = await Deno.makeTempDir();
  const tone = `${dir}/-9lufs.wav`;
  const made = await new Deno.Command("ffmpeg", {
    args: ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=1000:duration=3:sample_rate=48000", "-af", "volume=-6dB", "-c:a", "pcm_s24le", tone],
    stdout: "null",
    stderr: "null",
  }).output();
  assertEquals(made.success, true);

  const result = await measureLoudness(tone);
  assertEquals(result.problems, []);
  const measured = result.measurement!;
  assertEquals(Number.isFinite(measured.integrated_lufs), true);

  // the same tone six dB louder must measure six LU louder. that is the property
  // that matters: the meter tracks the gain, whatever this build's sine level is.
  const loudTone = `${dir}/louder.wav`;
  await new Deno.Command("ffmpeg", {
    args: ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=1000:duration=3:sample_rate=48000", "-af", "volume=0dB", "-c:a", "pcm_s24le", loudTone],
    stdout: "null",
    stderr: "null",
  }).output();
  const louder = (await measureLoudness(loudTone)).measurement!;
  assertEquals(Math.abs(louder.integrated_lufs - measured.integrated_lufs - 6) < 0.2, true, "six dB of gain is six LU");

  const against = loudnessProblems(measured, STREAMING_TARGET);
  assertEquals(against.some((p) => p.includes("quieter by")), true, "a test tone is not a master");

  const silent = `${dir}/silent.wav`;
  await new Deno.Command("ffmpeg", {
    args: ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "2", silent],
    stdout: "null",
    stderr: "null",
  }).output();
  const quiet = await measureLoudness(silent);
  assertEquals(quiet.problems.some((p) => p.includes("no loudness")), true);

  const missing = await measureLoudness(`${dir}/not-a-file.wav`);
  assertEquals(missing.problems.length > 0, true);
  await Deno.remove(dir, { recursive: true });
  },
});
