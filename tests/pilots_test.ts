import { assertEquals } from "jsr:@std/assert@1";
import {
  checkPilot,
  findPilots,
  MIN_DISCLOSURE,
  pilotProblems,
  PLACEMENTS,
  type Pilot,
} from "../tools/check-pilots.ts";

const pilots = findPilots();
const byId = new Map(pilots.map((p) => [p.pilot.id, p]));
const show = byId.get("founding-fathers-show")!.pilot;
const holmes = byId.get("holmes-at-home")!.pilot;
const anthem = byId.get("stars-spangled-banger")!.pilot;

Deno.test("the three pilots are where they were asked to be", () => {
  assertEquals(byId.get("holmes-at-home")?.vertical, "audio/podcast");
  assertEquals(byId.get("stars-spangled-banger")?.vertical, "audio/music");
  assertEquals(byId.get("founding-fathers-show")?.vertical, "video/long-form");
  assertEquals(pilotProblems().ok, true);
});

Deno.test("the anthem pilot is spelled spangled and rides the audio surface", () => {
  assertEquals(byId.has("stars-sprangled-banger"), false, "the old spelling is gone");
  assertEquals(anthem.title, "Stars Spangled Banger");
  assertEquals(anthem.surface, "audio");
});

Deno.test("every pilot states what is invented, where the frame sits, and what it refuses", () => {
  for (const p of pilots) {
    assertEquals(p.pilot.fiction.disclosure.length >= MIN_DISCLOSURE, true, `${p.pilot.id} needs a real disclosure`);
    assertEquals(PLACEMENTS.includes(p.pilot.fiction.placement), true, `${p.pilot.id} needs a placement`);
    assertEquals(p.pilot.guardrails.length >= 3, true, `${p.pilot.id} needs stated refusals`);
  }
});

Deno.test("the sofa show is photoreal on purpose, and the frame is on screen the whole time", () => {
  assertEquals(show.fiction.kind, "photoreal_satire_with_likeness");
  assertEquals(show.fiction.placement, "on_screen_continuous");
  assertEquals(show.guardrails.some((g) => /photoreal is the format/i.test(g)), true);
  assertEquals(show.guardrails.some((g) => /synthetic content disclosure/i.test(g)), true);
  assertEquals(show.guardrails.some((g) => /no photoreal likeness of a living person/i.test(g)), true);
  assertEquals(show.guardrails.some((g) => /no invented quotation/i.test(g)), true);
  assertEquals(/not a real interview/i.test(show.fiction.disclosure), true);
});

Deno.test("six voices are declared, and no two of them are the same voice", () => {
  assertEquals(show.cast?.length, 6);
  assertEquals(show.cast?.map((c) => c.id), ["host", "assistant", "washington", "jefferson", "hamilton", "franklin"]);
  const registers = new Set(show.cast?.map((c) => c.register.toLowerCase()));
  assertEquals(registers.size, 6);
  assertEquals(show.cast?.every((c) => c.role.length > 10 && c.continuity.length > 10), true);
});

Deno.test("a cast that shares a register is refused, because that is the whole problem", () => {
  const blurred: Pilot = {
    ...show,
    cast: show.cast!.map((c) => (c.id === "franklin" ? { ...c, register: show.cast![1].register } : c)),
  };
  assertEquals(checkPilot(blurred, "founding-fathers-show", "video/long-form").some((p) => p.includes("share a register")), true);
});

Deno.test("a guest with no continuity is refused, or he forgets what he was told", () => {
  const amnesiac: Pilot = { ...show, cast: show.cast!.map((c) => (c.id === "jefferson" ? { ...c, continuity: "" } : c)) };
  assertEquals(checkPilot(amnesiac, "founding-fathers-show", "video/long-form").some((p) => p.includes("no continuity")), true);
});

