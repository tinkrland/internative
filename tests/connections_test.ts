import { assertEquals } from "jsr:@std/assert@1";
import {
  normalizeHandle,
  ownerHandle,
  parseConnections,
  platformClass,
  resolveConnection,
} from "../core/connections.ts";

Deno.test("handles fold only where folding is identity-safe", () => {
  assertEquals(normalizeHandle("email", " Person@Example.COM "), "person@example.com");
  assertEquals(normalizeHandle("whatsapp", "+1 (555) 010-9999"), "+15550109999");
  assertEquals(normalizeHandle("x", "@Example"), "example");
  assertEquals(normalizeHandle("bluesky", "@example.bsky.social"), "example.bsky.social");
  assertEquals(normalizeHandle("discord", "Example#1"), "example#1");
  assertEquals(normalizeHandle("slack", "U0AB12CD"), "U0AB12CD");
  assertEquals(normalizeHandle("", "x"), "x");
  assertEquals(normalizeHandle("email", "   "), "");
});

Deno.test("platforms class into the privacy buckets the read rules use", () => {
  assertEquals(platformClass("zoom"), "meeting");
  assertEquals(platformClass("webex"), "meeting");
  assertEquals(platformClass("email"), "private");
  assertEquals(platformClass("tiktok"), "public_social");
  assertEquals(platformClass("spotify"), "public_social");
  assertEquals(platformClass("website"), "website");
  assertEquals(platformClass("carrier-pigeon"), "unknown");
  assertEquals(platformClass(undefined), "unknown");
});

const ANCHORS = parseConnections(JSON.stringify([
  {
    id: "friend",
    label: "the friend",
    handles: { email: ["Friend@Example.com"], x: ["@friend"], discord: ["friend#1", "123456789"] },
  },
  { id: "owner", label: "the persona", owner: true, handles: { x: ["example"] } },
]));

Deno.test("one handle, one person", () => {
  const r = resolveConnection("email", "friend@example.com", ANCHORS);
  assertEquals(r.connection?.id, "friend");
  assertEquals(r.reason, "anchored");
});

Deno.test("a trailing @ is not a different person", () => {
  assertEquals(resolveConnection("x", "friend", ANCHORS).connection?.id, "friend");
  assertEquals(resolveConnection("x", "@Friend", ANCHORS).connection?.id, "friend");
});

Deno.test("the persona's own accounts are anchored as owner, never as a stranger", () => {
  const r = resolveConnection("x", "@example", ANCHORS);
  assertEquals(r.connection?.owner, true);
});

Deno.test("ambiguous anchors resolve to nobody, on purpose", () => {
  const ambiguous = parseConnections(JSON.stringify([
    { id: "a", handles: { email: ["same@example.com"] } },
    { id: "b", handles: { email: ["same@example.com"] } },
  ]));
  const r = resolveConnection("email", "same@example.com", ambiguous);
  assertEquals(r.connection, null);
  assertEquals(r.reason, "ambiguous");
});

Deno.test("no config means no anchors, not guessed anchors", () => {
  assertEquals(resolveConnection("email", "x@y.z", []).reason, "no_config");
  assertEquals(parseConnections("not json").length, 0);
  assertEquals(parseConnections(JSON.stringify({ id: "x" })).length, 0);
});

Deno.test("ownerHandle normalizes the persona's own handle", () => {
  assertEquals(ownerHandle("x", { x: "@Example" }), "example");
  assertEquals(ownerHandle("bluesky", {}), null);
});
