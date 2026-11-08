import { assertEquals } from "jsr:@std/assert@1";
import {
  AUTOMATION_POLICY,
  claimProblems,
  deliveryConflicts,
  deliveryProblems,
  distributionBrief,
  distributor,
  DISTRIBUTORS,
  planDistribution,
} from "../music/distribution.ts";
import { STREAMING_TARGET } from "../music/master.ts";
import type { Release } from "../music/release.ts";
import type { ArtistIdentity } from "../music/distribution.ts";

const artist: ArtistIdentity = { artist_name: "Example", rights_holder: "tinkrland ltd", aipn: "AIPN-000001" };

const release: Release = {
  title: "Second Draft",
  aipn: "AIPN-000001",
  targets: ["spotify"],
  rights: { basis: "original", writers: ["example"] },
  master: STREAMING_TARGET,
  cover_handoff: "one frame, 3000x3000",
  explicit: false,
  ai_disclosure: "written and sung by an ai personality",
};

Deno.test("the distributors are data, and the unverified one is refused rather than tried", () => {
  assertEquals(DISTRIBUTORS.length, 6);
  assertEquals(distributor("routenote")?.commission_pct, 15);
  assertEquals(distributor("freecords")?.commission_pct, 5);
  assertEquals(distributor("soundon")?.commission_pct, 0);
  const unverified = deliveryProblems({ distributor: "spacemedia", isrc: "GBUM72600001", release_title: "x", live: false });
  assertEquals(unverified.some((p) => p.includes("unverified")), true);
  assertEquals(unverified.some((p) => p.includes("no confirmed store list")), true);
});

Deno.test("an isrc is an isrc, or it is a string that gets a release rejected", () => {
  assertEquals(deliveryProblems({ distributor: "routenote", isrc: "GBUM72600001", release_title: "Second Draft", live: false }), []);
  assertEquals(deliveryProblems({ distributor: "routenote", isrc: "gbum7260001", release_title: "Second Draft", live: false }).some((p) => p.includes("is not an isrc")), true);
});

Deno.test("one recording, one distributor: a second live delivery is a takedown waiting", () => {
  const first = { distributor: "routenote", isrc: "GBUM72600001", release_title: "Second Draft", live: true };
  const second = { distributor: "indiefy", isrc: "GBUM72600001", release_title: "Second Draft", live: true };
  assertEquals(deliveryConflicts([first]), []);
  assertEquals(deliveryConflicts([first, second]).some((p) => p.includes("drop both")), true);
  assertEquals(deliveryConflicts([first, { ...second, isrc: "GBUM72600002" }]), []);
  assertEquals(deliveryConflicts([first, { ...second, live: false }]), [], "a planned delivery is not a live one");
});

Deno.test("a run plans a browser session that stops where a person has to sign", () => {
  const planned = planDistribution("routenote", release, artist, "GBUM72600001");
  assertEquals(planned.problems, []);
  const run = planned.run!;
  assertEquals(run.start_url, "https://routenote.com");
  assertEquals(run.steps[0].action, "navigate");
  assertEquals(run.stop_reasons.length, 3);
  assertEquals(run.steps.some((s) => s.target === "tax details and payout" && s.action === "stop_for_human"), true);
  assertEquals(run.steps.some((s) => s.target === "final submit" && s.action === "stop_for_human"), true);
  const brief = distributionBrief(run);
  assertEquals(brief.includes(AUTOMATION_POLICY), true);
  assertEquals(brief.includes("Example"), true);
  assertEquals(brief.includes("tinkrland ltd"), true);
});

Deno.test("no rights holder, no distribution: a store cannot pay an internet native", () => {
  const planned = planDistribution("soundon", release, { ...artist, rights_holder: "" }, "GBUM72600001");
  assertEquals(planned.run, undefined);
  assertEquals(planned.problems.some((p) => p.includes("pays a legal person")), true);
  const noName = planDistribution("soundon", release, { ...artist, artist_name: "" }, "GBUM72600001");
  assertEquals(noName.problems.some((p) => p.includes("artist_name")), true);
});

Deno.test("an unverified distributor is never planned against", () => {
  const planned = planDistribution("spacemedia", release, artist, "GBUM72600001");
  assertEquals(planned.run, undefined);
  assertEquals(planned.problems.some((p) => p.includes("unverified")), true);
});

Deno.test("the artist profile is claimable only after something is live, and only by a numbered internative", () => {
  const planned = claimProblems({ aipn: "AIPN-000001", platform: "spotify", claimed: false }, []);
  assertEquals(planned.some((p) => p.includes("once a release has been delivered")), true);
  assertEquals(claimProblems({ aipn: "AIPN-000001", platform: "spotify", claimed: false }, [{ distributor: "routenote", isrc: "GBUM72600001", release_title: "x", live: true }]), []);
  assertEquals(claimProblems({ aipn: "AIPN-000001", platform: "spotify", claimed: true }, []).some((p) => p.includes("has a url")), true);
  assertEquals(claimProblems({ aipn: "spotify", platform: "spotify", claimed: false }, []).some((p) => p.includes("numbered internative")), true);
});
