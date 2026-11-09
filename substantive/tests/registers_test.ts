import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../../persona/loader.ts";
import { isSpoken, registerFor, resolveRegister, SURFACE_MEDIUM } from "../../persona/registers.ts";
import { personaVoiceStyle } from "../../persona/voice_adapter.ts";

const EXAMPLE = new URL("../../personas/example.persona.jsonc", import.meta.url).pathname;
const persona = await loadPersonaFile(EXAMPLE);

Deno.test("a surface register is what the persona wrote", () => {
  const r = registerFor(persona, "text");
  assertEquals(r.register.startsWith("written voice"), true);
});

Deno.test("a platform override replaces the field it names and keeps the rest", () => {
  const base = registerFor(persona, "text");
  const x = registerFor(persona, "text", "x");
  assertEquals(x.max_chars, 280);
  assertEquals(x.max_sentences, base.max_sentences);
  const linkedin = registerFor(persona, "text", "linkedin");
  assertEquals(linkedin.formality, 0.6);
  assertEquals(linkedin.register.startsWith("professional"), true);
});

Deno.test("an unknown platform falls back to the surface register", () => {
  const base = registerFor(persona, "text");
  const odd = registerFor(persona, "text", "carrd");
  assertEquals(odd, base);
});

Deno.test("resolved registers always carry usable defaults", () => {
  const r = resolveRegister(persona, "streaming", "twitch");
  assertEquals(r.pace, "brisk");
  assertEquals(typeof r.energy, "number");
  assertEquals(r.emoji, "none");
  assertEquals(r.hooks, false);
});

Deno.test("a disabled surface throws instead of improvising", () => {
  const trimmed = { ...persona, surfaces: persona.surfaces.filter((s) => s !== "audio") };
  assertThrows(() => registerFor(trimmed as typeof persona, "audio"));
});

Deno.test("spoken surfaces are the five with a voice", () => {
  assertEquals(isSpoken("meetings"), true);
  assertEquals(isSpoken("audio"), true);
  assertEquals(isSpoken("static"), false);
  for (const surface of ["meetings", "streaming", "shortform", "longform", "audio"] as const) {
    assertEquals(typeof SURFACE_MEDIUM[surface], "string");
  }
});

Deno.test("the voice mapping follows the tone profile", () => {
  const style = personaVoiceStyle(persona, "podcast");
  assertEquals(style.emotion, "determination"); // sarcasm .35, playfulness .55, warmth .62, confidence .72
});
