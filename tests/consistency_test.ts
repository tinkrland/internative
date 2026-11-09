import { assertEquals } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../persona/loader.ts";
import {
  characterBlock,
  CONSISTENCY_AXES,
  consistencyBlocks,
  consistencyDrift,
  consistencyFingerprint,
  consistencyProblems,
  consistencyPrompt,
  consistencySeed,
  type SceneSpec,
} from "../persona/consistency.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");
const scene: SceneSpec = {
  location: "the same kitchen at 7am: window light from the left, chipped mug on the counter",
  composition: "medium, subject on the right third, counter edge leading in from the left",
  magnification: "waist up, 50mm equivalent, no wide establishing",
};

Deno.test("the four axes are mandatory and ordered", () => {
  const prompt = consistencyPrompt(persona, scene);
  const order = CONSISTENCY_AXES.map((axis) => prompt.indexOf(`${axis}: `));
  assertEquals(order.every((at) => at >= 0), true, "every axis is labelled");
  assertEquals(order, [...order].sort((a, b) => a - b), "character, location, composition, magnification, in that order");
});

Deno.test("the character line is the persona's, not the shot's", () => {
  const blocks = consistencyBlocks(persona, scene);
  assertEquals(blocks.character, characterBlock(persona));
  assertEquals(prompt_has_name(consistencyPrompt(persona, scene)), true);
  // two different scenes keep one character line
  const other = consistencyBlocks(persona, { ...scene, location: "the same kitchen at midnight, one lamp on" });
  assertEquals(other.character, blocks.character);
});

function prompt_has_name(prompt: string): boolean {
  return prompt.split("\n")[0].includes(persona.display_name);
}

Deno.test("a thin or empty axis is a problem, by name", () => {
  const problems = consistencyProblems({ ...consistencyBlocks(persona, scene), magnification: "" });
  assertEquals(problems.map((p) => p.axis), ["magnification"]);
  const thin = consistencyProblems({ ...consistencyBlocks(persona, scene), location: "a room" });
  assertEquals(thin[0].axis, "location");
  assertEquals(thin[0].problem.includes("too thin"), true);
  assertEquals(consistencyProblems(consistencyBlocks(persona, scene)).length, 0);
});

Deno.test("the seed follows the text: same setup same seed, one changed axis a new one", () => {
  const base = consistencyBlocks(persona, scene);
  assertEquals(consistencySeed(base), consistencySeed({ ...base }));
  assertEquals(consistencySeed(base) === consistencySeed({ ...base, magnification: "full body, 35mm" }), false);
  assertEquals(consistencySeed(base) > 0 && consistencySeed(base) < 4294967295, true);
});

Deno.test("drift names the axes that changed, and the fingerprint is the whole setup", () => {
  const reference = consistencyBlocks(persona, scene);
  const candidate = { ...reference, composition: "wide, subject small in the frame" };
  assertEquals(consistencyDrift(reference, candidate), ["composition"]);
  assertEquals(consistencyDrift(reference, reference), []);
  assertEquals(consistencyFingerprint(reference) === consistencyFingerprint(candidate), false);
});

Deno.test("the example persona yields a usable prompt with no placeholders", () => {
  const prompt = consistencyPrompt(persona, scene);
  assertEquals(prompt.includes("undefined"), false);
  assertEquals(prompt.includes("todo"), false);
  assertEquals(prompt.split("\n").length, 4);
});
