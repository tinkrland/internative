import { assertEquals, assertStringIncludes, assertThrows } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../../persona/loader.ts";
import { currentSurface, longformSurface, prepareEpisode, uploadPair } from "../surface.ts";
import type { EpisodePlan } from "../episode.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");

function plan(): EpisodePlan {
  return {
    title: "the plate is the product",
    promise: "a real render survives a second visit",
    coldOpen: "every generated background drifts, and the drift is the tell",
    turn: "the point is repeatability, not realism",
    close: "next month, the light rig",
    targetRuntimeSeconds: 900,
    chapters: [
      { title: "the drift", claim: "generated backgrounds drift", evidence: "two frames", seconds: 240 },
      { title: "the lens", claim: "a pinned camera repeats", evidence: "eight renders", seconds: 300 },
      { title: "the trade", claim: "repeatability costs time", evidence: "render logs", seconds: 240 },
    ],
  };
}

Deno.test("the surface speaks with the persona's longform register", () => {
  const surface = longformSurface(persona);
  assertEquals(surface.branch, "longform");
  assertEquals(surface.platform, "youtube");
  const brief = surface.brief();
  assertStringIncludes(brief, "surface: longform (narration)");
  assertStringIncludes(brief, surface.register().register);
});

Deno.test("a prepared episode carries a manifest a renderer can follow", () => {
  const prepared = prepareEpisode(persona, plan());
  assertEquals(prepared.planSeconds, 780);
  assertEquals(prepared.manifest.frame.width, 1920);
  assertEquals(prepared.manifest.chapters.length, 5);
  assertEquals(prepared.manifest.checks.marks, []);
});

Deno.test("a plan that fails its own check is refused before rendering", () => {
  const bad = plan();
  bad.chapters[0].evidence = "";
  assertThrows(() => prepareEpisode(persona, bad), Error, "plan refused");
});

Deno.test("preparing an episode is not publishing one", () => {
  const prepared = prepareEpisode(persona, plan());
  assertEquals(prepared.publishable.ok, false);
  assertStringIncludes(prepared.publishable.reason, "publishing");
});

Deno.test("the upload pair names one frame family and its thumbnail", () => {
  const pair = uploadPair();
  assertEquals(pair.video, "youtube_1080");
  assertEquals(pair.thumbnail, "thumbnail");
});

Deno.test("the surface loads by persona id from the persona directory", async () => {
  const surface = await currentSurface("youtube", "example");
  assertEquals(surface.name, "longform");
});
