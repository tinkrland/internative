import { assertEquals } from "jsr:@std/assert@1";
import { accountFor, accountProblems, canPost, presenceBrief, presenceGaps, registryGaps, type AccountRef } from "../publishing/accounts.ts";
import { approvalProblems, decide, memoryApprovalStore, planDigest, queueForApproval, approvedPlan } from "../publishing/approval.ts";
import type { PublishPlan } from "../publishing/plan.ts";

const bluesky: AccountRef = {
  aipn: "AIPN-000001",
  destination: "bluesky",
  kind: "posting",
  handle: "example.bsky.social",
  account_id: "did:plc:abcdefghijkl",
  credentials_env: ["BLUESKY_IDENTIFIER", "BLUESKY_APP_PASSWORD"],
  verified: "registered",
};

const instagram: AccountRef = {
  aipn: "AIPN-000001",
  destination: "instagram",
  kind: "posting",
  handle: "example",
  account_id: "17841400000000000",
  credentials_env: ["IG_USER_ID", "IG_ACCESS_TOKEN"],
  verified: "registered",
};

Deno.test("an account is a handle, a platform id and the names of its credentials", () => {
  assertEquals(accountProblems(bluesky), []);
  assertEquals(accountProblems({ ...bluesky, aipn: "example" }).some((p) => p.includes("belongs to nobody")), true);
  assertEquals(accountProblems({ ...bluesky, handle: "" }).some((p) => p.includes("a hope")), true);
  assertEquals(accountProblems({ ...bluesky, account_id: "" }).some((p) => p.includes("needs its did")), true);
  assertEquals(accountProblems({ ...bluesky, credentials_env: [] }).some((p) => p.includes("guessing at deploy time")), true);
});

Deno.test("a secret typed into the registry is refused, because this file is committed", () => {
  const leaked = accountProblems({ ...bluesky, credentials_env: ["BLUESKY_APP_PASSWORD", "bsky_2f8a91c4d7e6b3059a1c4d7e6b3059a1"] });
  assertEquals(leaked.some((p) => p.includes("looks like a secret")), true);
  assertEquals(accountProblems({ ...bluesky, credentials_env: ["bluesky-password"] }).some((p) => p.includes("not an env var name")), true);
});

Deno.test("a destination that takes no posts gets a profile, not a posting account", () => {
  const spotifyPosting = accountProblems({ ...bluesky, destination: "spotify", kind: "posting", handle: "example" });
  assertEquals(spotifyPosting.some((p) => p.includes("gets a profile")), true);
  const profile: AccountRef = { ...bluesky, destination: "spotify", kind: "profile", handle: "Example", account_id: "artist:123", credentials_env: [] };
  assertEquals(accountProblems(profile), []);
});

Deno.test("mastodon needs an instance, because the instance is the identity", () => {
  const mastodon = accountProblems({ ...bluesky, destination: "mastodon", account_id: "did:plc:x", credentials_env: ["MASTODON_TOKEN"] });
  assertEquals(mastodon.some((p) => p.includes("federated")), true);
  assertEquals(accountProblems({ ...bluesky, destination: "mastodon", instance: "mastodon.social", credentials_env: ["MASTODON_TOKEN"] }), []);
});

Deno.test("app review comes before a post on the destinations that require it", () => {
  assertEquals(accountProblems(instagram).some((p) => p.includes("app review comes before a post")), true);
  assertEquals(accountProblems({ ...instagram, verified: "app-reviewed" }), []);
  const gaps = presenceGaps("AIPN-000001", ["bluesky", "instagram", "tiktok", "spotify"], [bluesky, instagram]);
  assertEquals(gaps.some((g) => g.destination === "instagram" && g.missing.includes("app review")), true);
  assertEquals(gaps.some((g) => g.destination === "tiktok" && g.missing === "no account"), true);
  assertEquals(gaps.some((g) => g.destination === "spotify" && g.missing.includes("no upload API")), true);
  assertEquals(gaps.some((g) => g.destination === "bluesky"), false);
});

Deno.test("two accounts for one presence is a migration or a mistake, and a human says which", () => {
  const second = { ...bluesky, handle: "example-alt.bsky.social" };
  assertEquals(registryGaps([bluesky]), []);
  assertEquals(registryGaps([bluesky, second]).some((p) => p.includes("two accounts")), true);
});

Deno.test("posting needs an account that exists in the right state", () => {
  assertEquals(canPost([bluesky], "AIPN-000001", "bluesky").ok, true);
  assertEquals(canPost([], "AIPN-000001", "bluesky").problems.some((p) => p.includes("nothing to post to")), true);
  assertEquals(canPost([instagram], "AIPN-000001", "instagram").ok, false);
  assertEquals(canPost([bluesky], "AIPN-000001", "spotify").problems.some((p) => p.includes("distributor")), true);
  assertEquals(accountFor([bluesky], "AIPN-000001", "bluesky")?.handle, "example.bsky.social");
  assertEquals(presenceBrief("AIPN-000001", []).includes("does not appear anywhere yet"), true);
  assertEquals(presenceBrief("AIPN-000001", [bluesky]).includes("bluesky posting example.bsky.social"), true);
});

const plan: PublishPlan = {
  persona: "example",
  aipn: "AIPN-000001",
  destination: "bluesky",
  surface: "text",
  body: "a post that a person has to approve",
  media: [],
  ai_disclosure: "written by an ai personality",
  approval: "draft",
};

Deno.test("an approval is a person, a time, and an expiry, or it is a draft", async () => {
  const store = memoryApprovalStore();
  const at = "2026-11-08T12:00:00Z";
  assertEquals(approvalProblems(undefined, at).some((p) => p.includes("it is a draft")), true);

  const queued = await queueForApproval(store, plan, at);
  assertEquals(queued.state, "queued");
  assertEquals(approvalProblems(await store.get(await planDigest(plan)), at).some((p) => p.includes("state is queued")), true);

  const refused = await decide(store, plan, { state: "refused", reviewer: "anne" }, at);
  assertEquals(refused.problems.some((p) => p.includes("carries a reason")), true);

  const approved = await decide(store, plan, { state: "approved", reviewer: "anne" }, at);
  assertEquals(approved.problems, []);
  const record = (await store.get(await planDigest(plan)))!;
  assertEquals(approvalProblems(record, "2026-11-09T12:00:00Z"), []);
});

Deno.test("an approval expires, and the approved plan is the only one a publisher sees", async () => {
  const store = memoryApprovalStore();
  const at = "2026-11-08T12:00:00Z";
  await decide(store, plan, { state: "approved", reviewer: "anne", hours: 24 }, at);
  const stale = await approvedPlan(store, plan, "2026-11-11T12:00:00Z");
  assertEquals(stale.plan, undefined);
  assertEquals(stale.problems.some((p) => p.includes("approve it again")), true);

  const fresh = await approvedPlan(store, plan, "2026-11-08T18:00:00Z");
  assertEquals(fresh.problems, []);
  assertEquals(fresh.plan?.approval, "approved");

  const edited = await approvedPlan(store, { ...plan, body: "a different post entirely" }, at);
  assertEquals(edited.plan, undefined, "approving one draft does not approve the next one");
});
