import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { attendeeIdentity, currentMeetingsSurface, meetingsSurface } from "./surface.ts";
import { loadPersonaFile } from "../../persona/loader.ts";
import { parseConnections } from "../../core/connections.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");

Deno.test("the meetings surface speaks with the persona's register", () => {
  const s = meetingsSurface(persona, "zoom");
  const brief = s.brief();
  assertStringIncludes(brief, "surface: meetings (call)");
  assertStringIncludes(brief, s.register().register);
  assertEquals(s.platform, "zoom");
});

Deno.test("a meeting resolves its host through the anchors", () => {
  const connections = parseConnections(JSON.stringify([
    { id: "host-1", label: "the host", handles: { zoom: ["host@example.com"], email: ["host@example.com"] } },
  ]));
  const id = attendeeIdentity({ platform: "zoom", zoom_user_email: "host@example.com" }, connections);
  assertEquals(id.host_connection?.id, "host-1");
  assertEquals(id.resolved_via, "meeting_platform");
});

Deno.test("a display name is not a handle", () => {
  const id = attendeeIdentity({ platform: "zoom", host_name: "The Host" });
  assertEquals(id.host_connection, null);
  assertEquals(id.scope.anchor, "no_config");
});

Deno.test("a deploy with no persona refuses to pretend", async () => {
  Deno.env.delete("CLAWBUZZ_PERSONA");
  await assertRejects(() => currentMeetingsSurface(), Error, "CLAWBUZZ_PERSONA is unset");
});
