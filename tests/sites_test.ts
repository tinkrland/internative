import { assertEquals, assert } from "jsr:@std/assert@1";
import { SITE_PATHS, occupancyProblems, registerSite, siteProblems, siteSpec } from "../wardrobe/sites.ts";

Deno.test("the taxonomy is a body, not a slot: hair, face, ears, neck, waist, bags", () => {
  for (const path of ["hair", "face/eyes", "face/nose", "face/lips", "ears/piercings", "ears/hearing", "neck", "waist", "bags", "wrists", "hands", "ankles"]) {
    assert(SITE_PATHS.includes(path), `${path} should be a site`);
  }
});

Deno.test("each site knows what it holds: a beanie is hair, a bandana is too, a belt is waist", () => {
  assertEquals(siteProblems("hair", "beanie"), []);
  assertEquals(siteProblems("hair", "bandana"), []);
  assertEquals(siteProblems("hair", "scrunchie"), []);
  assertEquals(siteProblems("waist", "belt"), []);
  assertEquals(siteProblems("eyes", "sunglasses").length, 1, "eyes is face/eyes, and a near miss is refused by name");
});

Deno.test("a slot on the wrong site is refused with the list of what that site holds", () => {
  const problems = siteProblems("hair", "belt");
  assert(problems.some((p) => p.includes("a belt does not go on hair")));
  assert(problems.some((p) => p.includes("bandana")), "the message says what would work");
});

Deno.test("piercings and hearing are separate sites, because a hoop and an earbud are never the same object", () => {
  assert(!siteSpec("ears/piercings")!.slots.includes("earbud"));
  assert(!siteSpec("ears/hearing")!.slots.includes("lobe"));
});

Deno.test("an earbud says which ear, and a beanie does not have to", () => {
  assert(siteProblems("ears/hearing", "earbud", "none").some((p) => p.includes("comes in twos")));
  assertEquals(siteProblems("ears/hearing", "earbud", "right"), []);
  assertEquals(siteProblems("hair", "beanie", "none"), []);
  assert(siteProblems("hair", "beanie", "left").some((p) => p.includes("not a paired site")));
});

Deno.test("occupancy is per place: she cannot wear two beanies, and she can wear two earrings", () => {
  assert(occupancyProblems([{ site: "hair", slot: "beanie" }, { site: "hair", slot: "beanie" }])[0].includes("2 things on the beanie"));
  assertEquals(occupancyProblems([
    { site: "ears/piercings", slot: "lobe", side: "left" },
    { site: "ears/piercings", slot: "lobe", side: "right" },
  ]), []);
});

Deno.test("a hoop and an earbud share an ear and not a place, so both can be worn", () => {
  assertEquals(occupancyProblems([
    { site: "ears/piercings", slot: "lobe", side: "left" },
    { site: "ears/hearing", slot: "earbud", side: "left" },
  ]), []);
});

Deno.test("a hat and a hairband are two slots on one site, so both can be worn", () => {
  assertEquals(occupancyProblems([{ site: "hair", slot: "hat" }, { site: "hair", slot: "hairband" }]), []);
});

Deno.test("a non-human body registers its own sites, and the occupancy rules come with them", () => {
  registerSite({ path: "muzzle", slots: ["muzzle"], paired: false });
  registerSite({ path: "tail", slots: ["collar", "bow"], paired: false });
  assertEquals(siteProblems("tail", "bow"), []);
  assert(siteProblems("tail", "beanie").some((p) => p.includes("does not go on tail")));
  assert(occupancyProblems([{ site: "tail", slot: "bow" }, { site: "tail", slot: "bow" }])[0].includes("2 things on the bow"));
  assert(siteProblems("neck", "beanie").length > 0, "the human body is untouched by a registration");
});

Deno.test("a site cannot be registered twice or hold nothing", () => {
  let threw = 0;
  for (const spec of [
    { path: "hair", slots: ["hat"], paired: false },
    { path: "chassis", slots: [], paired: false },
    { path: "Not A Path", slots: ["panel"], paired: false },
    { path: "panel", slots: ["bolt", "bolt"], paired: false },
  ]) {
    try {
      registerSite(spec);
    } catch {
      threw++;
    }
  }
  assertEquals(threw, 4);
});
