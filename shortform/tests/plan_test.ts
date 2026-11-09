import { assertEquals } from "jsr:@std/assert@1";
import { buildClipJob, jobReady } from "../plan.ts";
import { planClip } from "../clip.ts";

const PLAN = planClip({
  idea: "one idea",
  lines: [
    "your background is a lie",
    "this one is geometry",
    "that is why it never drifts",
  ],
});

Deno.test("a clip job carries the ratio, the bands and the cover", () => {
  const job = buildClipJob(PLAN, "tiktok", { fitHeight: 0.78, anchorY: 0.08 });
  assertEquals(job.frame.width, 1080);
  assertEquals(job.frame.height, 1920);
  assertEquals(job.target.safeTop, 0.14);
  assertEquals(job.usable.top, 0.14);
  assertEquals(Math.round(job.usable.bottom * 100), 86);
  assertEquals(job.cover.width, 1080);
  assertEquals(job.cover.height, 1920);
  assertEquals(job.safe, true, "the vertical bands moved the authored framing");
});

Deno.test("the framing is clamped into the bands, not cropped by the renderer", () => {
  const job = buildClipJob(PLAN, "tiktok", { fitHeight: 0.95, anchorY: 0.02 });
  assertEquals(job.placement.fitHeight <= 0.72 + 0.0001, true);
  assertEquals(job.placement.anchorY, 0.14);
});

Deno.test("the caption timing fits inside the clip", () => {
  const job = buildClipJob(PLAN, "reels", { fitHeight: 0.78, anchorY: 0.08 });
  const last = job.captions.at(-1)!;
  assertEquals(last.endSec <= job.durationSeconds + 0.05, true);
});

Deno.test("readiness names every reason a job is not renderable", () => {
  const job = buildClipJob(PLAN, "tiktok", { fitHeight: 0.78, anchorY: 0.08 });
  const ready = jobReady(job);
  assertEquals(ready.ready, false);
  assertEquals(ready.reasons.some((r) => r.startsWith("spec:")), true, "the tiktok limits are flagged as unverified");
});

Deno.test("a spec that has no unverified note and a fitting placement is ready", () => {
  const job = buildClipJob(PLAN, "tiktok", { fitHeight: 0.6, anchorY: 0.2 });
  const verified = { ...job, spec: { ...job.spec, verified: true } };
  const ready = jobReady(verified);
  assertEquals(ready.ready, true, ready.reasons.join("; "));
});

Deno.test("a placement taller than the usable band is refused", () => {
  const job = buildClipJob(PLAN, "tiktok", { fitHeight: 0.6, anchorY: 0.2 });
  const taller = { ...job, placement: { fitHeight: 0.9, anchorY: 0.2 }, spec: { ...job.spec, verified: true } };
  const ready = jobReady(taller);
  assertEquals(ready.ready, false);
  assertEquals(ready.reasons.some((r) => r.includes("does not fit")), true);
});
