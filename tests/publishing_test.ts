import { assertEquals } from "jsr:@std/assert@1";
import { DESTINATION_NAMES, DESTINATIONS, destinationProblems, graphemes } from "../publishing/destinations.ts";
import { planKey, planProblems, type PublishPlan } from "../publishing/plan.ts";
import { memoryRateGate, memoryReceiptStore, publishOnce, type Publisher, type PublishReceipt } from "../publishing/gate.ts";

const plan: PublishPlan = {
  persona: "example",
  aipn: "AIPN-000001",
  destination: "bluesky",
  surface: "text",
  body: "the thing nobody tells you about shipping on a friday",
  media: [{ kind: "image", ref: "plates/slide-1.png", alt: "a bathroom mirror with a phone propped against the taps" }],
  ai_disclosure: "written by an ai personality, and it says so",
  approval: "approved",
};

function fakePublisher(destination: PublishPlan["destination"], id = "at://did:plc:example/app.bsky.feed.post/1"): Publisher & { calls: number } {
  const publisher = {
    destination,
    calls: 0,
    async publish(): Promise<PublishReceipt> {
      publisher.calls += 1;
      return { plan_key_digest: "d", destination, posted_at: "2026-11-08T12:00:00Z", external_id: id };
    },
  };
  return publisher;
}

Deno.test("every destination says how it is reached, and the one with no api says so out loud", () => {
  assertEquals(DESTINATION_NAMES.length, 12);
  assertEquals(DESTINATIONS.spotify.route, "no-api");
  assertEquals(destinationProblems("spotify").some((p) => p.includes("distributor")), true);
  assertEquals(destinationProblems("bluesky"), []);
  for (const name of DESTINATION_NAMES) {
    if (DESTINATIONS[name].route !== "api") continue;
    assertEquals(Boolean(DESTINATIONS[name].tool), true, `${name} names its api`);
    assertEquals(DESTINATIONS[name].daily_cap > 0, true, `${name} has a fuse`);
  }
});

Deno.test("length is counted in graphemes, because code units lie about emoji", () => {
  assertEquals(graphemes("hello"), 5);
  assertEquals(graphemes("👨‍👩‍👧‍👦"), 1);
  assertEquals(graphemes("café"), 4);
  assertEquals(graphemes("👨‍👩‍👧‍👦".repeat(5)), 5);
});

Deno.test("a plan is refused for the four reasons posts actually go wrong", () => {
  assertEquals(planProblems(plan), []);
  assertEquals(planProblems({ ...plan, body: "a".repeat(301) }).some((p) => p.includes("allows 300")), true);
  assertEquals(planProblems({ ...plan, approval: "draft" }).some((p) => p.includes("does not leave the building")), true);
  assertEquals(planProblems({ ...plan, media: [{ kind: "image", ref: "x.png" }] }).some((p) => p.includes("alt text")), true);
  assertEquals(planProblems({ ...plan, ai_disclosure: "" }).length, 0, "bluesky does not demand the flag");
  const yt: PublishPlan = { ...plan, destination: "youtube", media: [{ kind: "video", ref: "ep.mp4" }], ai_disclosure: "" };
  assertEquals(planProblems(yt).some((p) => p.includes("generated-content flag")), true);
});

Deno.test("a destination that takes no picture of that kind is refused, not silently dropped", () => {
  const audioOnYoutube = planProblems({ ...plan, destination: "youtube", media: [{ kind: "audio", ref: "song.wav" }] });
  assertEquals(audioOnYoutube.some((p) => p.includes("does not take audio")), true);
  const tooMany = planProblems({ ...plan, media: Array.from({ length: 6 }, (_, i) => ({ kind: "image" as const, ref: `s${i}.png`, alt: "a slide" })) });
  assertEquals(tooMany.some((p) => p.includes("allows 4")), true);
});

Deno.test("the same post twice is the same key, and a different word is a different post", () => {
  assertEquals(planKey(plan), planKey({ ...plan }));
  assertEquals(planKey(plan) === planKey({ ...plan, body: `${plan.body}.` }), false);
  assertEquals(planKey(plan) === planKey({ ...plan, destination: "mastodon" }), false);
  assertEquals(planKey(plan) === planKey({ ...plan, media: [{ kind: "image", ref: "plates/slide-2.png", alt: "a slide" }] }), false);
});

Deno.test("a retry does not double post, and the second attempt gets the first receipt", async () => {
  const publisher = fakePublisher("bluesky");
  const store = memoryReceiptStore();
  const gate = memoryRateGate();
  const first = await publishOnce(publisher, store, gate, plan, "2026-11-08T12:00:00Z");
  assertEquals(first.problems, []);
  assertEquals(first.receipt?.destination, "bluesky");
  const second = await publishOnce(publisher, store, gate, plan, "2026-11-08T12:00:05Z");
  assertEquals(second.receipt, undefined);
  assertEquals(second.duplicate?.external_id, first.receipt?.external_id);
  assertEquals(publisher.calls, 1);
});

Deno.test("the rate gate is a fuse, and it springs back after the window", async () => {
  const publisher = fakePublisher("threads");
  const store = memoryReceiptStore();
  const gate = memoryRateGate();
  let posted = 0;
  for (let i = 0; i < DESTINATIONS.threads.daily_cap; i += 1) {
    const attempt = await publishOnce(publisher, store, gate, { ...plan, destination: "threads", body: `post ${i}` }, "2026-11-08T12:00:00Z");
    if (attempt.receipt) posted += 1;
  }
  assertEquals(posted, DESTINATIONS.threads.daily_cap);
  const refused = await publishOnce(publisher, store, gate, { ...plan, destination: "threads", body: "one too many" }, "2026-11-08T12:00:00Z");
  assertEquals(refused.receipt, undefined);
  assertEquals(refused.problems.some((p) => p.includes("cap is")), true);
  const nextDay = await publishOnce(publisher, store, gate, { ...plan, destination: "threads", body: "one too many" }, "2026-11-09T12:00:01Z");
  assertEquals(Boolean(nextDay.receipt), true);
});

Deno.test("a publisher for another destination, or a plan with no api, is refused before anything is sent", async () => {
  const publisher = fakePublisher("bluesky");
  const wrong = await publishOnce(publisher, memoryReceiptStore(), memoryRateGate(), { ...plan, destination: "mastodon" }, "2026-11-08T12:00:00Z");
  assertEquals(wrong.problems.some((p) => p.includes("the plan is for mastodon")), true);
  assertEquals(publisher.calls, 0);
  const impossible = await publishOnce(fakePublisher("spotify"), memoryReceiptStore(), memoryRateGate(), { ...plan, destination: "spotify", media: [] }, "2026-11-08T12:00:00Z");
  assertEquals(impossible.problems.some((p) => p.includes("distributor")), true);
  assertEquals(impossible.receipt, undefined);
});
