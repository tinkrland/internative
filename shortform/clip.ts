// a clip, as a plan before it is a file.
//
// the failure mode this module exists to prevent: a vertical clip that
// opens with setup, buries the point at second nine, and ends on "follow
// for more" because a template said so. so the plan is explicit about its
// one idea, its hook, its payoff, and the persona's own rules about calls
// to action and emoji are enforced rather than hoped for.
//
// timing is planned from the words, not guessed: speech runs about 2.6
// words a second at a conversational pace, and the constant is here, not
// scattered through the renderer.

import type { ResolvedRegister } from "../persona/registers.ts";

export const WORDS_PER_SECOND = 2.6;
// the breath after a line. short enough that a clip does not sag, long
// enough that two sentences do not run together.
export const LINE_PAUSE_SEC = 0.35;

export interface ClipSource {
  uri: string;
  kind: "stream" | "meeting" | "written" | "asset";
  note?: string;
}

export interface ClipPlan {
  // the one idea. if this needs an "and", it is two clips.
  idea: string;
  // the first line. it is the point, not the setup.
  hook: string;
  // the payoff, in order. at least one beat.
  beats: string[];
  // what the viewer leaves with. required: a clip with no payoff is a
  // thumbnail with sound.
  payoff: string;
  // optional loop line that sends the clip back to its hook
  close?: string;
  durationSeconds: number;
  source?: ClipSource;
}

export function spokenSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  return Number((words / WORDS_PER_SECOND).toFixed(2));
}

export function plannedSeconds(plan: ClipPlan): number {
  const lines = [plan.hook, ...plan.beats, plan.payoff, ...(plan.close ? [plan.close] : [])];
  const speech = lines.reduce((total, line) => total + spokenSeconds(line), 0);
  return Number((speech + LINE_PAUSE_SEC * Math.max(0, lines.length - 1)).toFixed(2));
}

export interface ClipCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
  plannedSeconds: number;
}

const CTA_PATTERNS = [
  /follow (me|for more)/i,
  /like and subscribe/i,
  /link in bio/i,
  /smash that/i,
  /drop a comment/i,
];

const EMOJI = /\p{Extended_Pictographic}/u;

// validate a plan against the network ceiling and the persona's register.
// errors mean the clip must not render; warnings mean it will render and
// something about it is thin.
export function checkClip(
  plan: ClipPlan,
  opts: {
    maxDurationSec: number;
    register: ResolvedRegister;
  },
): ClipCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan.idea.trim()) errors.push("idea: a clip needs one idea");
  if (!plan.hook.trim()) errors.push("hook: the first line is required");
  else if (plan.hook.trim().split(/\s+/).length > 12) {
    warnings.push("hook: over twelve words is setup, not a hook");
  }
  if (!plan.payoff.trim()) errors.push("payoff: a clip without one is a thumbnail with sound");
  if (plan.beats.length === 0) warnings.push("beats: a single line clip is a still, not a clip");
  if (plan.beats.length > 5) warnings.push("beats: more than five and the clip is a montage");

  for (const line of [plan.hook, ...plan.beats, plan.payoff, plan.close ?? ""]) {
    if (opts.register.emoji === "none" && EMOJI.test(line)) {
      errors.push(`emoji: the register for this surface has emoji policy "none", and this line has one: ${line.slice(0, 40)}`);
    }
  }
  if (!opts.register.cta) {
    for (const line of [plan.hook, ...plan.beats, plan.payoff, plan.close ?? ""]) {
      if (CTA_PATTERNS.some((re) => re.test(line))) {
        errors.push(`cta: this surface allows no call to action, and this line has one: ${line.slice(0, 40)}`);
      }
    }
  }
  if (opts.register.max_sentences && plan.beats.length > opts.register.max_sentences) {
    warnings.push(`beats: register allows ${opts.register.max_sentences} sentences on this surface`);
  }

  const seconds = plannedSeconds(plan);
  if (plan.durationSeconds > opts.maxDurationSec) {
    errors.push(`duration: ${plan.durationSeconds}s is over the ${opts.maxDurationSec}s ceiling`);
  }
  if (seconds > opts.maxDurationSec) {
    errors.push(`duration: the script runs ${seconds}s, over the ${opts.maxDurationSec}s ceiling`);
  }
  if (seconds > plan.durationSeconds + 0.5) {
    errors.push(`duration: the script runs ${seconds}s but the plan budgets ${plan.durationSeconds}s`);
  }
  if (plan.durationSeconds - seconds > 3) {
    warnings.push(`duration: ${Math.round(plan.durationSeconds - seconds)}s of the budget is unspoken`);
  }

  return { ok: errors.length === 0, errors, warnings, plannedSeconds: seconds };
}

// plan a clip from what the surface actually has: an idea and some lines.
// the hook is the first line given, and nothing invents a call to action.
export function planClip(input: {
  idea: string;
  lines: string[];
  source?: ClipSource;
}): ClipPlan {
  if (input.lines.length < 2) {
    throw new Error("clip: at least a hook and a payoff line");
  }
  const [hook, ...rest] = input.lines;
  const payoff = rest[rest.length - 1];
  const beats = rest.slice(0, -1);
  const plan: ClipPlan = {
    idea: input.idea.trim(),
    hook: hook.trim(),
    beats: beats.map((b) => b.trim()),
    payoff: payoff.trim(),
    durationSeconds: 0,
    source: input.source,
  };
  plan.durationSeconds = Math.ceil(plannedSeconds(plan));
  return plan;
}
