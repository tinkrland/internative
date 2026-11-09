import { assertEquals } from "jsr:@std/assert@1";
import { DraftStore } from "../drafts.ts";

async function tempStore(): Promise<DraftStore> {
  const dir = await Deno.makeTempDir({ prefix: "clawbuzz-drafts-" });
  return new DraftStore(`${dir}/drafts.jsonl`);
}

Deno.test("a draft is a file, not a pending post", async () => {
  const store = await tempStore();
  const draft = await store.append({ channel: "x", parts: ["one idea"] });
  assertEquals(draft.status, "draft");
  const all = await store.all();
  assertEquals(all.length, 1);
  assertEquals(all[0].parts[0], "one idea");
});

Deno.test("drafts append without rewriting the file", async () => {
  const store = await tempStore();
  await store.append({ channel: "x", parts: ["first"] });
  await store.append({ channel: "bluesky", parts: ["second"] });
  const all = await store.all();
  assertEquals(all.length, 2);
  assertEquals(all[1].channel, "bluesky");
});

Deno.test("only a draft can be approved", async () => {
  const store = await tempStore();
  const draft = await store.append({ channel: "x", parts: ["one"] });
  const approved = await store.approve(draft.id);
  assertEquals(approved.status, "approved");
  let threw = false;
  try {
    await store.approve(draft.id);
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "approving an approved draft is a mistake, not a no-op");
});

Deno.test("a refusal is recorded on the draft with its reason", async () => {
  const store = await tempStore();
  const draft = await store.append({ channel: "x", parts: ["one"] });
  const refused = await store.setStatus(draft.id, "refused", "publishing blocked: draft only");
  assertEquals(refused.status, "refused");
  assertEquals(refused.refusal, "publishing blocked: draft only");
  assertEquals((await store.byId(draft.id))?.refusal, "publishing blocked: draft only");
});

Deno.test("an empty store reads as empty, not as an error", async () => {
  const dir = await Deno.makeTempDir({ prefix: "clawbuzz-drafts-" });
  const store = new DraftStore(`${dir}/nothing.jsonl`);
  assertEquals(await store.all(), []);
});
