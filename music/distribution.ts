// how a song actually reaches a store, which is a browser job and not an api one.
//
// there is no open upload endpoint anywhere in the chain. a distributor takes a
// release through its own web app, a human confirms a tax form, and spotify only
// learns the artist exists once a release has been delivered. so this module plans a
// browser session rather than pretending to have an api: it says what to navigate to,
// what to type, and where it must stop and wait for a person.
//
// two rules are load bearing:
//   * the browser preps, a human submits. no automated account creation, ever, because
//     every one of these services forbids it and the tax form is not ours to sign.
//   * an internative is the artist name, never the rights holder. the stores ask for
//     both and they are not the same thing.

import type { Release } from "./release.ts";

// the head owns the internative and hands this over. the shape is repeated here
// rather than imported because this branch is orphaned on purpose: it vendors
// nothing, and a copy of one interface is cheaper than a dependency.
export interface ArtistIdentity {
  artist_name: string;
  rights_holder: string;
  aipn: string;
}

export type Automation = "assisted" | "manual";

export interface Distributor {
  id: string;
  name: string;
  home: string;
  cost: "free" | "commission";
  // the share the distributor keeps of streaming revenue, in percent
  commission_pct: number;
  stores: string[];
  requires: string[];
  claim_path: string;
  automation: Automation;
  // true only when the service was looked at in this pass and the terms read
  verified: boolean;
  note: string;
}

// read on 8 november 2026. a distributor that has not been read is not listed as
// verified, and an unverified one is refused rather than tried.
export const DISTRIBUTORS: Distributor[] = [
  {
    id: "soundon",
    name: "SoundOn",
    home: "https://www.soundon.global",
    cost: "free",
    commission_pct: 0,
    stores: ["spotify", "apple-music", "tiktok", "youtube-music", "amazon"],
    requires: ["tiktok account", "legal name", "tax form", "payout details", "artwork 3000x3000", "wav 24 bit"],
    claim_path: "spotify for artists after delivery",
    automation: "assisted",
    verified: true,
    note: "the tiktok owned distributor, which is why a song can be a tiktok sound on day one and a spotify track on day two",
  },
  {
    id: "routenote",
    name: "RouteNote",
    home: "https://routenote.com",
    cost: "commission",
    commission_pct: 15,
    stores: ["spotify", "apple-music", "amazon", "deezer", "tidal", "youtube content id"],
    requires: ["legal name", "tax form", "payout details", "artwork 3000x3000", "wav 16 or 24 bit"],
    claim_path: "spotify for artists after delivery",
    automation: "assisted",
    verified: true,
    note: "free to upload and keeps 15 percent. the widest store list of the free tier, and the paid tier exists when a release needs a fixed date",
  },
  {
    id: "indiefy",
    name: "Indiefy",
    home: "https://indiefy.net",
    cost: "free",
    commission_pct: 0,
    stores: ["spotify", "apple-music", "amazon", "deezer", "tiktok"],
    requires: ["legal name", "tax form", "artwork 3000x3000", "wav"],
    claim_path: "spotify for artists after delivery",
    automation: "assisted",
    verified: true,
    note: "no upfront fee and a smaller store list. reviews are mixed, so this is a second delivery rather than a first one",
  },
  {
    id: "freecords",
    name: "Freecords",
    home: "https://www.freecords.com",
    cost: "commission",
    commission_pct: 5,
    stores: ["spotify", "apple-music", "amazon", "deezer", "youtube-music"],
    requires: ["legal name", "tax form", "artwork", "wav"],
    claim_path: "spotify for artists after delivery",
    automation: "assisted",
    verified: true,
    note: "the lowest commission of the set at 5 percent of streaming revenue, on a smaller store list",
  },
  {
    id: "jumpstr",
    name: "Jumpstr",
    home: "https://app.jumpstr.io",
    cost: "free",
    commission_pct: 0,
    stores: ["spotify", "apple-music", "amazon", "tidal", "tiktok", "youtube-music"],
    requires: ["legal name", "tax form", "artwork", "wav"],
    claim_path: "spotify for artists after delivery",
    automation: "assisted",
    verified: true,
    note: "free and fast, with public reports of releases being pulled without explanation. fine for a first single, not where the catalogue lives",
  },
  {
    id: "spacemedia",
    name: "Space Media",
    home: "https://spacemedia.uk",
    cost: "free",
    commission_pct: 0,
    stores: [],
    requires: [],
    claim_path: "",
    automation: "manual",
    verified: false,
    note: "nothing in this pass confirmed its terms or that it still distributes. unverified means refused",
  },
];

// the policy, in one place, because it is a decision rather than a preference
export const AUTOMATION_POLICY =
  "a browser session may create the draft, fill the metadata and upload the files. account creation, the tax form and the final submit are a human's, because they are the human's liability";

export function distributor(id: string): Distributor | undefined {
  return DISTRIBUTORS.find((d) => d.id === id);
}

export interface Delivery {
  distributor: string;
  isrc: string;
  release_title: string;
  // true once the distributor has confirmed delivery and given a store link
  live: boolean;
}

export function deliveryProblems(delivery: Delivery, distributors: Distributor[] = DISTRIBUTORS): string[] {
  const problems: string[] = [];
  const found = distributors.find((d) => d.id === delivery.distributor);
  if (!found) return [`"${delivery.distributor}" is not a distributor this branch knows`];
  if (!found.verified) {
    problems.push(`${found.id}: unverified, so nothing is planned against it (${found.note})`);
  }
  if (!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(delivery.isrc ?? "")) {
    problems.push(`isrc: "${delivery.isrc}" is not an isrc (CCXXXYYNNNNN)`);
  }
  if (!delivery.release_title?.trim()) problems.push("release_title: required");
  if (found.stores.length === 0) problems.push(`${found.id}: no confirmed store list, so nothing would actually be delivered`);
  return problems;
}

