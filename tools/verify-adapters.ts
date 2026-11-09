// check the adapter descriptions for internal sense, and say what is unproven.
//
//   deno run --allow-read tools/verify-adapters.ts
//
// exits 1 only on an incoherent description, because a model that has not been
// run is not a model that is broken. the unverified list is the honest part.

import { ADAPTERS } from "../generation/adapters.ts";
import { verificationReport } from "../generation/verify.ts";

const report = verificationReport();
for (const check of report.checks) {
  const state = check.problems.length ? `BROKEN: ${check.problems.join("; ")}` : check.verified ? "verified by a run" : "described, not run";
  console.log(`${check.adapter}: ${state}`);
}
for (const id of report.checks.map((c) => c.adapter)) {
  const adapter = ADAPTERS.find((a) => a.id === id)!;
  console.log(`  ${id}: ${adapter.provider} field ${adapter.reference_field}, cap ${adapter.max_references}, ${adapter.evidence} from ${adapter.source_kind}`);
}
if (report.observed.length) {
  console.log(`\nobserved by a real request: ${report.observed.join(", ")}`);
}
if (report.catalog_sourced.length) {
  console.log(`\nread from a catalogue, confirm against the provider's own api reference before wiring: ${report.catalog_sourced.join(", ")}`);
}
if (report.assumed.length) {
  console.log(`\nassumed, confirm before use: ${report.assumed.join(", ")}`);
}
if (report.unverified.length) {
  console.log(`\nnot yet observed: ${report.unverified.join(", ")}. a run has to confirm the names and parameters before this is trusted.`);
}
if (!report.ok) Deno.exit(1);
