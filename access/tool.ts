// ACCESS is not knowledge, and mixing them is how an agent ends up claiming it can do
// things nobody authorised.
//
// knowing how to change a tyre is knowledge (procedural, demonstrated or not). having the
// keys to the van is access: a grant, held by somebody, revocable, with a scope and a way to
// tell whether it is still live. the two fail differently. a missing skill produces a bad
// attempt; a missing grant produces an attempt at something that was never ours to do.
//
// so a grant is data with a decision, not a boolean in a prompt: every grant names what it
// reaches, how, under whose credential, what it may spend, and whether anybody has verified
// that it works. `hasAccess` answers with a reason either way, because "no" with a reason is
// something an agent can act on and "no" alone is something it will route around.

export type GrantKind = "read" | "write" | "spend" | "call";
export type GrantState = "live" | "unverified" | "revoked" | "expired";

export interface Grant {
  id: string;
  // what it reaches, in the persona's words: "her email", "the shop's checkout"
  reaches: string;
  tool: string;
  kind: GrantKind;
  provider: string;
  // the NAME of the environment variable, never the value. a grant that carries a secret is
  // a leak with a schema.
  credential_env?: string;
  scopes: string[];
  state: GrantState;
  // who authorised it, and when. an agent may not authorise itself
  granted_by?: string;
  granted_at?: string;
  expires_at?: string;
  // a spend grant with no ceiling is an unlimited bet with somebody else's money
  spend_ceiling?: number;
  spend_unit?: "currency" | "calls" | "credits";
  // an oauth grant can be revoked by the provider at any time, so the last time it worked is
  // part of the grant rather than a log line
  last_ok_at?: string;
  note?: string;
}

const SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const ISO = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?$/;
const SECRET_VALUE = /^(?!.*(?:KEY|TOKEN|SECRET|PASSWORD|ENV)).{0,7}$/i;

export function grantProblems(grant: Grant): string[] {
  const problems: string[] = [];
  if (!SLUG.test(grant.id ?? "")) problems.push(`id: "${grant.id}" is not a slug`);
  if ((grant.reaches ?? "").trim().length < 3) problems.push("reaches: what does this grant reach");
  if (!(grant.tool ?? "").trim()) problems.push("tool: name the callable, not the intention");
  if (!(grant.provider ?? "").trim()) problems.push("provider: who issues this");
  if (!["read", "write", "spend", "call"].includes(grant.kind)) {
    problems.push(`kind: "${grant.kind}" is not one of read, write, spend, call`);
  }
  if (!["live", "unverified", "revoked", "expired"].includes(grant.state)) {
    problems.push(`state: "${grant.state}" is not one of live, unverified, revoked, expired`);
  }
  if (grant.kind !== "read" && (grant.scopes ?? []).length === 0) {
    problems.push("scopes: a grant that can change something names what it may change");
  }
  if (grant.kind === "spend") {
    if (typeof grant.spend_ceiling !== "number" || grant.spend_ceiling <= 0) {
      problems.push("spend: a spend grant without a ceiling is an unlimited bet with somebody else's money");
    }
    if (!["currency", "calls", "credits"].includes(grant.spend_unit ?? "")) {
      problems.push("spend: say what the ceiling is counted in");
    }
  }
  if (grant.credential_env && !/^[A-Z][A-Z0-9_]*$/.test(grant.credential_env)) {
    problems.push("credential_env: this is the name of an environment variable, not the secret");
  }
  if (grant.credential_env && SECRET_VALUE.test(grant.credential_env) === false && /[-_.]{2,}|[a-z]{6,}\d{4,}/.test(grant.credential_env)) {
    problems.push("credential_env: that looks like a value, not a variable name");
  }
  if (grant.state === "live" && !(grant.granted_by ?? "").trim()) {
    problems.push("granted_by: an agent may not authorise itself");
  }
  if (grant.state === "live" && !ISO.test(grant.granted_at ?? "")) {
    problems.push("granted_at: a live grant says when it was given");
  }
  if (grant.state === "live" && (grant.note ?? "").trim() === "" && grant.last_ok_at === undefined) {
    // not a problem: a fresh grant has no history yet. recorded here so the absence is a
    // decision and not an oversight
  }
  if (grant.state === "unverified" && !(grant.note ?? "").trim()) {
    problems.push("note: an unverified grant says so out loud, or the next run treats it as live");
  }
  if (grant.expires_at && !ISO.test(grant.expires_at)) problems.push("expires_at: as a date");
  return problems;
}

export interface Decision {
  allowed: boolean;
  reason: string;
}

// the answer an agent can act on. deny beats allow, always: a grant that is revoked is
// revoked even if every scope matches, and a spend grant over its ceiling is over it.
export function hasAccess(
  grant: Grant | undefined,
  need: { kind: GrantKind; scope?: string; amount?: number },
  now = new Date(),
): Decision {
  if (!grant) return { allowed: false, reason: "no grant for this, so it is not hers to do" };
  const problems = grantProblems(grant);
  if (problems.length) return { allowed: false, reason: `the grant is malformed: ${problems[0]}` };
  if (grant.state === "revoked") return { allowed: false, reason: `${grant.reaches} was revoked` };
  if (grant.state === "expired") return { allowed: false, reason: `${grant.reaches} expired` };
  if (grant.state === "unverified") {
    return { allowed: false, reason: `${grant.reaches} is unverified: nobody has watched it work` };
  }
  if (grant.expires_at && new Date(grant.expires_at) <= now) {
    return { allowed: false, reason: `${grant.reaches} expired on ${grant.expires_at}` };
  }
  if (grant.kind !== need.kind) {
    return { allowed: false, reason: `${grant.reaches} is a ${grant.kind} grant, and this is a ${need.kind}` };
  }
  if (need.scope && !grant.scopes.includes(need.scope) && grant.kind !== "read") {
    return { allowed: false, reason: `${grant.reaches} does not carry the "${need.scope}" scope` };
  }
  if (grant.kind === "spend" && typeof need.amount === "number") {
    const ceiling = grant.spend_ceiling ?? 0;
    if (need.amount > ceiling) {
      return { allowed: false, reason: `${need.amount} is over the ${ceiling} ${grant.spend_unit ?? ""} ceiling on ${grant.reaches}` };
    }
  }
  return { allowed: true, reason: `${grant.reaches} is live${grant.granted_by ? `, granted by ${grant.granted_by}` : ""}` };
}

// what a surface may tell the model about itself. an unverified grant is described as
// unverified, because a prompt that says "you can post to instagram" and then fails is worse
// than a prompt that never claimed it.
export function accessBrief(grants: Grant[]): string {
  const order: GrantState[] = ["live", "unverified", "expired", "revoked"];
  const lines = grants
    .filter((grant) => grantProblems(grant).length === 0)
    .sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || a.reaches.localeCompare(b.reaches))
    .map((grant) => `${grant.kind}${grant.state === "live" ? "" : ` (${grant.state})`}: ${grant.reaches} via ${grant.provider}`);
  return lines.length ? lines.join("\n") : "nothing is granted";
}
