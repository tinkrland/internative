import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../../persona/loader.ts";
import { loadPlaces, loadWardrobe } from "../../tools/libraries.ts";
import { generateStill, planStill, type StillProvider } from "../still.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");
const libraries = { places: await loadPlaces("example"), wardrobe: await loadWardrobe("example") };

const base = {
  place_id: "bathroom-mirror",
  outfit_id: "plain-tee",
  day: "2026-11-07",
  composition: "waist up, facing the mirror, phone at chest height",
  magnification: "medium, one person, the room readable behind her",
  frameTarget: "portrait",
};

Deno.test("a still names a room from the library and an outfit from the closet", () => {
  const plan = planStill(persona, libraries, base);
  assertEquals(plan.shot.place.id, "bathroom-mirror");
  assertEquals(plan.shot.outfit.id, "plain-tee");
  assertEquals(plan.prompt.split("\n").length, 5);
  assertEquals(plan.prompt.includes("wardrobe:"), true);
  assertEquals(plan.frame.width < plan.frame.height, true);
  assertEquals(plan.drifted, []);
});

Deno.test("the same day, room and outfit give the same seed", () => {
  const a = planStill(persona, libraries, base);
  const b = planStill(persona, libraries, base);
  assertEquals(a.seed, b.seed);
  const other = planStill(persona, libraries, { ...base, outfit_id: "cold-out" });
  assertEquals(other.seed === a.seed, false, "a different outfit is a different frame");
});

Deno.test("changing only the composition is not drift", () => {
  const first = planStill(persona, libraries, base);
  const second = planStill(persona, libraries, { ...base, composition: "close on the hands and the phone", reference: first });
  assertEquals(second.drifted, []);
  assertEquals(second.shot.blocks.character, first.shot.blocks.character);
});

Deno.test("a series may not change the room and call it the same shoot", async () => {
  const first = planStill(persona, libraries, base);
  const moved = planStill(persona, libraries, {
    ...base,
    place_id: "car-interior",
    composition: "driver's seat, hands on the wheel",
    reference: first,
  });
  assertEquals(moved.drifted.includes("location"), true);
  await assertRejects(() => generateStill({ name: "fake", generate: async () => ({ uri: "x" }) }, moved), Error, "series drift");
});

Deno.test("an outfit change inside one shoot is drift, and says so", () => {
  const first = planStill(persona, libraries, base);
  const changed = planStill(persona, libraries, { ...base, outfit_id: "desk-day", reference: first });
  assertEquals(changed.drifted.includes("wardrobe"), true);
  assertEquals(changed.drifted.includes("character"), false, "the person did not change, the clothes did");
});

Deno.test("a room that is not in the library is refused, never improvised", () => {
  assertThrows(() => planStill(persona, libraries, { ...base, place_id: "some-cafe" }), Error, "no place \"some-cafe\"");
});

Deno.test("the provider gets the axis prompt and the seed, and the receipt records both", async () => {
  const seen: { prompt: string; seed: number }[] = [];
  const provider: StillProvider = {
    name: "fake-model",
    generate: async (input) => {
      seen.push({ prompt: input.prompt, seed: input.seed });
      return { uri: "file:///tmp/still.png" };
    },
  };
  const plan = planStill(persona, libraries, base);
  const receipt = await generateStill(provider, plan);
  assertEquals(seen.length, 1);
  assertEquals(seen[0].seed, plan.seed);
  assertEquals(receipt.provider, "fake-model");
  assertEquals(receipt.uri, "file:///tmp/still.png");
  assertEquals(receipt.prompt, plan.prompt);
});
