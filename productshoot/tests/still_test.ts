import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { setSizesAvailable, stillJob } from "../stills/still.ts";

Deno.test("a still is the same plate at another frame", () => {
  const feed = stillJob({ target: "portrait" });
  const pin = stillJob({ target: "pin" });
  assertEquals(feed.frame.width, 1080);
  assertEquals(feed.frame.height, 1350);
  assertEquals(pin.frame.width, 1000);
  assertEquals(pin.plate.live.fov, feed.plate.live.fov);
  assertEquals(pin.plate.lighting, feed.plate.lighting);
});

Deno.test("the plate is proskena scene state with no subject", () => {
  const job = stillJob({ target: "square" });
  assertEquals(job.plate.schema, "proskena-scene-state");
  assertEquals(job.plate.subject, null);
  assertEquals(job.person, null);
});

Deno.test("a caption band sits inside the platform chrome", () => {
  const band = stillJob({ target: "vertical", withCaptionBand: true }).textBand;
  assertEquals(band.top >= 0.86, true);
  assertEquals(band.bottom <= 0.86 + 0.001, true);
  assertEquals(stillJob({ target: "vertical" }).textBand, { top: 1, bottom: 1 });
});

Deno.test("an unknown frame refuses rather than guessing", () => {
  assertThrows(() => stillJob({ target: "billboard" }), Error, "unknown social target");
});

Deno.test("one authored set serves every channel", () => {
  assertEquals(setSizesAvailable().includes("portrait"), true);
  assertEquals(setSizesAvailable().includes("vertical"), true);
});
