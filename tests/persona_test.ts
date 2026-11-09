import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { listPersonas, loadPersonaFile, parsePersona, stripJsonc } from "../persona/loader.ts";
import { SURFACES } from "../persona/schema.ts";

const EXAMPLE = new URL("../personas/example.persona.jsonc", import.meta.url).pathname;

Deno.test("jsonc: comments go, string content stays", () => {
  const src = `{
    // a line comment
    "url": "https://example.com/a//b", /* block */
    "list": [1, 2,],
  }`;
  const parsed = JSON.parse(stripJsonc(src));
  assertEquals(parsed.url, "https://example.com/a//b");
  assertEquals(parsed.list, [1, 2]);
});

Deno.test("the example persona loads and carries every surface", async () => {
  const m = await loadPersonaFile(EXAMPLE);
  assertEquals(m.id, "example");
  for (const surface of SURFACES) {
    if (m.surfaces.includes(surface)) assertEquals(typeof m.voice.register_by_surface[surface].register, "string");
  }
  assertEquals(m.publishing?.mode, "draft");
});

Deno.test("every surface has a register even when it is not enabled", async () => {
  const m = await loadPersonaFile(EXAMPLE);
  const enabled = new Set(m.surfaces);
  for (const surface of SURFACES) {
    const r = m.voice.register_by_surface[surface];
    if (!enabled.has(surface)) {
      // the format requires the register anyway, so enabling the
      // surface later is a one-line config change
      assertEquals(typeof r?.register, "string");
    }
  }
});

Deno.test("a persona with no refusals does not load", async () => {
  const m = await loadPersonaFile(EXAMPLE);
  const broken = { ...m, brand: { ...m.brand, never: [] } };
  assertThrows(() => parsePersona(JSON.stringify(broken)), Error, "brand.never");
});

Deno.test("an unknown surface is rejected", async () => {
  const m = await loadPersonaFile(EXAMPLE);
  const broken = { ...m, surfaces: [...m.surfaces, "billboards"] };
  assertThrows(() => parsePersona(JSON.stringify(broken)), Error, "unknown surface");
});

Deno.test("a missing register is reported by surface name", async () => {
  const m = await loadPersonaFile(EXAMPLE);
  const registers: Record<string, unknown> = { ...m.voice.register_by_surface };
  delete registers.audio;
  const broken = { ...m, voice: { ...m.voice, register_by_surface: registers } };
  assertThrows(() => parsePersona(JSON.stringify(broken)), Error, "voice.register_by_surface.audio");
});

Deno.test("tone outside 0..1 is rejected", async () => {
  const m = await loadPersonaFile(EXAMPLE);
  const broken = {
    ...m,
    voice: { ...m.voice, tone_defaults: { ...m.voice.tone_defaults, warmth: 1.4 } },
  };
  assertThrows(() => parsePersona(JSON.stringify(broken)), Error, "voice.tone_defaults.warmth");
});

Deno.test("publishing defaults to draft when omitted", async () => {
  const m = await loadPersonaFile(EXAMPLE);
  const without = { ...m } as Record<string, unknown>;
  delete without.publishing;
  const parsed = parsePersona(JSON.stringify(without));
  assertEquals(parsed.publishing?.mode, "draft");
  assertEquals(parsed.publishing?.requires_owner_approval, true);
});

Deno.test("the persona directory lists the example", async () => {
  const all = await listPersonas(new URL("../personas/", import.meta.url).pathname);
  if (!all.some((p) => p.id === "example")) throw new Error("example persona missing from listing");
});
