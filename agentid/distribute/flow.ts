// the shape of a distribution flow, so six of them are one thing instead of six.
//
// a flow is the whole road to a live release: make the account, confirm the email,
// upload the release, then claim the profiles. it is written down instead of
// discovered each run because the expensive failures repeat: an ISRC already live
// elsewhere, artwork at the wrong pixel count, an account opened in the owner's
// name, a release dated so soon the stores have not ingested it.

export type Lane = "browserbase" | "kernel" | "browseruse";

export interface LaneSpec {
  why: string;
  licence: string;
  hosted: boolean;
  // a wall lane takes over only when a login or an auth panel stands in the way
  wall_only: boolean;
}

export const LANES: Record<Lane, LaneSpec> = {
  browserbase: {
    why: "the default: a hosted session over CDP, no desktop, one lane per run",
    licence: "commercial service",
    hosted: true,
    wall_only: false,
  },
  kernel: {
    why: "the wall: a saved login or an auth panel that a fresh session cannot pass",
    licence: "commercial service",
    hosted: true,
    wall_only: true,
  },
  browseruse: {
    why: "the self hosted fallback when neither hosted lane is available or wanted",
    licence: "MIT",
    hosted: false,
    wall_only: false,
  },
};

export type LaneSwitch = { lane?: Lane; wall?: boolean };

export type PhaseName = "signup" | "verify" | "release" | "claim";
export const PHASE_ORDER: PhaseName[] = ["signup", "verify", "release", "claim"];

export type Action = "navigate" | "click" | "type" | "upload" | "read" | "wait" | "screenshot" | "stop";

export interface Step {
  id: string;
  action: Action;
  // what we act on, in words. never a css selector guessed from a screenshot.
  target: string;
  // a field key the internative owns (identity), never a value
  value?: string;
  // true when only the owner can answer this, and the run ends here
  owner?: boolean;
  optional?: boolean;
  note: string;
}

export interface Phase {
  name: PhaseName;
  steps: Step[];
}

export interface DistributorFlow {
  id: string;
  name: string;
  host: string;
  signup_url: string;
  dashboard_url: string;
  cost: "free" | "free-tier";
  // what the distributor keeps
  commission_pct: number;
  lane_default: Lane;
  lanes: Lane[];
  phases: Phase[];
  // what the delivery has to be, so it is converted once instead of rejected twice
  audio: { accepts: string[]; stereo: boolean; max_mb?: number; note: string };
  artwork: { min_pixels: number; square: boolean; max_mb?: number; accepts?: string[]; note: string };
  // how far ahead the stores need the delivery, in days
  lead_days: { min: number; note: string };
  // what happens between submit and live, in the distributor words
  review: { moderation: string; live_in: string };
  payout?: { threshold?: string; note: string };
  // the sender domains that may send a confirmation for this host
  verification: { senders: string[]; window_minutes: number };
  // where the mapping came from, and whether it has been run
  sources: string[];
  verified: boolean;
  note: string;
}

export const RELEASE_FIELDS = [
  "title",
  "artist_name",
  "rights_holder",
  "genre",
  "language",
  "release_date",
  "explicit",
  "ai_disclosure",
  "isrc",
  "upc",
  "artwork",
  "audio_master",
  "lyrics",
] as const;

const SECRET_SHAPED = /(?:sk_|pk_|Bearer\s|^[A-Za-z0-9]{28,}$)/;

