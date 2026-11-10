import { assertEquals, assert } from "jsr:@std/assert@1";
import { accessBrief, grantProblems, hasAccess, type Grant } from "../access/tool.ts";

const base = (over: Partial<Grant> = {}): Grant => ({
  id: "post-bluesky",
  reaches: "her bluesky account",
  tool: "com.atproto.repo.createRecord",
  kind: "write",
  provider: "bluesky",
  credential_env: "BLUESKY_APP_PASSWORD",
  scopes: ["app.bsky.feed.post"],
  state: "live",
  granted_by: "anne",
  granted_at: "2026-11-01",
  ...over,
});

Deno.test("a live grant with a named variable and a scope is well formed", () => {
  assertEquals(grantProblems(base()), []);
});

Deno.test("a live grant nobody authorised is refused, because an agent cannot authorise itself", () => {
  const problems = grantProblems(base({ granted_by: undefined }));
  assert(problems.some((p) => p.includes("may not authorise itself")));
});

Deno.test("the credential field names a variable, never a value", () => {
  assert(grantProblems(base({ credential_env: "bluesky-app-password-9f2a" })).some((p) => p.includes("not the secret")));
});

Deno.test("a write with no scopes is refused, and a read does not need one", () => {
  assert(grantProblems(base({ scopes: [] })).some((p) => p.includes("names what it may change")));
  assertEquals(grantProblems(base({ kind: "read", scopes: [] })), []);
});

Deno.test("a spend grant without a ceiling is an unlimited bet", () => {
  const problems = grantProblems(base({ kind: "spend", scopes: ["checkout"] }));
  assert(problems.some((p) => p.includes("unlimited bet")));
  assertEquals(grantProblems(base({ kind: "spend", scopes: ["checkout"], spend_ceiling: 20, spend_unit: "currency" })), []);
});

Deno.test("an unverified grant says so out loud", () => {
  assert(grantProblems(base({ state: "unverified" })).some((p) => p.includes("says so out loud")));
  assertEquals(grantProblems(base({ state: "unverified", note: "no test call yet" })), []);
});

Deno.test("deny beats allow: revoked, expired, unverified, wrong kind, missing scope", () => {
  assertEquals(hasAccess(base(), { kind: "write", scope: "app.bsky.feed.post" }).allowed, true);
  assert(hasAccess(base({ state: "revoked" }), { kind: "write" }).reason.includes("revoked"));
  assert(hasAccess(base({ state: "unverified", note: "x" }), { kind: "write" }).reason.includes("unverified"));
  assert(hasAccess(base({ expires_at: "2026-01-01" }), { kind: "write" }, new Date("2026-11-10")).reason.includes("expired"));
  assert(hasAccess(base(), { kind: "spend", amount: 5 }).reason.includes("grant, and this is a"));
  assert(hasAccess(base(), { kind: "write", scope: "dm.write" }).reason.includes("does not carry"));
});

Deno.test("a spend over its ceiling is refused with the numbers", () => {
  const spend = base({ kind: "spend", scopes: ["checkout"], spend_ceiling: 20, spend_unit: "currency" });
  const decision = hasAccess(spend, { kind: "spend", scope: "checkout", amount: 25 });
  assertEquals(decision.allowed, false);
  assert(decision.reason.includes("25") && decision.reason.includes("20"));
  assertEquals(hasAccess(spend, { kind: "spend", scope: "checkout", amount: 20 }).allowed, true);
});

Deno.test("no grant at all is not hers to do", () => {
  assert(hasAccess(undefined, { kind: "write" }).reason.includes("not hers to do"));
});

Deno.test("the brief tells the model what it can do, and labels what is not live", () => {
  const brief = accessBrief([
    base(),
    base({ id: "read-calendar", reaches: "her calendar", kind: "read", scopes: [], state: "unverified", note: "no test call" }),
  ]);
  assert(brief.includes("write: her bluesky account via bluesky"));
  assert(brief.includes("read (unverified): her calendar"));
  assertEquals(accessBrief([]), "nothing is granted");
});
