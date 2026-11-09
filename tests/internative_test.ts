import { assertEquals } from "jsr:@std/assert@1";
import { artistIdentity, internativeLine, internativeProblems, registryProblems, type Internative } from "../persona/internative.ts";
import { SURFACES } from "../persona/schema.ts";

const internative: Internative = {
  id: "example",
  name: "Example",
  aipn: "AIPN-000001",
  surfaces: ["text", "shortform", "audio", "music"],
  rights_holder: "tinkrland ltd",
  home_surface: "rss" as never,
};

const valid: Internative = { ...internative, home_surface: "text" };

Deno.test("an internative is a person with one number and a set of mouths", () => {
  assertEquals(internativeProblems(valid), []);
  assertEquals(internativeLine(valid), "Example (AIPN-000001) shows up on text, shortform, audio, music.");
});

Deno.test("a surface is not a person, so it cannot be the internative's id", () => {
  for (const surface of SURFACES) {
    const clash = internativeProblems({ ...valid, id: surface });
    assertEquals(clash.some((p) => p.includes("a surface is not a person")), true, surface);
  }
});

Deno.test("one internative, one number: a missing or malformed aipn is refused", () => {
  assertEquals(internativeProblems({ ...valid, aipn: "" }).some((p) => p.includes("not an aipn")), true);
  assertEquals(internativeProblems({ ...valid, aipn: "AIPN-1" }).some((p) => p.includes("not an aipn")), true);
  assertEquals(internativeProblems({ ...valid, aipn: "pack-9f2c" }).some((p) => p.includes("assigned once")), true);
});

Deno.test("surfaces are real, unique, and a home surface is one of them", () => {
  assertEquals(internativeProblems({ ...valid, surfaces: [] }).some((p) => p.includes("only in a document")), true);
  assertEquals(internativeProblems({ ...valid, surfaces: ["text", "text"] }).some((p) => p.includes("one mouth is one mouth")), true);
  assertEquals(internativeProblems({ ...valid, surfaces: ["podcast" as never] }).some((p) => p.includes("not a surface")), true);
  assertEquals(internativeProblems({ ...valid, home_surface: "streaming" }).some((p) => p.includes("not one of its surfaces")), true);
});

Deno.test("a number cannot be claimed twice in one registry", () => {
  const second: Internative = { id: "other", name: "Other", aipn: "AIPN-000001", surfaces: ["text"] };
  assertEquals(registryProblems([valid, second]).some((p) => p.includes("claimed by")), true);
  const third: Internative = { id: "other", name: "Other", aipn: "AIPN-000002", surfaces: ["text"] };
  assertEquals(registryProblems([valid, third]), []);
  assertEquals(registryProblems([valid, { ...third, id: "example" }]).some((p) => p.includes("registered twice")), true);
});

Deno.test("a release needs a rights holder, because a store cannot pay an internet native", () => {
  const noHolder = artistIdentity({ ...valid, rights_holder: undefined });
  assertEquals(noHolder.identity, undefined);
  assertEquals(noHolder.problems.some((p) => p.includes("human or entity behind")), true);
  const identity = artistIdentity(valid);
  assertEquals(identity.identity, { artist_name: "Example", rights_holder: "tinkrland ltd", aipn: "AIPN-000001" });
  assertEquals(artistIdentity({ ...valid, surfaces: ["text"] }).problems.some((p) => p.includes("does not operate the music surface")), true);
});