// the same isrc delivered twice is the classic way a catalogue gets taken down: two
// distributors claiming one recording, and the stores resolve it by removing both
export function deliveryConflicts(deliveries: Delivery[]): string[] {
  const errors: string[] = [];
  const byIsrc = new Map<string, string>();
  for (const delivery of deliveries) {
    if (!delivery.live) continue;
    const existing = byIsrc.get(delivery.isrc);
    if (existing && existing !== delivery.distributor) {
      errors.push(`isrc ${delivery.isrc} is live via ${existing} and via ${delivery.distributor}, and the stores will drop both`);
    }
    byIsrc.set(delivery.isrc, delivery.distributor);
  }
  return errors;
}

export interface BrowserStep {
  action: "navigate" | "fill" | "upload" | "stop_for_human" | "confirm";
  target: string;
  value?: string;
  why: string;
}

export interface DistributionRun {
  distributor: Distributor;
  release_title: string;
  isrc: string;
  start_url: string;
  steps: BrowserStep[];
  stop_reasons: string[];
  // what the run must come back with, so a session cannot end on "it looked done"
  evidence: string[];
}

// the plan a browser lane (browserbase, kernel, or a person with a tab open) executes.
// the stop steps are the point: a run that walks past them is a run that signed a tax
// form on somebody's behalf.
export function planDistribution(
  distributorId: string,
  release: Release,
  artist: ArtistIdentity,
  isrc: string,
): { run?: DistributionRun; problems: string[] } {
  const found = distributor(distributorId);
  if (!found) return { problems: [`"${distributorId}" is not a distributor this branch knows`] };
  const problems = deliveryProblems({ distributor: distributorId, isrc, release_title: release.title, live: false }, [found]);
  if (!artist.rights_holder?.trim()) problems.push("rights_holder: a distributor pays a legal person, and the internative is not one");
  if (!artist.artist_name?.trim()) problems.push("artist_name: required by every one of these forms");
  if (release.targets?.length === 0) problems.push("targets: the release in release.ts names no destination");
  if (problems.length) return { problems };

  const steps: BrowserStep[] = [
    { action: "navigate", target: found.home, why: `the ${found.name} upload flow lives in its own web app` },
    { action: "stop_for_human", target: "create account or sign in", why: "account creation is a person's, and the tax form is a person's liability" },
    { action: "fill", target: "artist name", value: artist.artist_name, why: "the internative's name, which is what a listener sees" },
    { action: "fill", target: "rights holder", value: artist.rights_holder, why: "the human or entity behind the internative" },
    { action: "fill", target: "release title", value: release.title, why: "one title, matching the score and the master" },
    { action: "fill", target: "isrc", value: isrc, why: "one isrc per recording, delivered once" },
    { action: "upload", target: "audio master", why: "24 bit wav, measured against the loudness contract before upload" },
    { action: "upload", target: "artwork 3000x3000", why: "the cover static hands over, never an upscale" },
    { action: "fill", target: "generated content disclosure", value: release.ai_disclosure, why: "the stores ask, and so does the listener" },
    { action: "stop_for_human", target: "tax details and payout", why: "bank details and a tax id are the rights holder's, not the agent's" },
    { action: "stop_for_human", target: "final submit", why: "a submit is a legal assertion that the recording is yours to deliver" },
    { action: "confirm", target: "delivery receipt", why: "a store link or a submission id, so delivery can be recorded" },
  ];

  return {
    problems: [],
    run: {
      distributor: found,
      release_title: release.title,
      isrc,
      start_url: found.home,
      steps,
      stop_reasons: steps.filter((s) => s.action === "stop_for_human").map((s) => s.why),
      evidence: ["submission id or store link", "confirmation email", "the isrc as the distributor recorded it"],
    },
  };
}

// the artist profile a store gives back, claimed after the first release exists
export interface ArtistProfile {
  aipn: string;
  platform: "spotify" | "apple-music" | "youtube-music";
  profile_url?: string;
  claimed: boolean;
}

export function claimProblems(profile: ArtistProfile, deliveries: Delivery[]): string[] {
  const problems: string[] = [];
  if (!/^AIPN-\d{6}$/.test(profile.aipn ?? "")) problems.push("aipn: an artist profile belongs to a numbered internative");
  if (profile.claimed && !profile.profile_url?.trim()) problems.push("claimed: a claimed profile has a url, otherwise nothing was claimed");
  const liveForThisPerson = deliveries.some((d) => d.live);
  if (!liveForThisPerson && !profile.claimed) {
    problems.push("profile: a store only offers the artist profile once a release has been delivered and is live");
  }
  return problems;
}

export function distributionBrief(run: DistributionRun): string {
  const lines = run.steps.map((step, index) => {
    const value = step.value ? ` = ${step.value}` : "";
    return `${index + 1}. ${step.action} ${step.target}${value} (${step.why})`;
  });
  return [
    `${run.release_title} via ${run.distributor.name} (${run.distributor.home}), isrc ${run.isrc}`,
    `automation: ${run.distributor.automation}. ${AUTOMATION_POLICY}.`,
    ...lines,
    `come back with: ${run.evidence.join(", ")}`,
  ].join("\n");
}
