import { assertEquals } from "jsr:@std/assert@1";
import { checkPhotoshoot, planPhotoshoot, shotSpecs } from "../photoshoot/photoshoot.ts";

const shoot = () => planPhotoshoot({ title: "the good chair", frameTarget: "portrait" });

Deno.test("a shoot is a shot list, not a frame", () => {
  const s = shoot();
  assertEquals(s.shots.length, 4);
  assertEquals(s.shots.map((x) => x.kind), ["hero", "portrait", "detail", "environment"]);
  assertEquals(checkPhotoshoot(s).length, 0);
});

Deno.test("every shot renders from the same authored set", () => {
  const specs = shotSpecs(shoot());
  assertEquals(specs.length, 4);
  assertEquals(specs.every((s) => s.plate.schema === "proskena-scene-state"), true);
  assertEquals(specs.every((s) => s.plate.environment.bg === specs[0].plate.environment.bg), true);
  // the person is never baked into the plate
  assertEquals(specs.every((s) => s.plate.subject === null), true);
  // one out path per shot, so a render cannot overwrite the shoot
  assertEquals(new Set(specs.map((s) => s.plate.out)).size, 4);
});

Deno.test("the frame target is resolved once and shared", () => {
  const specs = shotSpecs(shoot());
  assertEquals(specs[0].frame, { width: 1080, height: 1350 });
  assertEquals(specs.every((s) => s.frame.width === specs[0].frame.width), true);
});

Deno.test("duplicate magnification is a problem, because two alike frames are one", () => {
  const s = shoot();
  s.shots[1].magnification = s.shots[0].magnification;
  const problems = checkPhotoshoot(s);
  assertEquals(problems.some((p) => p.problem.includes("duplicate magnification")), true);
});

Deno.test("a missing frame is named in the report", () => {
  const s = shoot();
  s.shots = s.shots.filter((x) => x.kind !== "environment");
  const problems = checkPhotoshoot(s);
  assertEquals(problems.map((p) => p.shot), ["environment"]);
});

Deno.test("an unknown frame refuses at planning time", () => {
  let threw = false;
  try {
    planPhotoshoot({ title: "x", frameTarget: "billboard" });
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});
