import { assertEquals } from "jsr:@std/assert@1";
import { checkPlan, plannedSeconds, type EpisodePlan } from "../episode.ts";

function plan(): EpisodePlan {
  return {
    title: "the plate is the product",
    promise: "a real render survives a second visit",
    coldOpen: "every generated background drifts, and the drift is the tell. this is the argument against it.",
    turn: "the point is not realism, it is repeatability.",
    close: "next month, the light rig.",
    targetRuntimeSeconds: 900,
    chapters: [
      { title: "the drift", claim: "generated backgrounds do not survive a second visit", evidence: "two frames from the same prompt", seconds: 240 },
      { title: "the lens", claim: "a pinned camera makes the frame repeatable", evidence: "the same shot across eight renders", seconds: 300 },
      { title: "the trade", claim: "repeatability costs time you have to budget", evidence: "render logs from one month", seconds: 240 },
    ],
  };
}

Deno.test("a planned episode passes", () => {
  const check = checkPlan(plan());
  assertEquals(check.ok, true, check.errors.join("; "));
  assertEquals(plannedSeconds(plan()), 780);
});

Deno.test("a chapter without evidence is an assertion", () => {
  const bad = plan();
  bad.chapters[1].evidence = "";
  const check = checkPlan(bad);
  assertEquals(check.ok, false);
  assertEquals(check.errors.some((e) => e.includes("evidence is required")), true);
});

Deno.test("fewer than three chapters loses the chapter list", () => {
  const bad = plan();
  bad.chapters = bad.chapters.slice(0, 2);
  assertEquals(checkPlan(bad).errors.some((e) => e.startsWith("chapters")), true);
});

Deno.test("a chapter under ten seconds is refused", () => {
  const bad = plan();
  bad.chapters[0].seconds = 6;
  assertEquals(checkPlan(bad).errors.some((e) => e.includes("10s minimum")), true);
});

Deno.test("a stream vod is not long form unless the caller says so", () => {
  const vod = { ...plan(), source: { kind: "stream_vod" as const, uri: "https://example.com/v/1" } };
  const refused = checkPlan(vod);
  assertEquals(refused.ok, false);
  assertEquals(refused.errors.some((e) => e.startsWith("source:")), true);
  assertEquals(checkPlan({ ...vod, allowRepublish: true }).ok, true);
});

Deno.test("an overrun is refused, an underrun is a warning", () => {
  const over = { ...plan(), targetRuntimeSeconds: 300 };
  assertEquals(checkPlan(over).errors.some((e) => e.startsWith("runtime")), true);
  const check = checkPlan({ ...plan(), targetRuntimeSeconds: 1800 });
  assertEquals(check.warnings.some((w) => w.startsWith("runtime")), true);
  assertEquals(check.ok, true);
});

Deno.test("a missing promise or cold open stops the plan", () => {
  assertEquals(checkPlan({ ...plan(), promise: "" }).errors.some((e) => e.startsWith("promise")), true);
  assertEquals(checkPlan({ ...plan(), coldOpen: "" }).errors.some((e) => e.startsWith("cold_open")), true);
});

Deno.test("a missing turn is a warning, not a refusal", () => {
  const check = checkPlan({ ...plan(), turn: "" });
  assertEquals(check.ok, true);
  assertEquals(check.warnings.some((w) => w.startsWith("turn")), true);
});
