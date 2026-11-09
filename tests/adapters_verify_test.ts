import { assertEquals } from "jsr:@std/assert@1";
import { ADAPTERS, type Adapter } from "../generation/adapters.ts";
import { adapterChecks, checkAdapterDefinition, MIN_REFERENCE_KIT, verificationReport } from "../generation/verify.ts";

Deno.test("every shipped adapter description is internally coherent", () => {
  const report = verificationReport();
  assertEquals(report.ok, true, JSON.stringify(report.checks.filter((c) => c.problems.length)));
});

Deno.test("none of them claims to be verified, because none has been run", () => {
  const report = verificationReport();
  assertEquals(report.unverified.sort(), ADAPTERS.map((a) => a.id).sort());
});

Deno.test("a description with no identity carrier is broken, not just unverified", () => {
  const bad: Adapter = {
    id: "no-identity",
    name: "scene only",
    kind: "reference-to-video",
    licence: "oss",
    accepts: ["place_wide"],
    max_references: 4,
    reference_field: "reference_images",
    evidence: "assumed",
    source_kind: "catalog",
    provider: "test",
    prompt_tags: false,
    constraints: [],
    notes: "takes a room and nothing else",
    verified: false,
  };
  assertEquals(checkAdapterDefinition(bad).some((p) => p.includes("identity")), true);
  assertEquals(verificationReport([bad]).ok, false);
});

Deno.test("a ceiling below the smallest kit is refused for a reference adapter", () => {
  const tooSmall: Adapter = {
    id: "tiny",
    name: "one reference",
    kind: "reference-to-video",
    licence: "oss",
    accepts: ["character"],
    max_references: MIN_REFERENCE_KIT - 1,
    reference_field: "reference_images",
    evidence: "assumed",
    source_kind: "catalog",
    provider: "test",
    prompt_tags: false,
    constraints: [],
    notes: "one image only",
    verified: false,
  };
  assertEquals(checkAdapterDefinition(tooSmall).some((p) => p.includes("below the smallest kit")), true);
  // a keyframe-only adapter is a different shape and one image is its whole job
  const keyframeOnly: Adapter = { ...tooSmall, id: "kf", accepts: ["keyframe"], max_references: 1 };
  assertEquals(checkAdapterDefinition(keyframeOnly), []);
});

Deno.test("an undocumented claim of documentation is caught", () => {
  const noSource: Adapter = { ...ADAPTERS[0], evidence: "documented", source: undefined };
  assertEquals(checkAdapterDefinition(noSource).includes("claims to be documented but cites no source"), true);
});

Deno.test("a missing field name is a problem, because a schema rejects the wrong one", () => {
  const nameless: Adapter = { ...ADAPTERS[0], reference_field: " " };
  assertEquals(checkAdapterDefinition(nameless).some((p) => p.includes("field name")), true);
});

Deno.test("the fields the roster sends are the fields each endpoint validates", () => {
  const byId = new Map(ADAPTERS.map((a) => [a.id, a]));
  assertEquals(byId.get("wan-reference-to-video")?.reference_field, "reference_urls");
  // the provider's own api reference calls it image_urls, and this provider is
  // the one that validates it
  assertEquals(byId.get("seedance-2-reference")?.reference_field, "image_urls");
  assertEquals(byId.get("seedance-2-reference")?.source_kind, "api-doc");
  assertEquals(byId.get("kling-reference-to-video")?.reference_field, "image_urls");
  assertEquals(byId.get("first-frame-image-to-video")?.reference_field, "first_frame_image");
});

Deno.test("what rests on inference is listed apart from what was read", () => {
  const report = verificationReport();
  assertEquals(report.documented.includes("wan-reference-to-video"), true);
  assertEquals(report.assumed, ["hunyuan-custom-multi-subject"]);
});

Deno.test("what was read from a catalogue is listed apart from a provider's own api reference", () => {
  const report = verificationReport();
  assertEquals(report.catalog_sourced.includes("wan-reference-to-video"), true);
  assertEquals(report.catalog_sourced.includes("seedance-2-reference"), false, "this one was read from the provider");
});

Deno.test("a provider api reference without an endpoint is a broken description", () => {
  const noEndpoint: Adapter = { ...ADAPTERS.find((a) => a.id === "seedance-2-reference")!, endpoint: undefined };
  assertEquals(checkAdapterDefinition(noEndpoint).includes("claims a provider api reference but names no endpoint"), true);
});

Deno.test("an undeclared licence is a problem, not a detail", () => {
  const noLicence = { ...ADAPTERS[0], licence: "  " };
  assertEquals(checkAdapterDefinition(noLicence).includes("licence not declared"), true);
  assertEquals(adapterChecks([noLicence])[0].problems.length > 0, true);
});
