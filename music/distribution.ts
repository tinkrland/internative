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
  // what the upload flow itself asks for. a tax form is not in this list for any service
  // read here, and that is the correction this field exists to make: tax is a payout gate.
  upload_requires: string[];
  // when the money questions actually arrive, which is not at signup
  payout: Payout;
  claim_path: string;
  automation: Automation;
  // true only when the service was looked at in this pass and the terms read
  verified: boolean;
  note: string;
}

export interface Payout {
  // the balance below which nothing is paid out at all
  threshold_usd?: number;
  methods: string[];
  tax: {
    // the only value this branch accepts: a payout gate, not an upload gate
    required_at: "first_payout";
    form: string;
    note: string;
    evidence: string;
  };
}

// read on 8 november 2026, tax placement corrected 18 november 2026. a distributor that has not been read is not listed as
// verified, and an unverified one is refused rather than tried.
export const DISTRIBUTORS: Distributor[] = [
  {
    id: "soundon",
    name: "SoundOn",
    home: "https://www.soundon.global",
    cost: "free",
    commission_pct: 0,
    stores: ["spotify", "apple-music", "tiktok", "youtube-music", "amazon"],
    upload_requires: ["tiktok account", "legal name", "artwork 3000x3000", "wav 24 bit"],
    payout: {
      threshold_usd: undefined,
      methods: ["tiktok payout account"],
      tax: {
        required_at: "first_payout",
        form: "unverified: collected in the tiktok payout flow",
        note: "signup is an email code and a terms tick with no tax field anywhere on it, and royalties are paid through a tiktok payout account, so the tax details arrive with the money and not with the release",
        evidence: "the signup page captured on 9 november 2026 has no tax field; the dashboard sits behind the tiktok login and is unmapped, so the payout flow itself is unverified",
      },
    },
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
    upload_requires: ["legal name", "artwork 3000x3000", "wav 16 or 24 bit"],
    payout: {
      threshold_usd: 50,
      methods: ["bank transfer", "paypal"],
      tax: {
        required_at: "first_payout",
        form: "tax details, asked for at payout",
        note: "the upload guide is seven steps and none of them is tax. payment needs a method on file and the 50 dollar threshold, and the cycle runs on the 15th to the 20th of the month",
        evidence: "support.routenote.com/kb-article/when-do-i-get-paid and /is-there-a-minimum-payout-amount, read 18 november 2026",
      },
    },
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
    upload_requires: ["legal name", "artwork 3000x3000", "wav"],
    payout: {
      methods: ["stripe payout"],
      tax: {
        required_at: "first_payout",
        form: "stripe payout onboarding",
        note: "the release form is public and the account is created at the end, so there is no tax step in the upload path at all. payouts run through stripe, which collects identity and tax details when a payout account is set up",
        evidence: "the release form captured on 9 november 2026 (title, artist, genre, then name, email, password, terms); help.indiefy.net describes royalties, stripe setup and payouts as a separate stage",
      },
    },
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
    upload_requires: ["legal name", "artwork", "wav"],
    payout: {
      methods: ["paypal"],
      tax: {
        required_at: "first_payout",
        form: "unverified: collected with payout details",
        note: "distribution is a separate product from the account, and the upload path in their faq names audio, artwork and the artist tick but no tax field",
        evidence: "freecords.com/faqs read 9 november 2026, re-read 18 november 2026 with no tax mention in the upload path",
      },
    },
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
    upload_requires: ["legal name", "artwork", "wav"],
    payout: {
      methods: ["bank transfer", "paypal"],
      tax: {
        required_at: "first_payout",
        form: "tax identification (such as a tin) where required by law",
        note: "their privacy policy says it plainly: to pay royalties you provide payout details and tax identification where required by law. that is the payout stage, and the register form has no tax field",
        evidence: "jumpstr.io/privacy-policy section 06 payouts and tax info, read 18 november 2026",
      },
    },
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
    upload_requires: [],
    payout: { methods: [], tax: { required_at: "first_payout", form: "", note: "unverified, so nothing is assumed about its payout either", evidence: "" } },
    claim_path: "",
    automation: "manual",
    verified: false,
    note: "nothing in this pass confirmed its terms or that it still distributes. unverified means refused",
  },
];

