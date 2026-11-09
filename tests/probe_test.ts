import { assertEquals } from "jsr:@std/assert@1";
import { flowFor } from "../agentid/distribute/index.ts";
import { probeAllowed, probePage, probePhase, probeProblems, keywordsFor } from "../agentid/distribute/probe.ts";

const routenote = flowFor("routenote")!;

Deno.test("a keyword set drops the words that match every page", () => {
  const words = keywordsFor({ id: "x", action: "read", target: "the record label name field", note: "" });
  assertEquals(words, ["record", "label", "name"]);
});

const albumDetails = {
  url: "https://routenote.com/app/release",
  labels: [
    "Release Title", "Artist Name", "Primary Genre", "Language",
    "Record Label Name", "Composition Copyright", "Sound Recording Copyright",
    "Sales Start Date", "Explicit Content",
  ],
  buttons: ["Save", "Next"],
};

const albumSlice = { phase: "release" as const, page: "album details", steps: ["language", "artist", "genre", "cline", "pline", "label", "explicit"] };

Deno.test("a page that still matches the flow reads clean", () => {
  const probe = probePage(routenote, albumSlice, albumDetails);
  assertEquals(probe.missing, [], "every step on this page is still there");
  assertEquals(probe.extras.includes("Composition Copyright"), false, "a covered label is not an extra");
  assertEquals(probeProblems([probe]), []);
});

Deno.test("a renamed field is drift, and the ones that matter are refused", () => {
  const drifted = { ...albumDetails, labels: albumDetails.labels.filter((l) => l !== "Record Label Name") };
  const probe = probePage(routenote, albumSlice, drifted);
  assertEquals(probe.missing.includes("label"), true);
  const problems = probeProblems([probe]);
  assertEquals(problems.some((p) => p.includes("label is gone")), true);
  assertEquals(problems.some((p) => p.includes("routenote/release")), true);
});

Deno.test("an unexplained label is reported, not treated as a failure", () => {
  const grown = { ...albumDetails, labels: [...albumDetails.labels, "Dolby Atmos Options"] };
  const probe = probePage(routenote, albumSlice, grown);
  assertEquals(probe.extras.some((e) => e.includes("Dolby")), true);
  assertEquals(probeProblems([probe]).length, 0);
});

Deno.test("a probe records where a run would stop, and reads nothing past it", () => {
  const probe = probePhase(routenote, "signup", {
    url: "https://routenote.com/signup",
    labels: ["Username", "Email address", "Create password", "I agree to RouteNote's Terms & Conditions"],
    buttons: ["Sign up", "Log in"],
  });
  assertEquals(probe.stops_at !== undefined, true);
  assertEquals(probe.stops_at, "terms", "a stop is recorded, never acted on");
});

Deno.test("an unverified flow is not probed either, because there is nothing to compare", () => {
  const blind = { ...flowFor("routenote")!, id: "blind", verified: false, sources: [] };
  assertEquals(probeAllowed(blind).some((p) => p.includes("no terms read yet")), true);
  assertEquals(probeAllowed(flowFor("soundon-global")!), []);
  assertEquals(probeAllowed(flowFor("spacemediauk")!), []);
  assertEquals(probeAllowed(routenote), []);
});

Deno.test("a stop only counts while the field it guards is on the page", () => {
  const probe = probePhase(routenote, "signup", {
    url: "https://routenote.com/signup",
    labels: ["Email", "Password"],
    buttons: ["Create Account"],
  });
  const problems = probeProblems([probe]);
  assertEquals(problems.some((p) => p.includes("stop is gone")), true);
});
