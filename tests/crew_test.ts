import { assertEquals, assertStringIncludes, assertThrows } from "jsr:@std/assert@1";
import { crewBrief, crewFor, crewProblems, crewRoster } from "../persona/crew.ts";
import { loadPersonaFile, parsePersona, stripJsonc } from "../persona/loader.ts";
import { SURFACES } from "../persona/schema.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");

Deno.test("the example persona fields a crew, one per vertical", () => {
  const roster = crewRoster(persona);
  assertEquals(roster.length, persona.surfaces.length);
  assertEquals(roster.every((c) => c.explicit), true);
  assertEquals(roster.map((c) => c.surface).sort(), SURFACES.slice().sort());
});

Deno.test("seven operators, one identity: the brief never changes hands", () => {
  const texts = SURFACES.map((s) => crewBrief(persona, s));
  for (const brief of texts) {
    // the identity lines are identical across every vertical
    assertStringIncludes(brief, `promise: ${persona.brand.promise}`);
    assertStringIncludes(brief, persona.brand.never[0]);
    assertStringIncludes(brief, persona.brand.disclosure);
    // and the post is the part that differs
    assertStringIncludes(brief, "# your post");
  }
  const roles = new Set(texts.map((t) => t.split("# your post")[1].split("\n")[1]));
  assertEquals(roles.size, SURFACES.length, "every operator has its own post");
});

Deno.test("a crew member adds a register note, it does not replace the register", () => {
  const patched = structuredClone(persona);
  patched.crew!.text = { ...patched.crew!.text!, register_notes: "lowercase, no full stops at the end" };
  const crew = crewFor(patched, "text");
  const surfaceRegister = crewFor(persona, "text").register;
  assertStringIncludes(crew.register, surfaceRegister);
  assertStringIncludes(crew.register, "no full stops");
});

Deno.test("a vertical with no named operator still gets a post", () => {
  const bare = structuredClone(persona);
  delete bare.crew!.audio;
  const crew = crewFor(bare, "audio");
  assertEquals(crew.explicit, false);
  assertStringIncludes(crew.member.role, "audio");
  assertEquals(crew.register.length > 0, true);
});

Deno.test("a crew entry cannot be empty", () => {
  const broken = structuredClone(persona);
  broken.crew!.static = { role: "", focus: [] };
  const problems = crewProblems(broken);
  assertStringIncludes(problems.join("\n"), "crew.static.role");
  assertStringIncludes(problems.join("\n"), "crew.static.focus");
});

Deno.test("the loader refuses a manifest with an empty operator", () => {
  const broken = JSON.parse(stripJsonc(Deno.readTextFileSync("personas/example.persona.jsonc")));
  broken.crew.streaming.focus = [];
  assertThrows(() => parsePersona(JSON.stringify(broken)), Error, "crew.streaming.focus");
});

Deno.test("the surface exposes its operator", () => {
  const s = crewFor(persona, "meetings");
  assertEquals(s.member.skills?.includes("attendance"), true);
  assertEquals(s.member.escalate_to_owner?.length! > 0, true);
});
