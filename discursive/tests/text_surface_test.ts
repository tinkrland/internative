import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../../persona/loader.ts";
import { receiptFor, replyTo, textSurface, writeDraft } from "../surface.ts";
import { DraftStore } from "../drafts.ts";
import { parseConnections } from "../../core/connections.ts";
import { crewBrief } from "../../persona/crew.ts";

const EXAMPLE = new URL("../../personas/example.persona.jsonc", import.meta.url).pathname;
const persona = await loadPersonaFile(EXAMPLE);

async function store(): Promise<DraftStore> {
  const dir = await Deno.makeTempDir({ prefix: "clawbuzz-text-" });
  return new DraftStore(`${dir}/drafts.jsonl`);
}

Deno.test("each network gets the persona's register for it", () => {
  const bluesky = textSurface(persona, "bluesky");
  const linkedin = textSurface(persona, "linkedin");
  assertEquals(bluesky.register().max_chars, 300);
  assertEquals(linkedin.register().formality, 0.6);
  assertStringIncludes(bluesky.brief(), "platform: bluesky");
  assertStringIncludes(linkedin.brief(), "professional without the ceremony");
});

Deno.test("the surface refuses a persona that did not enable text", () => {
  const trimmed = { ...persona, surfaces: persona.surfaces.filter((s) => s !== "text") };
  let threw = false;
  try {
    textSurface(trimmed as typeof persona, "x");
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("an idea becomes a draft on disk, and stops there", async () => {
  const s = await store();
  const { draft, composed, surface } = await writeDraft(persona, s, {
    idea: "the plate is a real render. that is the whole argument.",
    channel: "bluesky",
    source: { kind: "episode", uri: "https://example.com/ep/1" },
  });
  assertEquals(draft.status, "draft");
  assertEquals(composed.isThread, false);
  assertEquals(surface.platform, "bluesky");
  const stored = await s.all();
  assertEquals(stored.length, 1);
  assertEquals(stored[0].source?.kind, "episode");
  assertStringIncludes(receiptFor(draft), "bluesky: one post, draft");
});

Deno.test("a long idea becomes a thread draft, with the parts stored", async () => {
  const s = await store();
  const idea = Array.from({ length: 12 }, (_, i) => `this is sentence ${i} and it carries a clause or two.`).join(" ");
  const { draft } = await writeDraft(persona, s, { idea, channel: "x" });
  assertEquals(draft.parts.length > 1, true);
  assertStringIncludes(receiptFor(draft), "parts");
});

Deno.test("a reply carries the scope of the person it answers", async () => {
  const anchors = parseConnections(JSON.stringify([
    { id: "friend", label: "the friend", handles: { bluesky: ["@friend.bsky.social"] } },
  ]));
  const plan = await replyTo(
    persona,
    { channel: "bluesky", authorHandle: "@friend.bsky.social", text: "loved that episode" },
    "thank you, that one took a while",
    { connections: anchors },
  );
  assertEquals(plan.scope.connection_id, "friend");
  assertEquals(plan.composed.parts.length, 1);
});

Deno.test("the surface runs as the written operator, not as the whole persona", () => {
  const s = textSurface(persona, "bluesky");
  const crew = s.crew();
  assertEquals(crew.surface, "text");
  assertEquals(crew.explicit, true);
  assertEquals(crew.member.role, "the written operator");
  // the operator narrows the surface register; the platform override still
  // applies on top, which is why this compares with the surface, not bluesky
  assertStringIncludes(crew.register, persona.voice.register_by_surface.text.register);
  // the identity is the head's, the post is this operator's
  const brief = crewBrief(persona, "text", "bluesky");
  assertStringIncludes(brief, persona.brand.disclosure);
  assertStringIncludes(brief, "reply triage");
});
