import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../../persona/loader.ts";
import { goLive, missingCredentials, streamingSurface } from "../server/surface.ts";
import { Presence, type PresenceSession } from "../server/presence.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");

function fakes() {
  const calls: string[] = [];
  const session: PresenceSession = {
    switchScene: (s) => { calls.push(`scene:${s}`); return Promise.resolve(); },
    setCameraVisible: (v) => { calls.push(`camera:${v}`); return Promise.resolve(); },
    startStream: () => { calls.push("start"); return Promise.resolve(); },
    stopStream: () => { calls.push("stop"); return Promise.resolve(); },
  };
  const bridge = {
    setStreamTarget: (server: string, key: string) => {
      calls.push(`target:${server}`);
      assertEquals(key.startsWith("live_"), true);
      return Promise.resolve();
    },
  } as never;
  return { session, bridge, calls };
}

Deno.test("the surface speaks with the persona's streaming register", () => {
  const surface = streamingSurface(persona, "kick");
  assertEquals(surface.name, "streaming");
  assertEquals(surface.platform, "kick");
  const brief = surface.brief();
  assertStringIncludes(brief, "surface: streaming (stream)");
  assertStringIncludes(brief, surface.register().register);
});

Deno.test("go live points obs, walks presence, and receipts without the key", async () => {
  Deno.env.set("CLAWBUZZ_TWITCH_STREAM_KEY", "live_abc");
  const { session, bridge, calls } = fakes();
  const presence = new Presence(session);
  const result = await goLive(bridge, presence, { destination: "twitch" });
  assertEquals(result.destination, "twitch");
  assertEquals(result.receipt.includes("live_abc"), false);
  assertEquals(calls, ["target:rtmp://live.twitch.tv/app", "scene:idle", "camera:false", "scene:live", "camera:true", "start"]);
  assertEquals(presence.state, "live");
  Deno.env.delete("CLAWBUZZ_TWITCH_STREAM_KEY");
});

Deno.test("a stream with no credentials refuses before touching obs", async () => {
  for (const k of ["CLAWBUZZ_TWITCH_STREAM_KEY", "TWITCH_STREAM_KEY"]) Deno.env.delete(k);
  const { session, bridge, calls } = fakes();
  await assertRejects(
    () => goLive(bridge, new Presence(session), { destination: "twitch" }),
    Error,
    "not configured",
  );
  assertEquals(calls, [], "nothing was pointed and nothing started");
});

Deno.test("the surface reports which destinations are missing, and only real ones", () => {
  // this says nothing about which are missing: credentials are environment,
  // and the destination tests own that assertion. it says the roster is
  // closed and the report is a subset of it.
  const missing = missingCredentials();
  assertEquals(Array.isArray(missing), true);
  assertEquals(missing.every((d) => ["twitch", "kick", "youtube"].includes(d)), true);
});
