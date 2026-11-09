// the lane that actually does it, and the points where it must stop.
//
// browserbase first, always: it is the lane the rest of clawbuzz already speaks.
// kernel gets the login wall when a signup needs an authenticated session, and it
// gets it only there. both are handed the same steps, so a swap is a config change
// and not a rewrite.

import type { SignupPlan } from "./signup.ts";

export type Lane = "browserbase" | "kernel";

export type Step =
  | { act: "navigate"; url: string }
  | { act: "clear_consent"; why: string }
  | { act: "type"; field: string; value: string }
  | { act: "click"; label: string; why: string }
  | { act: "screenshot"; name: string }
  | { act: "stop"; reason: string; needs: "owner" | "inbox" };

export function chooseLane(needs_authenticated_session: boolean, has_kernel: boolean): Lane {
  if (!needs_authenticated_session) return "browserbase";
  return has_kernel ? "kernel" : "browserbase";
}

// the plan becomes steps, in the order that survives a real page: banner before
// typing, typing before clicking, a screenshot before and after the submit, and a
// stop wherever the human owns the answer.
export function stepsFor(plan: SignupPlan, opts: { consent_labels?: string[] } = {}): Step[] {
  const steps: Step[] = [{ act: "navigate", url: plan.start_url }];
  if (opts.consent_labels?.length) {
    steps.push({ act: "clear_consent", why: "cookies are refused before anything is typed" });
  }
  if (plan.fill.email) steps.push({ act: "type", field: "email", value: plan.fill.email });
  if (plan.fill.username) steps.push({ act: "type", field: "username", value: plan.fill.username });
  if (plan.fill.name) steps.push({ act: "type", field: "name", value: plan.fill.name });
  if (plan.fill.password) steps.push({ act: "type", field: "password", value: "(generated, written straight to the secret store)" });
  steps.push({ act: "screenshot", name: `${plan.host}-before-submit` });
  steps.push({ act: "click", label: "submit", why: "one submit, then the page decides" });

  for (const stop of plan.stops) {
    if (/captcha|card|terms/.test(stop)) steps.push({ act: "stop", reason: stop, needs: "owner" });
    if (/phone|one-time|birth date/.test(stop)) steps.push({ act: "stop", reason: stop, needs: stop.includes("one-time") ? "inbox" : "owner" });
  }
  steps.push({ act: "stop", reason: "verification email: wait for it in the internative inbox", needs: "inbox" });
  return steps;
}

export function browserBrief(plan: SignupPlan, lane: Lane): string {
  const fills = Object.entries(plan.fill).map(([k, v]) => `${k}=${v}`).join(", ");
  return [
    `lane: ${lane}`,
    `host: ${plan.host}`,
    `attempt: ${plan.attempt} of 2`,
    `fill: ${fills || "nothing"}`,
    `handoff: ${plan.handoff.join(", ") || "none"}`,
    `stops: ${plan.stops.length}`,
    "rule: one submit click, screenshots both sides of it, and no second account on the same host",
  ].join("\n");
}
