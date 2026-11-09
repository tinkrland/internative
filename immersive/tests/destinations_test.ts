import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { describeDestination, DESTINATIONS, pointObsAt, readyDestination, readyDestinations } from "../server/destinations.ts";

function clearEnv() {
  for (const k of [
    "CLAWBUZZ_TWITCH_STREAM_KEY", "TWITCH_STREAM_KEY",
    "CLAWBUZZ_KICK_STREAM_URL", "CLAWBUZZ_KICK_STREAM_KEY",
    "CLAWBUZZ_YOUTUBE_STREAM_URL", "CLAWBUZZ_YOUTUBE_STREAM_KEY",
  ]) Deno.env.delete(k);
}

Deno.test("an unconfigured destination is absent, not guessed", () => {
  clearEnv();
  assertEquals(readyDestinations(), []);
  assertEquals(readyDestination("twitch"), null);
  assertEquals(readyDestination("youtube"), null);
});

Deno.test("twitch is the stable ingest plus a key from the environment", () => {
  clearEnv();
  Deno.env.set("CLAWBUZZ_TWITCH_STREAM_KEY", "live_123");
  const ready = readyDestination("twitch");
  assertEquals(ready?.target.server, "rtmp://live.twitch.tv/app");
  assertEquals(ready?.target.key, "live_123");
  Deno.env.delete("CLAWBUZZ_TWITCH_STREAM_KEY");
});

Deno.test("the older unprefixed key still works, and the new one wins", () => {
  clearEnv();
  Deno.env.set("TWITCH_STREAM_KEY", "legacy");
  assertEquals(readyDestination("twitch")?.target.key, "legacy");
  Deno.env.set("CLAWBUZZ_TWITCH_STREAM_KEY", "preferred");
  assertEquals(readyDestination("twitch")?.target.key, "preferred");
  clearEnv();
});

Deno.test("youtube live needs both the account url and the key", () => {
  clearEnv();
  Deno.env.set("CLAWBUZZ_YOUTUBE_STREAM_URL", "rtmps://a.rtmps.youtube.com/live2");
  assertEquals(readyDestination("youtube"), null, "a url without a key is not a destination");
  Deno.env.set("CLAWBUZZ_YOUTUBE_STREAM_KEY", "abcd-efgh");
  assertEquals(readyDestination("youtube")?.target.server, "rtmps://a.rtmps.youtube.com/live2");
  assertEquals(readyDestinations().includes("youtube"), true);
  clearEnv();
});

Deno.test("a receipt never carries the key", () => {
  clearEnv();
  Deno.env.set("CLAWBUZZ_TWITCH_STREAM_KEY", "super-secret-key");
  const ready = readyDestination("twitch")!;
  const line = describeDestination(ready);
  assertEquals(line.includes("super-secret-key"), false);
  assertEquals(line.includes("rtmp://live.twitch.tv/app"), true);
  clearEnv();
});

Deno.test("pointing obs at an unconfigured destination refuses", async () => {
  clearEnv();
  const bridge = { setStreamTarget: () => Promise.resolve() } as never;
  await assertRejects(() => pointObsAt(bridge, "kick"), Error, "no credentials");
});

Deno.test("the roster is the three live surfaces, and only those", () => {
  assertEquals([...DESTINATIONS], ["twitch", "kick", "youtube"]);
});
