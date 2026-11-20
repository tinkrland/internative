import { assertEquals, assert } from "jsr:@std/assert@1";
import { loadPersonaFile, listPersonas } from "../persona/loader.ts";
import { internativeProblems, type Internative } from "../persona/internative.ts";

const claire = await loadPersonaFile(new URL("../personas/claire.persona.jsonc", import.meta.url).pathname);

Deno.test("claire is a persona the loader accepts", () => {
  assertEquals(claire.id, "claire");
  assertEquals(claire.display_name, "Claire");
  assertEquals(claire.surfaces, ["shortform", "static", "longform", "audio", "text"]);
});

Deno.test("her refusals are the studygram ones, not a generic brand's", () => {
  const never = claire.brand.never.join(" ");
  assert(never.includes("grade"), "a study account that claims a grade is lying about the one thing it is for");
  assert(never.includes("notes"), "someone else's notes need a name attached");
  assert(never.includes("study streak"), "a backdated session is the cheapest lie available here");
  assertEquals(claire.publishing?.requires_owner_approval, true);
});

Deno.test("every register she does not operate still exists, so the surface can be switched on", () => {
  const surfaces = ["shortform", "static", "longform", "audio", "text", "meetings", "streaming", "music"] as const;
  for (const surface of surfaces) {
    assert(claire.voice.register_by_surface[surface], surface);
  }
  assert(claire.voice.register_by_surface.meetings.register.startsWith("not enabled"));
});

Deno.test("claire is an internative with one aipn, and her id is not a room", () => {
  const record: Internative = {
    id: claire.id, name: claire.display_name, aipn: "AIPN-000002",
    surfaces: claire.surfaces as never, home_surface: "shortform" as never,
  };
  assertEquals(internativeProblems(record), []);
});

Deno.test("the example persona still loads next to her", async () => {
  const all = await listPersonas(new URL("../personas/", import.meta.url).pathname);
  const ids = all.map((p) => p.id).sort();
  assertEquals(ids, ["claire", "example"]);
});
