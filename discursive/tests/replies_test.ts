import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { groundingFor, planReply } from "../replies.ts";
import { parseConnections } from "../../core/connections.ts";
import { loadPersonaFile } from "../../persona/loader.ts";

const EXAMPLE = new URL("../../personas/example.persona.jsonc", import.meta.url).pathname;
const persona = await loadPersonaFile(EXAMPLE);

const ANCHORS = parseConnections(JSON.stringify([
  { id: "friend", label: "the friend", handles: { x: ["@friend"], discord: ["friend#1"], email: ["friend@example.com"] } },
  { id: "owner", label: "the persona", owner: true, handles: { x: ["example"] } },
]));

const EVENT = {
  channel: "x" as const,
  authorHandle: "@friend",
  authorDisplay: "the friend",
  text: "when is the next episode",
};

Deno.test("a reply declares the surface and the person before it is written", async () => {
  const plan = await planReply(persona, EVENT, { replyText: "thursday, and it is a short one", connections: ANCHORS });
  assertEquals(plan.scope.platform, "x");
  assertEquals(plan.scope.connection_id, "friend");
  assertEquals(plan.scope.persona_id, "example");
  assertEquals(plan.privacy, "public_social");
  assertEquals(plan.register.max_chars, 280);
});

Deno.test("a stranger stays a stranger, and the reply is written without history", async () => {
  const plan = await planReply(
    persona,
    { ...EVENT, authorHandle: "@somebody_new" },
    { replyText: "thanks for asking", connections: ANCHORS },
  );
  assertEquals(plan.scope.connection_id, null);
  assertEquals(plan.scope.anchor, "stranger");
  assertEquals(plan.memory.titles, []);
  assertEquals(groundingFor(plan).known, false);
  assertEquals(groundingFor(plan).note.includes("unknown person"), true);
});

Deno.test("memory is off, not invented, when the memory server is unset", async () => {
  const plan = await planReply(persona, EVENT, { replyText: "thursday", connections: ANCHORS });
  assertEquals(plan.memory.enabled, false);
  assertEquals(plan.memory.nodes, 0);
  assertEquals(plan.memory.withheld, 0);
});

Deno.test("discord is treated as a private room, not a broadcast", async () => {
  const plan = await planReply(
    persona,
    { channel: "discord", authorHandle: "friend#1", text: "you around" },
    { replyText: "here, what is up", connections: ANCHORS },
  );
  assertEquals(plan.privacy, "private");
  assertEquals(plan.scope.connection_id, "friend");
});

Deno.test("a reply that needs a thread is refused, because that is a post", async () => {
  const long = Array.from({ length: 40 }, (_, i) => `sentence ${i} goes on a bit.`).join(" ");
  assertThrows(
    () => {
      throw new Error("placeholder");
    },
    Error,
  );
  let threw = false;
  try {
    await planReply(persona, EVENT, { replyText: long, connections: ANCHORS });
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "an over length reply is refused rather than split into a thread");
});

Deno.test("the emoji policy applies to replies too", async () => {
  const plan = await planReply(persona, EVENT, { replyText: "thursday 🎬", connections: ANCHORS });
  assertEquals(plan.composed.parts[0].includes("🎬"), false);
  assertEquals(plan.composed.dropped.emoji, 1);
});
