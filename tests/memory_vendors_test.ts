import { assertEquals, assert } from "jsr:@std/assert@1";
import { VENDORS, chooseStore, vendorProblems, type Vendor } from "../memory/vendors.ts";

Deno.test("every vendor's use follows from its licence", () => {
  for (const vendor of VENDORS) assertEquals(vendorProblems(vendor), [], vendor.name);
});

Deno.test("vendoring something copyleft is refused, whatever the convenience", () => {
  const bad: Vendor = { ...VENDORS[1], use: "vendored" };
  assert(vendorProblems(bad).some((p) => p.includes("cannot be vendored")));
});

Deno.test("a licence claim with no source is a rumour", () => {
  const bad: Vendor = { ...VENDORS[2], verified_sources: [] };
  assert(vendorProblems(bad).some((p) => p.includes("rumour")));
});

Deno.test("the chosen graph store is the one whose bridge already exists", () => {
  const choice = chooseStore();
  assertEquals(choice.layer, "mem0");
  assertEquals(choice.graph, "neo4j");
  assert(choice.why.includes("upstream"));
});

Deno.test("with neo4j out of the running, falkordb wins on the bridge", () => {
  const without = VENDORS.filter((vendor) => vendor.name !== "neo4j");
  const choice = chooseStore(without);
  assertEquals(choice.graph, "falkordb");
  assert(choice.why.includes("published mem0 bridge"));
});

Deno.test("kuzu is native and permissive but cannot be shared by seven surfaces", () => {
  const kuzu = VENDORS.find((vendor) => vendor.name === "kuzu");
  assert(kuzu && kuzu.use === "vendored" && kuzu.shared === false);
  assert(kuzu?.note?.includes("one process"));
});

Deno.test("hydradb is recorded, and its own note says what adopting it would cost", () => {
  const hydra = VENDORS.find((vendor) => vendor.name === "hydradb");
  assert(hydra && hydra.licence_class === "source_available" && hydra.mem0_bridge === "none");
  assert(hydra?.note?.includes("owning the bridge"));
});
