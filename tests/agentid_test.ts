import { assertEquals } from "jsr:@std/assert@1";
import { consentChoice, newsletterActions, newsletterDirection } from "../agentid/consent.ts";
import { flowActionFor, handoffFields, isFlowingForm, readFields } from "../agentid/form.ts";
import { addressFor, authorityProblems, hostAuthorised, identityProblems } from "../agentid/identity.ts";
import { passwordFor, planSignup } from "../agentid/signup.ts";
import { findVerification } from "../agentid/verify.ts";
import { credentialProblems, envNameFor, fingerprint, looksLikeSecret, needsRotation } from "../agentid/creds.ts";
import { browserBrief, chooseLane, stepsFor } from "../agentid/browser.ts";

const identity = {
  display_name: "Example",
  email: "example@internative.dev",
  username_candidates: ["example", "example_hn"],
};

const authority = {
  owner: "anne",
  authorised_hosts: ["bluesky.social", "mastodon.social"],
  may_supply_legal_name: false,
  verified_against_tos: true,
};

Deno.test("rejecting cookies comes before any polite alternative", () => {
  assertEquals(consentChoice(["Accept all", "Nature? Only necessary", "Reject all"]) as never, { action: "click", label: "Reject all", why: "reject all wins" } as never);
  assertEquals(consentChoice(["Accept all", "Necessary only"]).label, "Necessary only");
  const acceptOnly = consentChoice(["Accept all", "Agree and continue"]);
  assertEquals(acceptOnly.action, "none");
  assertEquals(/accept-only/.test(acceptOnly.why), true);
});

Deno.test("a newsletter opt-in is never ticked, and a pre-ticked one is unticked", () => {
  assertEquals(newsletterDirection("Subscribe to our newsletter"), "opt_in");
  assertEquals(newsletterDirection("Please do not wish to receive updates"), "opt_out");
  const actions = newsletterActions([
    { label: "Send me product updates", checked: true },
    { label: "Tick if you do not wish to receive marketing", checked: false },
  ]);
  assertEquals(actions.map((a) => `${a.want}:${a.box}`), [
    "untick:Send me product updates",
    "tick:Tick if you do not wish to receive marketing",
  ]);
});

Deno.test("a screen with a submit button is the last screen, and a screen with nothing stops", () => {
  assertEquals(flowActionFor(["Back", "Create account"]).act, "submit");
  assertEquals(flowActionFor(["Next", "Create account"]).act, "submit");
  assertEquals(flowActionFor(["Next"]).act, "advance");
  assertEquals(flowActionFor(["Back"]).act, "stuck");
  assertEquals(isFlowingForm("https://form.typeform.com/to/abc"), true);
  assertEquals(isFlowingForm("https://typeform.com.evil.io/x"), false);
});

Deno.test("a captcha is found before a password field is read, because order is what hurts", () => {
  const fields = readFields(["Create a password", "Email address", "I'm not a robot"]);
  assertEquals(fields[0], "captcha");
  assertEquals(handoffFields(fields), ["captcha"]);
});

Deno.test("the address a form gets is the internative's, tagged per host, never the owner's", () => {
  assertEquals(addressFor(identity, "www.bluesky.social"), "example+bluesky@internative.dev");
  assertEquals(identityProblems(identity), []);
  assertEquals(authorityProblems(authority), []);
  assertEquals(hostAuthorised(authority, "api.bluesky.social"), true);
  assertEquals(hostAuthorised(authority, "bluesky.social.evil.io"), false);
});

Deno.test("an unauthorised host, a second account and a third attempt are all refused", () => {
  const labels = ["Email", "Create a password", "Create account"];
  assertEquals(planSignup({ host: "evil.example", start_url: "https://evil.example/join", labels, identity, authority, existing_accounts: 0 }).problems.length > 0, true);
  assertEquals(planSignup({ host: "bluesky.social", start_url: "https://bluesky.social/join", labels, identity, authority, existing_accounts: 1 }).problems.some((p) => p.includes("already has an account")), true);
  assertEquals(planSignup({ host: "bluesky.social", start_url: "https://bluesky.social/join", labels, identity, authority, existing_accounts: 0, attempt: 3 }).problems.some((p) => p.includes("two is the limit")), true);
});

Deno.test("a plan fills what is ours and stops at everything that is not", () => {
  const { plan, problems } = planSignup({
    host: "bluesky.social",
    start_url: "https://bluesky.social/join",
    labels: ["Email address", "Create a password", "Date of birth", "I'm not a robot", "Create account"],
    identity,
    authority,
    existing_accounts: 0,
  });
  assertEquals(problems, []);
  assertEquals(plan!.fill.email, "example+bluesky@internative.dev");
  assertEquals(plan!.handoff.sort(), ["captcha", "dob"]);
  assertEquals(plan!.stops.some((s) => s.startsWith("captcha")), true);
  assertEquals(plan!.stops.some((s) => s.startsWith("birth date")), true);
});

