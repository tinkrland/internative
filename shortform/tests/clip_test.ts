import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { checkClip, LINE_PAUSE_SEC, planClip, plannedSeconds, spokenSeconds, WORDS_PER_SECOND } from "../clip.ts";
import { resolveRegister } from "../../persona/registers.ts";
import { loadPersonaFile } from "../../persona/loader.ts";

const EXAMPLE = new URL("../../personas/example.persona.jsonc", import.meta.url).pathname;
const persona = await loadPersonaFile(EXAMPLE);
const register = resolveRegister(persona, "shortform", "tiktok");

const GOOD = planClip({
  idea: "the plate is a real render",
  lines: [
    "your background is a lie",
    "this one is geometry",
    "same lens, every frame",
    "that is why it never drifts",
  ],
});

Deno.test("speech is planned from words, not guessed", () => {
  assertEquals(spokenSeconds("one two three"), Number((3 / WORDS_PER_SECOND).toFixed(2)));
  assertEquals(spokenSeconds("   "), 0);
  const seconds = plannedSeconds(GOOD);
  const words = 5 + 4 + 4 + 6; // hook, two beats, payoff
  const expected = words / WORDS_PER_SECOND + LINE_PAUSE_SEC * 3;
  assertEquals(Math.abs(seconds - expected) < 0.02, true);
});

Deno.test("a well formed clip passes", () => {
  const check = checkClip(GOOD, { maxDurationSec: 180, register });
  assertEquals(check.ok, true, check.errors.join("; "));
});

Deno.test("a clip with no payoff is refused", () => {
  const bad = { ...GOOD, payoff: "" };
  const check = checkClip(bad, { maxDurationSec: 180, register });
  assertEquals(check.ok, false);
  assertEquals(check.errors.some((e) => e.startsWith("payoff")), true);
});

Deno.test("the network ceiling wins over the plan budget", () => {
  const long = " ".repeat(0) + Array.from({ length: 800 }, (_, i) => `word${i}`).join(" ");
  const plan = { ...GOOD, beats: [long], durationSeconds: 30 };
  const check = checkClip(plan, { maxDurationSec: 180, register });
  assertEquals(check.ok, false);
  assertEquals(check.errors.some((e) => e.includes("over the 180s ceiling")), true);
});

Deno.test("a plan that budgets less than the script runs is refused", () => {
  const plan = { ...GOOD, durationSeconds: 2 };
  const check = checkClip(plan, { maxDurationSec: 180, register });
  assertEquals(check.ok, false);
  assertEquals(check.errors.some((e) => e.includes("but the plan budgets")), true);
});

Deno.test("the register's emoji policy is enforced, not suggested", () => {
  const plan = { ...GOOD, payoff: "that is why it never drifts 🎬" };
  const check = checkClip(plan, { maxDurationSec: 180, register });
  assertEquals(check.ok, false);
  assertEquals(check.errors.some((e) => e.startsWith("emoji")), true);
});

Deno.test("a surface with no cta policy refuses one", () => {
  const plan = { ...GOOD, close: "follow for more plate content" };
  const check = checkClip(plan, { maxDurationSec: 180, register });
  assertEquals(check.ok, false);
  assertEquals(check.errors.some((e) => e.startsWith("cta")), true);
});

Deno.test("planning needs at least a hook and a payoff", () => {
  assertThrows(() => planClip({ idea: "x", lines: ["only a hook"] }), Error, "at least a hook");
});

Deno.test("a long hook is a warning, not a hard stop", () => {
  const wordy = { ...GOOD, hook: "so here is a thing that i have been thinking about for a while now" };
  const check = checkClip(wordy, { maxDurationSec: 180, register });
  assertEquals(check.warnings.some((w) => w.startsWith("hook")), true);
});
