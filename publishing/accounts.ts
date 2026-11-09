// the presence: which internative has which account, where.
//
// a publish plan is not enough to post. something has to exist on the other side:
// a handle, an app registration, and a credential that lives in the environment
// rather than in this file. that gap is where "it works on my machine" comes from, so
// it is a table with a check rather than a hope.

import { DESTINATIONS, type Destination } from "./destinations.ts";

export type Verified = "unverified" | "registered" | "app-reviewed";

export interface AccountRef {
  aipn: string;
  destination: Destination;
  // "posting" publishes to a feed. "profile" is an artist or channel page that a
  // human claims, which is not the same thing as an upload permission.
  kind: "posting" | "profile";
  handle: string;
  // the platform's own id: a did on bluesky, an account id on mastodon, a channel id
  // on youtube
  account_id?: string;
  // mastodon is federated, so the instance is part of the identity
  instance?: string;
  // env var NAMES. never a value: this file is committed.
  credentials_env: string[];
  verified: Verified;
  note?: string;
}

const AIPN = /^AIPN-\d{6}$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]{2,}$/;
// whatever a real secret looks like, it is not an env var name
const SECRET_SHAPED = [/^[A-Za-z0-9_\-]{24,}$/, /^sk[_-]/, /^bb_/, /^xoxb/, /\s/];

export function accountProblems(account: AccountRef): string[] {
  const problems: string[] = [];
  const spec = DESTINATIONS[account.destination];
  if (!AIPN.test(account.aipn ?? "")) problems.push(`aipn: "${account.aipn}" is not an aipn, so the account belongs to nobody`);
  if (!spec) return [...problems, `"${account.destination}" is not a destination this head knows`];
  if (!account.handle?.trim()) problems.push(`${account.destination}: an account with no handle is a hope`);
  const posting = account.kind === "posting";
  if (posting && spec.route === "no-api") {
    problems.push(`${account.destination}: takes no posts, so it gets a profile and not a posting account`);
  }
  if (!posting && spec.route === "api" && spec.media.length && account.kind !== "profile") {
    problems.push(`${account.destination}: a profile is a claim on a page, and this destination also takes posts`);
  }
  if (account.destination === "mastodon" && !account.instance?.trim()) {
    problems.push("mastodon: federated, so the instance is part of the account");
  }
  if (account.destination === "bluesky" && posting && !/^did:/.test(account.account_id ?? "")) {
    problems.push("bluesky: a posting account needs its did, which is what a record is written to");
  }
  if (posting && (account.credentials_env ?? []).length === 0) {
    problems.push(`${account.destination}: name the credentials_env a surface reads, so nobody is guessing at deploy time`);
  }
  for (const name of account.credentials_env ?? []) {
    if (!ENV_NAME.test(name)) problems.push(`credentials_env: "${name}" is not an env var name`);
    if (SECRET_SHAPED.some((pattern) => pattern.test(name))) {
      problems.push(`credentials_env: "${name.slice(0, 6)}..." looks like a secret. this file is committed, so it holds names only`);
    }
  }
  if (posting && spec.ai_label === "required" && account.verified !== "app-reviewed") {
    problems.push(`${account.destination}: an app review comes before a post, and this account is ${account.verified}`);
  }
  return problems;
}

// two accounts for one destination on one internative is either a migration or a
// mistake, and both need a human to say which
export function registryGaps(accounts: AccountRef[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, AccountRef>();
  for (const account of accounts) {
    problems.push(...accountProblems(account).map((p) => `${account.aipn}/${account.destination}: ${p}`));
    const key = `${account.aipn}:${account.destination}:${account.kind}`;
    const previous = seen.get(key);
    if (previous) problems.push(`${key}: two accounts (${previous.handle} and ${account.handle})`);
    seen.set(key, account);
  }
  return problems;
}

export function accountFor(accounts: AccountRef[], aipn: string, destination: Destination): AccountRef | undefined {
  return accounts.find((a) => a.aipn === aipn && a.destination === destination && a.kind === "posting");
}

// the question that actually matters before a presence goes live: what does this
// internative still not have, surface by surface
export interface PresenceGap {
  destination: Destination;
  missing: string;
}

export function presenceGaps(aipn: string, wanted: Destination[], accounts: AccountRef[]): PresenceGap[] {
  const gaps: PresenceGap[] = [];
  for (const destination of wanted) {
    const spec = DESTINATIONS[destination];
    const posting = accountFor(accounts, aipn, destination);
    if (spec?.route === "no-api") {
      gaps.push({ destination, missing: "no upload API: a distributor or a human claims the profile" });
      continue;
    }
    if (!posting) {
      gaps.push({ destination, missing: "no account" });
      continue;
    }
    if (posting.verified === "unverified") gaps.push({ destination, missing: "account exists and is not verified" });
    else if (posting.verified === "registered" && spec?.ai_label === "required") {
      gaps.push({ destination, missing: "registered, but the app review has not happened" });
    }
    for (const name of posting.credentials_env ?? []) {
      if (!name) gaps.push({ destination, missing: "credentials are unnamed" });
    }
  }
  return gaps;
}

// the last gate before a plan leaves: an account, in the right state, with named
// credentials. everything above this point is planning.
export function canPost(accounts: AccountRef[], aipn: string, destination: Destination): { ok: boolean; problems: string[] } {
  const spec = DESTINATIONS[destination];
  if (!spec) return { ok: false, problems: [`"${destination}" is not a destination this head knows`] };
  if (spec.route === "no-api") return { ok: false, problems: [`${destination}: ${spec.note}`] };
  const posting = accountFor(accounts, aipn, destination);
  if (!posting) return { ok: false, problems: [`${destination}: ${aipn} has no account there, so there is nothing to post to`] };
  const problems = accountProblems(posting);
  return { ok: problems.length === 0, problems };
}

export function presenceBrief(aipn: string, accounts: AccountRef[]): string {
  const mine = accounts.filter((a) => a.aipn === aipn);
  if (mine.length === 0) return `${aipn} has no accounts: it exists and it does not appear anywhere yet.`;
  return [
    `${aipn} appears in ${mine.length} place${mine.length === 1 ? "" : "s"}:`,
    ...mine.map((a) => `  ${a.destination} ${a.kind} ${a.handle} (${a.verified})`),
  ].join("\n");
}
