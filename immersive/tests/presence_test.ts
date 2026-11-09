import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { closeStream, openStream, Presence, PRESENCE_PLANS, type PresenceSession } from "../server/presence.ts";

function fakeSession() {
  const calls: string[] = [];
  const session: PresenceSession = {
    switchScene: (scene) => { calls.push(`scene:${scene}`); return Promise.resolve(); },
    setCameraVisible: (visible) => { calls.push(`camera:${visible}`); return Promise.resolve(); },
    startStream: () => { calls.push("start"); return Promise.resolve(); },
    stopStream: () => { calls.push("stop"); return Promise.resolve(); },
  };
  return { session, calls };
}

Deno.test("walking on: the picture settles before the encoder starts", async () => {
  const { session, calls } = fakeSession();
  const presence = new Presence(session);
  await openStream(presence);
  assertEquals(presence.state, "live");
  assertEquals(calls, ["scene:idle", "camera:false", "scene:live", "camera:true", "start"]);
});

Deno.test("stepping away keeps the stream and hides the face", async () => {
  const { session, calls } = fakeSession();
  const presence = new Presence(session);
  await openStream(presence);
  calls.length = 0;
  const plan = await presence.to("brb");
  assertEquals(plan.streaming, true);
  assertEquals(plan.cameraVisible, false);
  assertEquals(calls, ["scene:brb", "camera:false"], "no stop: the room stays open");
});

Deno.test("ending stops the encoder before it clears the scene", async () => {
  const { session, calls } = fakeSession();
  const presence = new Presence(session);
  await openStream(presence);
  calls.length = 0;
  await closeStream(presence);
  assertEquals(presence.state, "offline");
  assertEquals(calls.slice(0, 3), ["stop", "scene:idle", "camera:false"]);
});

Deno.test("the graph refuses a state it cannot promise", async () => {
  const { session } = fakeSession();
  const presence = new Presence(session);
  await assertRejects(() => presence.to("brb"), Error, "cannot go from offline to brb");
  await presence.to("starting");
  await assertRejects(() => presence.to("starting"), Error, "cannot go from starting to starting");
});

Deno.test("every state says what it does to the picture", () => {
  assertEquals(PRESENCE_PLANS.offline.streaming, false);
  assertEquals(PRESENCE_PLANS.starting.cameraVisible, false);
  assertEquals(PRESENCE_PLANS.live.cameraVisible, true);
  assertEquals(PRESENCE_PLANS.brb.streaming, true);
  assertEquals(PRESENCE_PLANS.ending.announcement, "ended");
});