Deno.test("the sofa show is cut down into shortform, and the frame survives the cut", () => {
  assertEquals(show.repackaging?.length, 1);
  const cut = show.repackaging![0];
  assertEquals(cut.surface, "shortform");
  assertEquals(/reaction/i.test(cut.what_survives), true);
  assertEquals(/chyron/i.test(cut.rule), true);
  assertEquals(show.episode_zero.beats.some((b) => /chyron intact/i.test(b)), true);
});

Deno.test("a repackaging into a surface the head does not have is refused", () => {
  const nowhere: Pilot = { ...show, repackaging: [{ surface: "tiktok", what_survives: "x", rule: "y" }] };
  assertEquals(checkPilot(nowhere, "founding-fathers-show", "video/long-form").some((p) => p.includes("head does not have")), true);
});

Deno.test("holmes at home is the pipeline name, and nobody in the show is called holmes", () => {
  assertEquals(holmes.title, "Holmes at Home");
  assertEquals(Boolean(holmes.narrator), true);
  assertEquals(/no detective character, no holmes/i.test(holmes.narrator!.who), true);
  assertEquals(holmes.narrator!.who.toLowerCase().includes("persona"), true, "the narrator is her");
  assertEquals(/production pipeline/i.test(holmes.narrator!.note), true);
  assertEquals((holmes.cast ?? []).length, 0, "a one-voice pipeline has no cast to manage");
  assertEquals(holmes.guardrails.some((g) => /one voice and no cast/i.test(g)), true);
});

Deno.test("a pilot that names a narrator without saying what the name is, is refused", () => {
  const vague: Pilot = { ...holmes, narrator: { who: "", note: "" } };
  const problems = checkPilot(vague, "holmes-at-home", "audio/podcast");
  assertEquals(problems.some((p) => p.includes("does not say who")), true);
  assertEquals(problems.some((p) => p.includes("what the name is")), true);
});

Deno.test("the invented case carries its tag at the end, with the packaging doing the rest", () => {
  assertEquals(holmes.fiction.placement, "end_tag");
  assertEquals(/one fast breath at the end/i.test(holmes.fiction.disclosure), true);
  assertEquals(holmes.guardrails.some((g) => /title, thumbnail and description/i.test(g)), true);
  assertEquals(holmes.guardrails.some((g) => /no real case/i.test(g)), true);
  assertEquals(/nobody's suffering|nobody was hurt/i.test(JSON.stringify(holmes)), true);
});

Deno.test("the anthem's frame is the rights note, since the work is the disclosure", () => {
  assertEquals(anthem.fiction.placement, "stated_in_notes");
  assertEquals(/public domain/i.test(anthem.fiction.disclosure), true);
  assertEquals(anthem.guardrails.some((g) => /political endorsement/i.test(g)), true);
  assertEquals(anthem.guardrails.some((g) => /sampling/i.test(g)), true);
});

Deno.test("a pilot with no frame is refused, and a placement nobody knows is refused", () => {
  const thin: Pilot = { ...holmes, fiction: { ...holmes.fiction, disclosure: "fiction" } };
  assertEquals(checkPilot(thin, "holmes-at-home", "audio/podcast").some((p) => p.includes("not a frame")), true);
  const nowhere: Pilot = { ...holmes, fiction: { ...holmes.fiction, placement: "somewhere" } };
  assertEquals(checkPilot(nowhere, "holmes-at-home", "audio/podcast").some((p) => p.includes("is not one of")), true);
});

Deno.test("a pilot that disagrees with its folder is refused", () => {
  const moved: Pilot = { ...holmes, surface: "text" };
  assertEquals(checkPilot(moved, "holmes-at-home", "audio/podcast").some((p) => p.includes("would not reach it")), true);
  assertEquals(checkPilot(moved, "elsewhere", "audio/podcast").some((p) => p.includes("folder says otherwise")), true);
});

Deno.test("a vertical this branch does not know is refused rather than guessed at", () => {
  assertEquals(checkPilot(holmes, "holmes-at-home", "video/shorts")[0].includes("not a vertical this branch knows"), true);
});
