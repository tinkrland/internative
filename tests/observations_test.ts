import { assertEquals } from "jsr:@std/assert@1";
import {
  accepted,
  observedIds,
  readObservations,
  recordObservation,
  type Observation,
} from "../generation/observations.ts";
import { verificationReport } from "../generation/verify.ts";
import { ADAPTERS } from "../generation/adapters.ts";
import { keyNameFor } from "../tools/run-frame.ts";

const tmp = await Deno.makeTempDir();

Deno.test("only an accepted request counts as an observation", () => {
  assertEquals(accepted(200), true);
  assertEquals(accepted(201), true);
  assertEquals(accepted(400), false, "a rejected body teaches us the field name is wrong");
  assertEquals(accepted(500), false);
});

Deno.test("no ledger means nothing has been observed, which is the honest default", () => {
  assertEquals(readObservations(`${tmp}/empty`), []);
  assertEquals(observedIds([]), []);
});

Deno.test("an observation survives the trip to disk", () => {
  const observation: Observation = {
    adapter: "seedance-2-reference",
    observed_at: "2026-11-07T14:00:00.000Z",
    status: 200,
    endpoint: "https://api.evolink.ai/v1/videos/generations",
    model: "seedance-2.0-reference-to-video",
    note: "first accepted request",
  };
  recordObservation(observation, tmp);
  const read = readObservations(tmp);
  assertEquals(read.length, 1);
  assertEquals(read[0].adapter, observation.adapter);
  assertEquals(observedIds(read), ["seedance-2-reference"]);
});

Deno.test("a recorded acceptance stops the report calling that adapter unproven", () => {
  const before = verificationReport(ADAPTERS, []);
  assertEquals(before.unverified.includes("seedance-2-reference"), true);
  assertEquals(before.observed, []);

  const after = verificationReport(ADAPTERS, readObservations(tmp));
  assertEquals(after.observed, ["seedance-2-reference"]);
  assertEquals(after.unverified.includes("seedance-2-reference"), false);
  assertEquals(after.checks.find((c) => c.adapter === "seedance-2-reference")?.verified, true);
  // and the ones nobody ran are still unproven
  assertEquals(after.unverified.includes("wan-reference-to-video"), true);
});

Deno.test("each provider has one env name for its key", () => {
  assertEquals(keyNameFor("EvoLink"), "EVOLINK_API_KEY");
  assertEquals(keyNameFor("Pixel Dojo"), "PIXELDOJO_API_KEY");
  assertEquals(keyNameFor("nobody"), undefined);
});
