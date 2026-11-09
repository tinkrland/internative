import { assertEquals } from "jsr:@std/assert@1";
import { faceBlock, faceProblems, type FaceTuning } from "../../appearance/face/module.ts";
import { daysSinceCut, hairDrift, hairProblems, type HairTuning } from "../../appearance/hair/module.ts";
import { outfitFitsStyle, styleProblems, type WardrobeStyle } from "../../appearance/wardrobe/module.ts";
import { placeBlock, placePathProblems, placeProblems, type PlaceTuning } from "../../appearance/places/module.ts";
import { gradeProblems, type GradeTuning } from "../../appearance/grade/module.ts";
import { canonicalTuning, tuningBlocks, tuningDigest, tuningProblems, tuningPrompt, type Tuning } from "../../appearance/tuning.ts";

const face: FaceTuning = {
  basis: "authored",
  structure: "long oval, strong jaw, high cheekbones",
  brows: "straight, low set, fuller at the inner edge",
  eyes: "hooded, dark brown, steady",
  nose: "straight bridge, slightly wide at the base",
  mouth: "wide, thin upper lip",
  skin: "warm olive, visible pores, matte",
  age_range: [27, 31],
  asymmetry: "left brow sits a little higher",
};

const hair: HairTuning = {
  length: "collarbone",
  texture: "wavy",
  parting: "off centre to the left",
  colour: "dark brown, one shade off black",
  cut_cycle_days: 56,
};

const style: WardrobeStyle = {
  silhouette: "fitted base, oversized outer, cropped leg",
  palette_anchors: ["#5a1f22", "#3a3a3c", "#efe6d2", "#141414"],
  materials: ["silk", "wool", "leather"],
  occasion_defaults: { shoot: "the authored outfit", call: "knit and a collar", night: "slip and a coat" },
  never_wear: ["logos", "neon", "sportswear"],
  rotation: "day-hash",
};

const grade: GradeTuning = {
  temperature: "warm",
  contrast: 0.55,
  key_direction: "window left, three quarters",
  lens: "35mm",
  grain: "fine",
};

const places: PlaceTuning[] = [
  {
    id: "bathroom-mirror",
    kind: "bathroom-mirror",
    invariants: ["white square tiles to the ceiling", "single pendant above the sink", "mirror is unframed and clean"],
    shot: "rendered",
    light: "window behind camera right",
  },
  {
    id: "car-interior",
    kind: "car-interior",
    invariants: ["black leather seats", "steering wheel on the left", "no air freshener, ever"],
    shot: "rendered",
  },
];

const tuning: Tuning = { persona: "example", face, hair, style, grade, places };

Deno.test("an appearance is a face, hair, a style, one grade and the rooms she stands in", () => {
  assertEquals(tuningProblems(tuning), []);
  assertEquals(tuningBlocks(tuning).length, 4 + places.length, "face, hair, style, grade, then a line per place");
  assertEquals(tuningPrompt(tuning).split("\n")[0].startsWith("face:"), true);
  assertEquals(tuningPrompt(tuning).includes("location bathroom-mirror"), true);
});

Deno.test("a likeness of a real person is refused, and a licensed one names the paper", () => {
  const copied = faceProblems({ ...face, named_reference: "a well known actor" });
  assertEquals(copied.some((p) => p.includes("likeness is a licence")), true);
  const licensed = faceProblems({ ...face, named_reference: "a well known actor", basis: "licensed" });
  assertEquals(licensed.some((p) => p.includes("names the licence")), true);
  assertEquals(faceProblems({ ...face, named_reference: "a well known actor", basis: "licensed", licensed_reference: "deal 2026-11" }), []);
});

Deno.test("a face with a blank decision or no asymmetry is refused", () => {
  assertEquals(faceProblems({ ...face, eyes: "" }).some((p) => p.includes("eyes")), true);
  assertEquals(faceProblems({ ...face, asymmetry: undefined }).some((p) => p.includes("asymmetry")), true);
  assertEquals(faceProblems({ ...face, age_range: [16, 20] }).some((p) => p.includes("adult")), true);
  assertEquals(faceBlock(face).includes("apparent age 27 to 31"), true);
});

