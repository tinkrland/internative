// a flow is a claim about a page. a probe is how the claim is checked without
// opening an account.
//
// every flow here was written from public pages, and public pages change: a field is
// renamed, a label becomes a dropdown, the terms box moves to a modal. the probe
// reads a page, compares what is on it with what the flow expects, and reports the
// drift. nothing is typed into a probe and nothing is submitted by one.

import type { DistributorFlow, Phase, PhaseName, Step } from "./flow.ts";
import { laneFor, type LaneSwitch } from "./flow.ts";

export interface PageSnapshot {
  url: string;
  // the visible field labels, in page order
  labels: string[];
  // the visible button and link texts
  buttons: string[];
}

export interface PhaseProbe {
  flow_id: string;
  phase: PhaseName;
  url: string;
  // step ids the page still supports
  found: string[];
  // step ids the page no longer shows
  missing: string[];
  // page text that no step accounts for
  extras: string[];
  // the first owner stop in the phase, which is where a run would end
  stops_at?: string;
  // owner stops whose field the page no longer shows
  stops_missing?: string[];
  // which page of the phase this probe looked at
  page?: string;
}

const NOISE = new Set([
  "the", "a", "an", "and", "or", "for", "with", "into", "onto", "from",
  "its", "this", "that", "their", "your", "any", "once", "then", "again",
  // structural words: what kind of widget it is, not what it says
  "field", "button", "page", "link", "box", "form", "modal", "screen", "dropdown",
]);

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// the words in a step target that a page would have to show to prove it is the
// same page. short words and filler are dropped, because "the" matches everything.
export function keywordsFor(step: Step): string[] {
  return normalize(step.target)
    .split(" ")
    .filter((w) => w.length > 3 && !NOISE.has(w));
}

// steps that only a live run performs: a probe reads, it does not act
const NON_READING = new Set(["stop", "screenshot", "wait"]);

// prose targets and page labels rarely agree on the ending: "creates" against
// "Create Release", "copyright line" against "Composition Copyright". so a word
// matches on its first five letters, which is the shortest prefix that still tells
// "genre" from "general".
export function matches(word: string, tokens: string[]): boolean {
  const w = word.toLowerCase();
  return tokens.some((token) => {
    if (token === w) return true;
    // a plural or a tense is one letter away. a different word that merely starts
    // the same way, "record" and "recording", is further than that and is not a match.
    if (w.length < 5 || token.length < 5) return false;
    const near = token.startsWith(w) || w.startsWith(token);
    return near && Math.abs(token.length - w.length) <= 2;
  });
}

export function probePhase(
  flow: DistributorFlow,
  phaseName: PhaseName,
  snapshot: PageSnapshot,
): PhaseProbe {
  const phase: Phase | undefined = flow.phases.find((p) => p.name === phaseName);
  const tokens = normalize([...snapshot.labels, ...snapshot.buttons].join(" ")).split(" ").filter(Boolean);
  const found: string[] = [];
  const missing: string[] = [];
  const covered = new Set<string>();
  let stops_at: string | undefined;
  const stops_missing: string[] = [];

  for (const step of phase?.steps ?? []) {
    if (step.owner) {
      // a stop is only a stop while the field it guards is still on the page.
      // otherwise the run sails past a question that belongs to the owner.
      const visible = keywordsFor(step).some((w) => matches(w, tokens));
      if (visible && !stops_at) stops_at = step.id;
      if (!visible) stops_missing.push(step.id);
    }
    if (NON_READING.has(step.action)) continue;
    const words = keywordsFor(step);
    for (const w of words) covered.add(w);
    const hits = words.filter((w) => matches(w, tokens)).length;
    const score = words.length ? hits / words.length : 0;
    const hit = words.length > 0 && score >= 0.5 && (matches(words[0], tokens) || score >= 0.75);
    if (hit) found.push(step.id);
    else missing.push(step.id);
  }

  const extras = [...snapshot.labels, ...snapshot.buttons]
    .filter((label) => {
      const words = normalize(label).split(" ").filter((w) => w.length > 3 && !NOISE.has(w));
      return words.length > 0 && !words.some((w) => covered.has(w));
    })
    .slice(0, 20);

  return { flow_id: flow.id, phase: phaseName, url: snapshot.url, found, missing, extras, stops_at, stops_missing };
}

// a missing step is not always drift: a page can move a field without changing the
// road. these are the ones whose absence means the flow is wrong, not stale.
const MUST_FIND = /terms|submit|audio|artwork|title|label|genre|upload/i;

export function probeProblems(probes: PhaseProbe[]): string[] {
  const problems: string[] = [];
  for (const probe of probes) {
    for (const id of probe.missing) {
      if (MUST_FIND.test(id)) problems.push(`${probe.flow_id}/${probe.phase}: ${id} is gone, so the flow no longer matches the page`);
    }
    for (const id of probe.stops_missing ?? []) {
      problems.push(`${probe.flow_id}/${probe.phase}: the ${id} stop is gone, so the agent would answer what the owner owns`);
    }
    if (probe.phase === "signup" && !probe.stops_at) {
      problems.push(`${probe.flow_id}/signup: no stop found, and a signup page with no terms box is not the page we mapped`);
    }
  }
  return problems;
}

export function probeAllowed(flow: DistributorFlow, opts: LaneSwitch = {}): string[] {
  const { problems } = laneFor(flow, opts);
  return problems;
}

// a phase can span several pages: routenote alone walks release data, album
// details, audio, artwork, stores and finalise. so a probe is per page, and the
// caller names the steps that page is supposed to show.
export interface PageSlice {
  phase: PhaseName;
  page: string;
  steps: string[];
}

export function probePage(
  flow: DistributorFlow,
  slice: PageSlice,
  snapshot: PageSnapshot,
): PhaseProbe {
  const phase = flow.phases.find((p) => p.name === slice.phase);
  const wanted = (phase?.steps ?? []).filter((s) => slice.steps.includes(s.id));
  const narrowed: DistributorFlow = {
    ...flow,
    phases: [{ name: slice.phase, steps: wanted }],
  };
  const probe = probePhase(narrowed, slice.phase, snapshot);
  return { ...probe, phase: slice.phase, page: slice.page } as PhaseProbe & { page: string };
}