Deno.test("terms are clickable only when the owner read them, and never otherwise", () => {
  const labels = ["Email", "Password", "I agree to the terms of service", "Create account"];
  const blind = planSignup({ host: "bluesky.social", start_url: "https://bluesky.social/join", labels, identity, authority: { ...authority, verified_against_tos: false }, existing_accounts: 0 });
  assertEquals(blind.problems.some((p) => p.includes("owner accepts, not the agent")), true);
  const read = planSignup({ host: "bluesky.social", start_url: "https://bluesky.social/join", labels, identity, authority, existing_accounts: 0 });
  assertEquals(read.problems, []);
});

Deno.test("a password is per host, so one dump cannot open two doors", () => {
  const a = passwordFor("bluesky.social", "server secret");
  const b = passwordFor("mastodon.social", "server secret");
  assertEquals(a === b, false);
  assertEquals(a.length, 24);
  assertEquals(passwordFor("bluesky.social", "server secret"), a);
});

Deno.test("verification refuses the shortener, the foreign host, the login page and the stale mail", () => {
  const now = "2026-11-09T10:30:00Z";
  const issued = "2026-11-09T10:00:00Z";
  const target = { host: "bluesky.social", issued_after: issued, now };

  const good = findVerification({ from: "no-reply@bluesky.social", subject: "verify", received_at: "2026-11-09T10:05:00Z", text: "Confirm here: https://bluesky.social/confirm/abc123" }, target);
  assertEquals(good.kind, "link");

  const shortener = findVerification({ from: "no-reply@bluesky.social", subject: "verify", received_at: "2026-11-09T10:05:00Z", text: "https://bit.ly/abc" }, target);
  assertEquals(shortener.kind, "none");
  assertEquals(/shortener/.test(shortener.why), true);

  const foreign = findVerification({ from: "no-reply@bluesky.social", subject: "verify", received_at: "2026-11-09T10:05:00Z", text: "https://bluesky-verify.top/confirm/abc" }, target);
  assertEquals(foreign.kind, "none");

  const login = findVerification({ from: "no-reply@bluesky.social", subject: "verify", received_at: "2026-11-09T10:05:00Z", text: "https://bluesky.social/login?next=/x" }, target);
  assertEquals(login.kind, "none");
  assertEquals(/login page/.test(login.why), true);

  const stale = findVerification({ from: "no-reply@bluesky.social", subject: "verify", received_at: "2026-11-09T09:00:00Z", text: "https://bluesky.social/confirm/abc" }, { ...target, issued_after: "2026-11-09T08:00:00Z" });
  assertEquals(stale.kind, "none");
  assertEquals(/minute window/.test(stale.why), true);

  const code = findVerification({ from: "no-reply@bluesky.social", subject: "code", received_at: "2026-11-09T10:05:00Z", text: "Your code is 481920" }, target);
  assertEquals(code.kind, "code");
  assertEquals(code.kind === "code" && code.value, "481920");
});

Deno.test("a credential record holds a name and a fact, never a value", () => {
  const rec = { host: "bluesky.social", account: "example", env_name: envNameFor("bluesky.social"), password_fingerprint: fingerprint("pw-one"), created_at: "2026-11-09T10:00:00Z" };
  assertEquals(rec.env_name, "BLUESKY_PASSWORD");
  assertEquals(credentialProblems(rec, [rec]), []);
  assertEquals(looksLikeSecret("bb_live_K-NeEfKFIxPHOpWBOBCTGsSKBQU"), true);
  assertEquals(looksLikeSecret("BLUESKY_PASSWORD"), false);

  const twin = { ...rec, host: "mastodon.social", env_name: "MASTODON_PASSWORD" };
  assertEquals(credentialProblems(twin, [rec, twin]).some((p) => p.includes("same password")), true);
  assertEquals(needsRotation(rec, "2027-06-09T10:00:00Z"), true);
  assertEquals(needsRotation(rec, "2026-12-09T10:00:00Z"), false);
});

Deno.test("the lane is browserbase unless a wall needs kernel, and the steps stop at the human", () => {
  const { plan } = planSignup({ host: "bluesky.social", start_url: "https://bluesky.social/join", labels: ["Email", "Password", "Create account"], identity, authority, existing_accounts: 0 });
  assertEquals(chooseLane(false, true), "browserbase");
  assertEquals(chooseLane(true, true), "kernel");
  assertEquals(chooseLane(true, false), "browserbase");
  const steps = stepsFor(plan!);
  assertEquals(steps[0].act, "navigate");
  assertEquals(steps.some((s) => s.act === "screenshot"), true);
  assertEquals(steps.at(-1)!.act, "stop");
  assertEquals(/lane: browserbase/.test(browserBrief(plan!, "browserbase")), true);
  assertEquals(/one submit click/.test(browserBrief(plan!, "browserbase")), true);
});
