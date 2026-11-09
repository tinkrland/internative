// the sizing, ported from the socmed work, sourced from proskena.
// run: deno test tests/sizes_test.ts

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { captureTarget, LONGFORM_TARGETS, placementInSafeZone, SOCIAL_TARGETS, target } from "../sizes.ts";

Deno.test("presets mirror the export sizes, verbatim", () => {
  assertEquals(SOCIAL_TARGETS.square.width, 1080);
  assertEquals(SOCIAL_TARGETS.square.height, 1080);
  assertEquals(SOCIAL_TARGETS.portrait.width, 1080);
  assertEquals(SOCIAL_TARGETS.portrait.height, 1350);
  assertEquals(SOCIAL_TARGETS.vertical.width, 1080);
  assertEquals(SOCIAL_TARGETS.vertical.height, 1920);
  assertEquals(SOCIAL_TARGETS.wide.width, 1920);
  assertEquals(SOCIAL_TARGETS.wide.height, 1080);
  assertEquals(SOCIAL_TARGETS.pin.width, 1000);
  assertEquals(SOCIAL_TARGETS.pin.height, 1500);
  // the platform reference: 9:16 keeps about 14 percent ui bands
  assertEquals(SOCIAL_TARGETS.vertical.safeTop, 0.14);
  assertEquals(SOCIAL_TARGETS.vertical.safeBottom, 0.14);
  // the call target stays the call framing
  assertEquals(SOCIAL_TARGETS.call.width, 1280);
  assertEquals(SOCIAL_TARGETS.call.height, 720);
});

Deno.test("unknown targets refuse rather than guess", () => {
  assertThrows(() => target("myspace"), Error, "unknown social target");
});

Deno.test("long form targets agree with the same table", () => {
  assertEquals(LONGFORM_TARGETS.youtube_long.width, 1920);
  assertEquals(LONGFORM_TARGETS.youtube_long.safeBottom, 0.1);
  assertEquals(LONGFORM_TARGETS.youtube_4k.height, 2160);
  assertEquals(LONGFORM_TARGETS.shorts.safeTop, 0.14);
  assertEquals(LONGFORM_TARGETS.twitch_vod.height, 1080);
  assertEquals(target("thumbnail").width, 3840);
  assertEquals(target("youtube_long").surface, "longform");
});

Deno.test("the 9:16 safe zone moves the framing, other ratios do not", () => {
  const placement = { fitHeight: 0.78, anchorY: 0.08 };
  const vertical = captureTarget("vertical", placement);
  assertEquals(vertical.safe, true, "the vertical crop clamps to the ui bands");
  assertEquals(vertical.rendered.width, 1080);
  assertEquals(placementInSafeZone(placement, vertical.rendered).anchorY >= 0.14, true);
  const portrait = captureTarget("portrait", placement);
  assertEquals(portrait.safe, false, "a 4:5 feed post keeps the lens framing");
  const call = captureTarget("call", placement);
  assertEquals(call.safe, false, "the call target never has bands");
});

Deno.test("the figure still fits between the bands on a vertical", () => {
  const close = { fitHeight: 0.95, anchorY: 0.02 };
  const vertical = placementInSafeZone(close, SOCIAL_TARGETS.vertical);
  assertEquals(vertical.fitHeight <= 0.72, true, "a close portrait shrinks to the usable 72 percent");
  assertEquals(vertical.anchorY, 0.14, "anchored below the top band");
});
