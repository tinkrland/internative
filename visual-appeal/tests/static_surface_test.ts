import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../../persona/loader.ts";
import { loadPlaces, loadWardrobe } from "../../tools/libraries.ts";
import { makeStill, prepareCarousel, prepareStill, staticSurface } from "../surface.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");
const libraries = { places: await loadPlaces("example"), wardrobe: await loadWardrobe("example") };

const stillRequest = {
  place_id: "car-interior",
  outfit_id: "plain-tee",
  day: "2026-11-07",
  composition: "driver's seat, hands on the wheel",
  magnification: "medium, the windscreen in frame",
  frameTarget: "portrait",
};

Deno.test("the surface is the static lane and runs as the frame operator", () => {
  const surface = staticSurface(persona);
  assertEquals(surface.name, "static");
  assertEquals(surface.platform, "instagram");
  assertEquals(surface.crew().member.role, "the frame operator");
});

Deno.test("preparing a still is planning a shot, with the room and the clothes", () => {
  const plan = prepareStill(persona, libraries, stillRequest);
  assertEquals(plan.shot.place.id, "car-interior");
  assertEquals(plan.shot.outfit.id, "plain-tee");
  assertEquals(plan.drifted, []);
});

Deno.test("no provider configured means the frame stays a plan, and it says so", async () => {
  await assertRejects(() => makeStill(persona, libraries, stillRequest, []), Error, "no still provider");
});

Deno.test("a configured provider makes the frame and the output records which model", async () => {
  const out = await makeStill(persona, libraries, stillRequest, [{
    name: "fake-model",
    generate: async () => ({ uri: "file:///tmp/frame.png" }),
  }]);
  assertEquals(out.provider, "fake-model");
  assertEquals(out.uri, "file:///tmp/frame.png");
  assertEquals(out.seed > 0, true);
  assertEquals(out.prompt.includes("wardrobe:"), true);
});

Deno.test("a carousel is prepared through the same libraries", () => {
  const slides = prepareCarousel(persona, libraries, {
    place_id: "bathroom-mirror",
    outfit_id: "desk-day",
    day: "2026-11-07",
    magnification: "medium, one person, the mirror in frame",
    frameTarget: "portrait",
    slides: [
      { claim: "one", composition: "waist up, eyes to camera", alt: "alt a" },
      { claim: "two", composition: "close on the phone in her hand", alt: "alt b" },
    ],
  });
  assertEquals(slides.length, 2);
  assertEquals(slides[0].plan.shot.place.id, "bathroom-mirror");
});
