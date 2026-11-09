import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../../persona/loader.ts";
import { prepareClip, shortformSurface } from "../surface.ts";
import { planClip } from "../clip.ts";
import { clipSpec, specReadyToPublish } from "../clip_specs.ts";

const EXAMPLE = new URL("../../personas/example.persona.jsonc", import.meta.url).pathname;
const persona = await loadPersonaFile(EXAMPLE);

Deno.test("the surface speaks with the persona's shortform register", () => {
  const surface = shortformSurface(persona, "reels");
  assertEquals(surface.name, "shortform");
  assertEquals(surface.platform, "reels");
  assertStringIncludes(surface.brief(), "surface: shortform (clip)");
  assertEquals(surface.register().hooks, true, "shortform asks for a hook");
});

Deno.test("the surface cannot be constructed on a persona that disabled it", () => {
  const trimmed = { ...persona, surfaces: persona.surfaces.filter((s) => s !== "shortform") };
  let threw = false;
  try {
    shortformSurface(trimmed as typeof persona, "tiktok");
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("prepareClip walks the gates and stops before any send", () => {
  const plan = planClip({
    idea: "one idea",
    lines: ["your background is a lie", "this one is geometry", "that is why it never drifts"],
  });
  const ready = prepareClip(persona, plan, { platform: "tiktok", placement: { fitHeight: 0.78, anchorY: 0.08 } });
  assertEquals(ready.job.frame.height, 1920);
  assertEquals(ready.publishable.ok, false);
  assertStringIncludes(ready.publishable.reason, "spec:");
  assertStringIncludes(ready.publishable.reason, "publishing blocked");
});

Deno.test("every network spec carries its confidence and its sizing", () => {
  for (const platform of ["tiktok", "reels", "shorts"] as const) {
    const spec = clipSpec(platform);
    assertEquals(spec.target, "vertical");
    assertEquals(spec.captionMaxChars > 0, true);
    assertEquals(typeof spec.verified, "boolean");
    if (!spec.verified) assertEquals(typeof spec.confirm, "string");
  }
  assertEquals(specReadyToPublish("tiktok").ready, false);
});
