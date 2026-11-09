import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../persona/loader.ts";
import { brandLine, checkBrand, personaBrief } from "../persona/brand.ts";

const EXAMPLE = new URL("../personas/example.persona.jsonc", import.meta.url).pathname;
const persona = await loadPersonaFile(EXAMPLE);

Deno.test("the brief carries identity, register, refusals and disclosure", () => {
  const brief = personaBrief(persona, { surface: "text", platform: "bluesky" });
  assertStringIncludes(brief, persona.brand.positioning);
  assertStringIncludes(brief, persona.brand.promise);
  assertStringIncludes(brief, "platform: bluesky");
  assertStringIncludes(brief, "looser than x");
  for (const item of persona.brand.never) assertStringIncludes(brief, `- ${item}`);
  assertStringIncludes(brief, persona.brand.disclosure);
  assertStringIncludes(brief, "mode: draft");
  assertStringIncludes(brief, "stops for owner approval");
});

Deno.test("the same brief, different rooms", () => {
  const meeting = personaBrief(persona, { surface: "meetings", platform: "zoom" });
  const stream = personaBrief(persona, { surface: "streaming", platform: "twitch" });
  if (meeting === stream) throw new Error("surfaces must not share a register");
  assertStringIncludes(meeting, "surface: meetings (call)");
  assertStringIncludes(stream, "surface: streaming (stream)");
});

Deno.test("the brand checks pass on a well formed persona", () => {
  const check = checkBrand(persona);
  assertEquals(check.ok, true);
});

Deno.test("a live persona that still demands approval is flagged as a contradiction", () => {
  const contradictory = { ...persona, publishing: { mode: "live" as const, requires_owner_approval: true } };
  const check = checkBrand(contradictory);
  assertEquals(check.ok, false);
  if (!check.warnings.some((w) => w.includes("one of the two is a lie"))) throw new Error(check.warnings.join("\n"));
});

Deno.test("a disclosure that does not disclose is flagged", () => {
  const vague = { ...persona, brand: { ...persona.brand, disclosure: "be honest" } };
  const check = checkBrand(vague);
  assertEquals(check.ok, false);
});

Deno.test("the identity line names the persona, not the branch", () => {
  assertStringIncludes(brandLine(persona), "example");
  assertStringIncludes(brandLine(persona), persona.one_liner.slice(0, 20));
});