export function flowProblems(flow: DistributorFlow): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9-]+$/.test(flow.id)) problems.push(`${flow.id}: id is a slug, lower case and dashes`);
  for (const url of [flow.signup_url, flow.dashboard_url]) {
    if (!url.startsWith("https://")) problems.push(`${flow.id}: ${url} is not https`);
  }
  const names = flow.phases.map((p) => p.name);
  for (const wanted of PHASE_ORDER) {
    if (!names.includes(wanted)) problems.push(`${flow.id}: no ${wanted} phase`);
  }
  for (const phase of flow.phases) {
    if (!phase.steps.length) problems.push(`${flow.id}: ${phase.name} has no steps`);
    for (const step of phase.steps) {
      if (!step.note.trim()) problems.push(`${flow.id}: ${phase.name}/${step.id} has no note, so nobody knows why`);
      if (step.value && SECRET_SHAPED.test(step.value)) {
        problems.push(`${flow.id}: ${step.id} carries a secret shaped value, and this file is committed`);
      }
      if (step.action === "stop" && !step.owner) {
        problems.push(`${flow.id}: ${step.id} stops the run without naming the owner`);
      }
      if (step.action === "upload" && !step.value) {
        problems.push(`${flow.id}: ${step.id} uploads nothing`);
      }
    }
  }
  const stops = flow.phases.flatMap((p) => p.steps).filter((s) => s.owner);
  if (!stops.some((s) => /terms|contract|licen[cs]e/i.test(`${s.target} ${s.note}`))) {
    problems.push(`${flow.id}: no terms stop, and the owner accepts terms, not the agent`);
  }
  if (!stops.some((s) => /submit|publish|release/i.test(`${s.target} ${s.note}`))) {
    problems.push(`${flow.id}: no submit stop, so a release could go out unreviewed`);
  }
  if (!flow.audio.accepts.length) problems.push(`${flow.id}: says nothing about what audio it takes`);
  if (flow.lead_days.min < 0) problems.push(`${flow.id}: a negative lead time is not a lead time`);
  if (!flow.lead_days.note.trim()) problems.push(`${flow.id}: lead time has no reason`);
  if (!flow.review.live_in.trim()) problems.push(`${flow.id}: says nothing about when it goes live`);
  if (flow.payout && !flow.payout.note.trim()) problems.push(`${flow.id}: payout with no terms`);
  if (flow.artwork.min_pixels < 1400) problems.push(`${flow.id}: artwork floor below 1400 px, which most stores reject`);
  if (!flow.verification.senders.length) problems.push(`${flow.id}: no sender domain, so a confirmation cannot be trusted`);
  if (flow.verification.window_minutes > 60) problems.push(`${flow.id}: a confirmation window over an hour is not a window`);
  if (!flow.lanes.includes(flow.lane_default)) problems.push(`${flow.id}: default lane ${flow.lane_default} is not in its lane list`);
  if (flow.verified && !flow.sources.length) problems.push(`${flow.id}: claims verified with no source`);
  if (!flow.verified && !/not (yet )?run|template|unverified/i.test(flow.note)) {
    problems.push(`${flow.id}: unverified flows have to say so in the note`);
  }
  return problems;
}

// which browser takes this run. a wall is the only reason to leave the default.
export function laneFor(flow: DistributorFlow, opts: LaneSwitch = {}): { lane?: Lane; problems: string[] } {
  const problems: string[] = [];
  if (!flow.verified) {
    const why = flow.sources.length ? "not verified, so no run until a pass reads its pages" : "no terms read yet, so there is nothing to run";
    return { problems: [`${flow.id}: ${why}`] };
  }
  if (opts.wall) {
    if (!flow.lanes.includes("kernel")) problems.push(`${flow.id}: does not list kernel for a wall`);
    return { lane: "kernel", problems };
  }
  const wanted = opts.lane ?? flow.lane_default;
  if (!flow.lanes.includes(wanted)) {
    problems.push(`${flow.id}: ${wanted} is not one of its lanes (${flow.lanes.join(", ")})`);
    return { problems };
  }
  if (LANES[wanted].wall_only) {
    problems.push(`${wanted} only takes a wall, and there is no wall here`);
    return { problems };
  }
  return { lane: wanted, problems };
}

export function ownerStops(flow: DistributorFlow): Step[] {
  return flow.phases.flatMap((p) => p.steps).filter((s) => s.owner);
}

export function phaseOf(flow: DistributorFlow, name: PhaseName): Phase | undefined {
  return flow.phases.find((p) => p.name === name);
}

// the lanes a run can be switched between, in the order they are tried
export const LANE_ORDER: Lane[] = ["browserbase", "browseruse", "kernel"];

// a paid service is named here now and built later. the folder exists so the
// decision is visible, and the constant exists so nothing silently treats a
// placeholder as a route.
export interface PendingFlow {
  id: string;
  name: string;
  host: string;
  cost: string;
  why_later: string;
}

export function pendingProblems(pending: PendingFlow): string[] {
  return [`${pending.id}: paid service, no flow yet (${pending.why_later})`];
}