Deno.test("hair needs a cut cycle, because hair does not grow a foot in a week", () => {
  assertEquals(hairProblems(hair), []);
  assertEquals(hairProblems({ ...hair, cut_cycle_days: 5 }).some((p) => p.includes("different haircut")), true);
  assertEquals(hairProblems({ ...hair, texture: "feathered" }).some((p) => p.includes("texture")), true);
});

Deno.test("a shoot past the cut cycle is flagged, and one inside it is not", () => {
  assertEquals(daysSinceCut("2026-11-08", "2026-10-01"), 38);
  assertEquals(hairDrift(hair, "2026-11-08", "2026-10-01"), undefined);
  assertEquals(Boolean(hairDrift(hair, "2026-12-20", "2026-10-01")), true);
  assertEquals(hairDrift(hair, "not a day", "2026-10-01"), "the shoot day or the cut day is not a date");
});

Deno.test("a style is the thing outfits have in common, and it refuses something", () => {
  assertEquals(styleProblems(style), []);
  assertEquals(styleProblems({ ...style, palette_anchors: ["#141414"] }).some((p) => p.includes("single outfit")), true);
  assertEquals(styleProblems({ ...style, never_wear: [] }).some((p) => p.includes("mood board")), true);
  assertEquals(styleProblems({ ...style, rotation: "weekly" as never }).some((p) => p.includes("day-hash or seasonal")), true);
});

Deno.test("an outfit that is not hers is caught before it is rendered", () => {
  assertEquals(outfitFitsStyle(style, ["#5a1f22", "#3a3a3c"], ["dress", "coat"]), []);
  assertEquals(outfitFitsStyle(style, ["#00ff00"], ["dress"]).some((p) => p.includes("someone else's")), true);
  assertEquals(outfitFitsStyle(style, ["#5a1f22"], ["logo hoodie"]).some((p) => p.includes("never list")), true);
});

Deno.test("a place holds at least three invariants, and a series cannot shoot one room two ways", () => {
  assertEquals(placeProblems(places[0]), []);
  assertEquals(placeProblems({ ...places[0], invariants: ["tiles"] }).some((p) => p.includes("different room")), true);
  assertEquals(placeProblems({ ...places[0], shot: "painted" as never }).length > 0, true);
  assertEquals(placePathProblems(places, "rendered"), []);
  assertEquals(placePathProblems([...places, { ...places[1], id: "kitchen", shot: "generated" }], "rendered").length, 1);
  assertEquals(placeBlock(places[1]).includes("no air freshener"), true);
});

Deno.test("one grade, and a grade that is a decision rather than a filter", () => {
  assertEquals(gradeProblems(grade), []);
  assertEquals(gradeProblems({ ...grade, contrast: 2 }).some((p) => p.includes("0 to 1")), true);
  assertEquals(gradeProblems({ ...grade, lens: "" }).some((p) => p.includes("lens")), true);
});

Deno.test("the digest the head seals is canonical, and an invalid appearance is not sealed at all", async () => {
  const a = await tuningDigest(tuning);
  const reordered = await tuningDigest({ ...tuning, places: [...places].reverse() });
  assertEquals(a, reordered, "place order is not a different appearance");
  const changed = await tuningDigest({ ...tuning, grade: { ...grade, temperature: "cool" } });
  assertEquals(a === changed, false);
  assertEquals(a.length, 64);
  assertEquals(canonicalTuning(tuning).includes("bathroom-mirror"), true);
  let refused = false;
  try {
    await tuningDigest({ ...tuning, face: { ...face, eyes: "" } });
  } catch {
    refused = true;
  }
  assertEquals(refused, true, "a tuning with a hole in it has no digest");
});
