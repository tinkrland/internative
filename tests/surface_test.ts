import { assertEquals, assertStringIncludes, assertThrows } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../persona/loader.ts";
import { defineSurface, SURFACE_BRANCH, SURFACE_DEFAULT_PLATFORM } from "../core/surface.ts";
import { parseConnections } from "../core/connections.ts";
import { canPublishTo, publishingDecision } from "../core/publishing.ts";

const EXAMPLE = new URL("../personas/example.persona.jsonc", import.meta.url).pathname;
const persona = await loadPersonaFile(EXAMPLE);

const ANCHORS = parseConnections(JSON.stringify([
  { id: "friend", label: "the friend", handles: { x: ["@friend"] } },
]));

Deno.test("a surface defaults to its own platform", () => {
  const text = defineSurface("text", { persona });
  assertEquals(text.platform, "x");
  assertEquals(text.branch, "text");
  for (const [surface, platform] of Object.entries(SURFACE_DEFAULT_PLATFORM)) {
    assertEquals(typeof platform, "string", surface);
  }
  assertEquals(SURFACE_BRANCH.static, "static");
});

Deno.test("a surface refuses to run when the persona did not enable it", () => {
  const trimmed = { ...persona, surfaces: persona.surfaces.filter((s) => s !== "streaming") };
  assertThrows(() => defineSurface("streaming", { persona: trimmed as typeof persona }));
});

Deno.test("the brief and the register agree with the manifest", () => {
  const text = defineSurface("text", { persona, platform: "bluesky" });
  assertStringIncludes(text.brief(), "platform: bluesky");
  assertEquals(text.register().max_chars, 300);
  assertEquals(text.register().register.startsWith("looser than x"), true);
});

Deno.test("memory scope is built from the handle the surface actually holds", () => {
  const text = defineSurface("text", { persona, platform: "x", connections: ANCHORS });
  assertEquals(text.scope().anchor, "stranger"); // anchors loaded, no handle held: honest stranger
  const anchored = text.scope("friend");
  assertEquals(anchored.connection_id, "friend");
  assertEquals(anchored.persona_id, "example");
});

Deno.test("no retelldb configured means memory is off, not invented", async () => {
  const text = defineSurface("text", { persona });
  const result = await text.recall("what did we discuss");
  assertEquals(result, null);
  assertEquals(await text.remember("something worth keeping"), false);
});

Deno.test("publishing defaults to draft and blocks the send", () => {
  const text = defineSurface("text", { persona });
  const decision = text.publishing();
  assertEquals(decision.mode, "draft");
  assertEquals(decision.allowed(true), false);
  assertEquals(canPublishTo(decision, { token: "t", approved: true }).ok, false);
});

Deno.test("scheduled publishing still honors per-artifact approval", () => {
  const scheduled = { ...persona, publishing: { mode: "scheduled" as const, requires_owner_approval: true } };
  const decision = publishingDecision(scheduled);
  assertEquals(decision.allowed(false), false);
  assertEquals(decision.allowed(true), true);
  assertEquals(canPublishTo(decision, { token: null, approved: true }).ok, false);
  assertEquals(canPublishTo(decision, { token: "tok", approved: true }).ok, true);
});

Deno.test("live without a credential is still a draft, and says so", () => {
  const live = { ...persona, publishing: { mode: "live" as const, requires_owner_approval: false } };
  const decision = publishingDecision(live);
  assertEquals(decision.allowed(), true);
  const gate = canPublishTo(decision, { token: null });
  assertEquals(gate.ok, false);
  assertStringIncludes(gate.reason, "no credential");
});
