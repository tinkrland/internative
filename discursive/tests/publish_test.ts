import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { adapters, canSend, registerAdapter, sendDraft } from "../publish.ts";
import { DraftStore } from "../drafts.ts";
import { loadPersonaFile } from "../../persona/loader.ts";

const EXAMPLE = new URL("../../personas/example.persona.jsonc", import.meta.url).pathname;
const persona = await loadPersonaFile(EXAMPLE);

async function store(): Promise<DraftStore> {
  const dir = await Deno.makeTempDir({ prefix: "clawbuzz-publish-" });
  return new DraftStore(`${dir}/drafts.jsonl`);
}

Deno.test("with no adapter, a send is refused by name", async () => {
  const s = await store();
  const draft = await s.append({ channel: "x", parts: ["one idea"] });
  assertEquals(adapters().includes("x"), false);
  const decision = canSend(persona, draft, { approved: true, token: "tok" });
  assertEquals(decision.ok, false);
  assertStringIncludes(decision.reason, "no adapter registered");
});

Deno.test("an unapproved draft cannot be sent even with an adapter and a token", async () => {
  registerAdapter({
    channel: "x",
    credentialEnv: "X_TOKEN_TEST",
    send: () => Promise.resolve({ ok: true, detail: "would have sent" }),
  });
  const s = await store();
  const draft = await s.append({ channel: "x", parts: ["one idea"] });
  const decision = canSend(persona, draft, { token: "tok" });
  assertEquals(decision.ok, false);
  assertStringIncludes(decision.reason, "not approved");
});

Deno.test("the persona's publishing mode outranks an approval and a token", async () => {
  const s = await store();
  const draft = await s.append({ channel: "x", parts: ["one idea"], status: "approved" });
  const decision = canSend(persona, draft, { approved: true, token: "tok" });
  assertEquals(decision.ok, false);
  assertStringIncludes(decision.reason, "publishing blocked");
});

Deno.test("a refusal is written onto the draft", async () => {
  const s = await store();
  const draft = await s.append({ channel: "x", parts: ["one idea"], status: "approved" });
  const result = await sendDraft(persona, s, draft, { token: "tok", approved: true });
  assertEquals(result.ok, false);
  const after = await s.byId(draft.id);
  assertEquals(after?.status, "refused");
  assertStringIncludes(after?.refusal ?? "", "publishing blocked");
});

Deno.test("live publishing with an approval, a token and an adapter does send", async () => {
  const live = { ...persona, publishing: { mode: "live" as const, requires_owner_approval: false } };
  let sent = 0;
  registerAdapter({
    channel: "threads",
    credentialEnv: "THREADS_TOKEN_TEST",
    send: () => {
      sent += 1;
      return Promise.resolve({ ok: true, detail: "sent", externalId: "t1" });
    },
  });
  const s = await store();
  const draft = await s.append({ channel: "threads", parts: ["one idea"] });
  const result = await sendDraft(live, s, draft, { token: "tok", approved: true });
  assertEquals(result.ok, true);
  assertEquals(sent, 1);
  assertEquals((await s.byId(draft.id))?.status, "sent");
});

Deno.test("a sent draft is never sent twice", async () => {
  const live = { ...persona, publishing: { mode: "live" as const, requires_owner_approval: false } };
  const s = await store();
  const draft = await s.append({ channel: "threads", parts: ["one idea"] });
  await sendDraft(live, s, draft, { token: "tok", approved: true });
  const again = await sendDraft(live, s, { ...draft, status: "sent" }, { token: "tok", approved: true });
  assertEquals(again.ok, false);
  assertEquals(again.detail, "already sent");
});
