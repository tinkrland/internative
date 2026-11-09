import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../persona/loader.ts";
import { loadPlaces, loadWardrobe } from "../tools/libraries.ts";
import { planShot } from "../persona/shot.ts";
import { adapterForId, buildRequest, planGeneration } from "../generation/adapters.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");
const libs = { wardrobe: await loadWardrobe("example"), places: await loadPlaces("example") };
const shot = planShot(persona, libs, {
  place_id: "bathroom-mirror",
  outfit_id: "plain-tee",
  day: "2026-11-07",
  composition: "waist up, facing the mirror, phone at chest height",
  magnification: "medium, one person, the room readable behind her",
});
const character = "assets/character/front.png";

Deno.test("the provider's own schema decides the field, and it is the one this provider validates", () => {
  const plan = planGeneration(shot, "seedance-2-reference", { characterImage: character });
  const request = buildRequest(plan.adapter, plan, { duration: 8, quality: "1080p", aspect_ratio: "9:16" });
  assertEquals(request.body.image_urls instanceof Array, true);
  assertEquals((request.body.image_urls as string[]).length, plan.references.length);
  assertEquals("reference_images" in request.body, false, "the catalogue's name would be rejected here");
  assertEquals(request.model, "seedance-2.0-reference-to-video");
  assertEquals(request.endpoint, "https://api.evolink.ai/v1/videos/generations");
  assertEquals(request.body.duration, 8);
  assertEquals(request.body.quality, "1080p");
  assertEquals(request.body.aspect_ratio, "9:16");
});

Deno.test("a tagged prompt says which reference is which, instead of leaving it to array order", () => {
  const plan = planGeneration(shot, "seedance-2-reference", { characterImage: character });
  const prompt = buildRequest(plan.adapter, plan).body.prompt as string;
  assertEquals(prompt.startsWith(plan.prompt), true);
  assertEquals(prompt.includes("@image1 is the character"), true);
  assertEquals(prompt.includes("bathroom-mirror"), true);
});

Deno.test("a surface without prompt tags gets the prompt untouched", () => {
  // a keyframe-only surface cannot take the plate set, so the plan is one reference
  const adapter = adapterForId("first-frame-image-to-video");
  const plan = { adapter, references: [{ role: "keyframe" as const, uri: "assets/shots/mirror/keyframe.png" }], prompt: shot.prompt, seed: shot.seed };
  const request = buildRequest(adapter, plan);
  assertEquals(request.body.prompt, plan.prompt);
  assertEquals(request.body.first_frame_image, "assets/shots/mirror/keyframe.png");
});

Deno.test("an image to video surface without a keyframe refuses to build a body", () => {
  const adapter = adapterForId("first-frame-image-to-video");
  assertThrows(() => buildRequest(adapter, {
    adapter,
    references: [{ role: "character", uri: character }],
    prompt: "x",
    seed: 1,
  }), Error, "needs a keyframe");
});

Deno.test("a request with no reference at all is refused, because the endpoint would refuse it anyway", () => {
  const adapter = adapterForId("seedance-2-reference");
  assertThrows(() => buildRequest(adapter, { adapter, references: [], prompt: "x", seed: 1 }), Error, "needs one of");
});
