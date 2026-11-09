// the signup plan: what will be typed, what will be clicked, and where it stops.
//
// an account is a durable claim made about a person, so the plan is deliberately
// narrower than the form. it fills what the internative owns (a display name, its
// own address, a generated password, a handle) and hands back everything that
// belongs to the human: a captcha, a card, a legal name, a birth date, a phone
// number, and the terms.

import type { FieldKind } from "./form.ts";
import { handoffFields, readFields } from "./form.ts";
import { addressFor, hostAuthorised, type FormIdentity, type SignupAuthority } from "./identity.ts";

export interface SignupPlan {
  host: string;
  start_url: string;
  email: string;
  fields: FieldKind[];
  fill: Partial<Record<FieldKind, string>>;
  handoff: FieldKind[];
  stops: string[];
  attempt: number;
}

export interface SignupRequest {
  host: string;
  start_url: string;
  labels: string[];
  identity: FormIdentity;
  authority: SignupAuthority;
  // accounts already held for this host, so a second one is a decision and not a slip
  existing_accounts: number;
  attempt?: number;
}

export function planSignup(req: SignupRequest): { plan?: SignupPlan; problems: string[] } {
  const problems: string[] = [];
  const host = req.host.toLowerCase().replace(/^www\./, "");

  if (!hostAuthorised(req.authority, host)) {
    problems.push(`${host} is not on the authorised list, so this signup is not ours to do`);
  }
  if (req.existing_accounts > 0) {
    problems.push(`${host} already has an account: a second one is a decision for the owner, not a retry`);
  }
  const attempt = req.attempt ?? 1;
  if (attempt > 2) problems.push(`attempt ${attempt}: two is the limit, and a third is how an address gets flagged`);

  const fields = readFields(req.labels);
  const handoff = handoffFields(fields);
  if (!fields.includes("email")) problems.push("no email field found, so this is not a signup form");
  if (problems.length) return { problems };

  const fill: Partial<Record<FieldKind, string>> = {
    email: addressFor(req.identity, host),
    username: req.identity.username_candidates[0],
    name: req.identity.display_name,
  };

  const stops: string[] = [];
  if (handoff.includes("captcha")) stops.push("captcha: stop, and tell the owner which host wants one");
  if (handoff.includes("payment")) stops.push("card field: stop, a paid signup is the owner's decision");
  if (handoff.includes("phone")) stops.push("phone field: stop, nobody here receives an sms");
  if (handoff.includes("otp")) stops.push("one-time code field: stop unless the code arrives in the internative's own inbox");
  if (handoff.includes("dob")) stops.push("birth date: an internative has none, so this field is not ours to invent");
  if (handoff.includes("terms")) {
    if (!req.authority.verified_against_tos) {
      problems.push("terms checkbox with nobody having read the terms: the owner accepts, not the agent");
    } else {
      stops.push("terms checkbox: clickable only because the owner accepted these terms in writing");
    }
  }
  if (problems.length) return { problems };

  return {
    problems: [],
    plan: {
      host,
      start_url: req.start_url,
      email: fill.email!,
      fields,
      fill,
      handoff,
      stops,
      attempt,
    },
  };
}

// the password is generated and unique per host, so one dump cannot open two doors
export function passwordFor(host: string, secret: string, length = 24): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!%*+-?";
  let h = 2166136261;
  const material = `${host}:${secret}`;
  for (let i = 0; i < material.length; i++) {
    h ^= material.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  let state = h >>> 0;
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out += alphabet[state % alphabet.length];
  }
  return out;
}