// the policy, in one place, because it is a decision rather than a preference
export const AUTOMATION_POLICY =
  "a browser session may create the draft, fill the metadata and upload the files. account creation and the final submit are a human's, because they contract and they assert. the payout details and the tax form are a human's too, but they are a payout gate rather than an upload gate: a release can be delivered long before anybody is owed money, and treating tax as a signup step is how an agent blocks itself on a form that no service asked for yet";

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

// the correction, enforced. a distributor that asked for a tax form before a release exists
// would be the exception, and an exception needs a source.
export function taxProblems(d: Distributor): string[] {
  const problems: string[] = [];
  // an unverified service has no terms read, so there is nothing to be wrong about yet.
  // deliveryProblems already refuses it.
  if (!d.verified) return problems;
  const early = d.upload_requires.filter((r) => /tax|w-?8|w-?9|vat|tin\b/i.test(r));
  if (early.length) {
    problems.push(`${d.id}: "${early[0]}" is listed as an upload requirement. no service read here asks for tax before a release exists, so either the source changed or the list is wrong`);
  }
  if (!d.payout?.tax) {
    problems.push(`${d.id}: no payout terms, so nobody knows when the money questions arrive`);
  } else {
    if (d.payout.tax.required_at !== "first_payout") {
      problems.push(`${d.id}: tax is placed at "${d.payout.tax.required_at}", and the only placement this branch accepts is the first payout`);
    }
    if (!d.payout.tax.note?.trim() || !d.payout.tax.evidence?.trim()) {
      problems.push(`${d.id}: the tax placement needs a note and the source it was read from`);
    }
  }
  return problems;
}

export interface PayoutGate {
  due: boolean;
  why: string;
  // what the human has to supply, and only when it is due
  stops: string[];
}

// is anybody owed money yet. below the threshold there is nothing to sign.
export function payoutGate(d: Distributor, earnings_usd: number): PayoutGate {
  const threshold = d.payout?.threshold_usd ?? 0;
  if (earnings_usd < threshold) {
    return {
      due: false,
      why: `$${earnings_usd.toFixed(2)} earned against a $${threshold} threshold, so nothing is payable and nothing needs signing`,
      stops: [],
    };
  }
  return {
    due: true,
    why: `$${earnings_usd.toFixed(2)} earned and the threshold is $${threshold}, so a payout can be requested`,
    stops: [`payout method (${(d.payout?.methods ?? []).join(" or ") || "unverified"})`, `tax details: ${d.payout?.tax?.form || "unverified"}`],
  };
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
    { action: "stop_for_human", target: "create account or sign in", why: "account creation is a person's: it is the identity the distributor contracts with" },
    { action: "fill", target: "artist name", value: artist.artist_name, why: "the internative's name, which is what a listener sees" },
    { action: "fill", target: "rights holder", value: artist.rights_holder, why: "the human or entity behind the internative" },
    { action: "fill", target: "release title", value: release.title, why: "one title, matching the score and the master" },
    { action: "fill", target: "isrc", value: isrc, why: "one isrc per recording, delivered once" },
    { action: "upload", target: "audio master", why: "24 bit wav, measured against the loudness contract before upload" },
    { action: "upload", target: "artwork 3000x3000", why: "the cover static hands over, never an upscale" },
    { action: "fill", target: "generated content disclosure", value: release.ai_disclosure, why: "the stores ask, and so does the listener" },
    { action: "stop_for_human", target: "final submit", why: "a submit is a legal assertion that the recording is yours to deliver" },
    { action: "confirm", target: "delivery receipt", why: "a store link or a submission id, so delivery can be recorded" },
    // after delivery, not before it: this is the payout gate, and it only closes when
    // somebody is actually owed money
    { action: "stop_for_human", target: "payout method and tax details, when a payout is due", why: "bank details and a tax id belong to the rights holder, and no service read here asks for them before a release exists" },
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
