// the probes run against pages captured on 9 november 2026, read live in a browser
// without creating an account. the fixtures are what the page showed, so a flow that
// drifts from them fails here rather than mid run.

import { assertEquals } from "jsr:@std/assert@1";
import { flowFor } from "../agentid/distribute/index.ts";
import { probePage, probeProblems, type PageSnapshot } from "../agentid/distribute/probe.ts";

function page(name: string): PageSnapshot {
  const raw = JSON.parse(Deno.readTextFileSync(`tests/fixtures/pages/${name}.json`));
  return { url: raw.url, labels: raw.labels, buttons: raw.buttons };
}

Deno.test("routenote signup still asks what the flow types", () => {
  const probe = probePage(
    flowFor("routenote")!,
    { phase: "signup", page: "signup", steps: ["username", "email", "password", "confirm", "security", "newsletter", "terms"] },
    page("routenote-signup"),
  );
  assertEquals(probe.missing, []);
  assertEquals(probe.stops_at, "terms", "the terms box is the last thing before the account exists");
  assertEquals(probeProblems([probe]), []);
});

Deno.test("soundon asks for a code, not a password, and stops at the age box", () => {
  const probe = probePage(
    flowFor("soundon-global")!,
    { phase: "signup", page: "signup", steps: ["email-tab", "region", "email", "send-code", "code", "marketing", "terms", "create"] },
    page("soundon-signup"),
  );
  assertEquals(probe.missing, []);
  assertEquals(probe.stops_at, "terms", "the box that confirms 18 plus is the owner's to tick");
  assertEquals(probeProblems([probe]), []);
});

Deno.test("jumpstr has no terms box, so registering is the consent and the owner reads it", () => {
  const probe = probePage(
    flowFor("jumpstr")!,
    { phase: "signup", page: "register", steps: ["name", "email", "password", "confirm", "terms", "submit"] },
    page("jumpstr-register"),
  );
  assertEquals(probe.missing, []);
  assertEquals(probe.stops_at, "terms");
  assertEquals(probeProblems([probe]), []);
});

Deno.test("indiefy takes the release before it takes an account", () => {
  const probe = probePage(
    flowFor("indiefy")!,
    { phase: "release", page: "upload", steps: ["audio", "title", "artist", "genre", "send"] },
    page("indiefy-distribute"),
  );
  assertEquals(probe.missing, []);
  assertEquals(probeProblems([probe]), []);
});
