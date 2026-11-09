import { assertEquals } from "jsr:@std/assert@1";
import {
  FREE_FLOWS,
  PAID_PENDING,
  flowFor,
  readyFlows,
  registryProblems,
} from "../agentid/distribute/index.ts";
import { LANES, LANE_ORDER, flowProblems, laneFor, ownerStops, phaseOf } from "../agentid/distribute/flow.ts";

const byId = (id: string) => flowFor(id)!;

Deno.test("six free routes are written down and the paid ones are named absences", () => {
  assertEquals(FREE_FLOWS.length, 6);
  assertEquals(PAID_PENDING.map((p) => p.id), ["distrokid", "amuse", "unchained"]);
  assertEquals(PAID_PENDING.every((p) => p.cost === "paid"), true);
  assertEquals(flowFor("distrokid"), undefined, "a paid service is not a flow");
  assertEquals(registryProblems(), []);
});

Deno.test("every route has the four phases and a note on every step", () => {
  for (const flow of FREE_FLOWS) {
    for (const phase of ["signup", "verify", "release", "claim"] as const) {
      assertEquals(Boolean(phaseOf(flow, phase)), true, `${flow.id} is missing ${phase}`);
    }
    const steps = flow.phases.flatMap((p) => p.steps);
    assertEquals(steps.every((s) => s.note.trim().length > 0), true, `${flow.id} has an unexplained step`);
  }
});

Deno.test("the owner is in every flow: terms, and the button that releases", () => {
  for (const flow of FREE_FLOWS) {
    const stops = ownerStops(flow).map((s) => `${s.target} ${s.note}`.toLowerCase());
    assertEquals(stops.some((t) => /terms|agreement/.test(t)), true, `${flow.id} lets the agent accept terms`);
    assertEquals(stops.some((t) => /submit|release/.test(t)), true, `${flow.id} could release without the owner`);
  }
});

Deno.test("the lane is switchable and browserbase is the default everywhere", () => {
  for (const flow of FREE_FLOWS) {
    assertEquals(flow.lane_default, "browserbase");
    assertEquals(LANES.browserbase.wall_only, false);
    assertEquals(LANES.kernel.wall_only, true);
    assertEquals(LANES.browseruse.licence, "MIT");
  }
  assertEquals(LANE_ORDER, ["browserbase", "browseruse", "kernel"]);
});

Deno.test("a wall sends the run to kernel, and a lane cannot be forced past its list", () => {
  const routenote = byId("routenote");
  const open = { ...routenote, verified: true };
  assertEquals(laneFor(open).lane, "browserbase");
  assertEquals(laneFor(open, { lane: "browseruse" }).lane, "browseruse");
  assertEquals(laneFor(open, { wall: true }).lane, "kernel");
  assertEquals(laneFor(open, { lane: "kernel" }).problems.length, 1, "kernel is wall only");
  const narrow = { ...open, lanes: ["browserbase"] as const };
  assertEquals(laneFor({ ...narrow, lanes: ["browserbase"] }, { lane: "browseruse" }).problems.length, 1);
});

Deno.test("a route with no sources cannot run, however complete it looks", () => {
  // every route has a page to cite now, so the refusal is tested on a copy that
  // has none: the rule has to hold for the seventh distributor someone adds next.
  const blind = { ...byId("routenote"), id: "blind", verified: false, sources: [] };
  assertEquals(laneFor(blind).problems[0].includes("no terms read yet"), true);
  assertEquals(FREE_FLOWS.every((f) => f.sources.length > 0), true, "each route cites its pages");
  assertEquals(readyFlows().length, 6, "all six free routes have had their pages read");
});

Deno.test("routenote carries the transcode, because its door is not a wav", () => {
  const routenote = byId("routenote");
  assertEquals(routenote.audio.accepts.some((a) => a.includes("flac")), true);
  assertEquals(routenote.audio.accepts.some((a) => a.includes("mp3")), true);
  assertEquals(/transcod/.test(routenote.audio.note), true, "the conversion is stated before the upload");
  assertEquals(routenote.commission_pct, 15);
  assertEquals(routenote.lead_days.min, 14, "their sales start date is two weeks out");
});

Deno.test("soundon offers a mailbox first, and both social doors stop at an existing account", () => {
  const soundon = byId("soundon-global");
  const steps = soundon.phases.find((p) => p.name === "signup")!.steps;
  const ids = steps.map((s) => s.id);
  assertEquals(ids.indexOf("email-tab") < ids.indexOf("tiktok"), true, "the mailbox tab comes before the panels");
  assertEquals(steps.find((s) => s.id === "tiktok")!.optional, true);
  assertEquals(steps.find((s) => s.id === "google")!.optional, true);
  assertEquals(ids.includes("social-stop"), true, "an existing account is the owner's wherever it is used");
  assertEquals(steps.find((s) => s.id === "terms")!.owner, true, "the terms box also confirms 18 plus");
  assertEquals(soundon.commission_pct, 0);
});

Deno.test("the risky route ends with a check rather than a receipt", () => {
  const jumpstr = byId("jumpstr");
  const claim = jumpstr.phases.find((p) => p.name === "claim")!.steps.map((s) => s.id);
  assertEquals(claim.includes("check"), true);
});

Deno.test("no flow carries a secret, and every upload names what it uploads", () => {
  for (const flow of FREE_FLOWS) {
    for (const step of flow.phases.flatMap((p) => p.steps)) {
      if (step.value) assertEquals(/^[a-z_]+$/.test(step.value), true, `${flow.id}/${step.id} value is a field key`);
      if (step.action === "upload") assertEquals(Boolean(step.value), true, `${flow.id}/${step.id} uploads nothing`);
    }
  }
});

Deno.test("a stop that does not name the owner is a bug the contract catches", () => {
  const space = byId("spacemediauk");
  const broken = {
    ...space,
    verified: true,
    sources: ["a terms page"],
    phases: [{ name: "signup" as const, steps: [
      { id: "dead", action: "stop" as const, target: "a captcha", note: "stops without saying whose answer it is" },
    ] }],
  };
  const problems = flowProblems(broken);
  assertEquals(problems.some((p) => p.includes("stops the run without naming the owner")), true);
  assertEquals(problems.some((p) => p.includes("no verify phase")), true);
});
