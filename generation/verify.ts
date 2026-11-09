// what can be checked about an adapter without running one.
//
// a descriptor that names a model, a licence and a reference budget is a claim.
// the claim we can test here is internal: the budgets are coherent, the roles
// the planner emits are roles the adapter says it takes, and the licence is
// written down rather than assumed. what cannot be tested here is whether the
// model actually behaves that way, so every adapter keeps verified: false and
// says so out loud instead of looking tested.

import { ADAPTERS, type Adapter } from "./adapters.ts";
import { observedIds, readObservations, type Observation } from "./observations.ts";

export interface AdapterCheck {
  adapter: string;
  problems: string[];
  verified: boolean;
}

// the smallest kit a shot can produce: the person and one wide plate of a room.
export const MIN_REFERENCE_KIT = 2;

export function checkAdapterDefinition(adapter: Adapter): string[] {
  const problems: string[] = [];
  if (adapter.accepts.length === 0) problems.push("accepts nothing, so it cannot receive a shot");
  if (!adapter.accepts.includes("character") && !adapter.accepts.includes("keyframe")) {
    problems.push("accepts neither a character reference nor a keyframe, so identity has no carrier");
  }
  // a reference-taking adapter has to have room for her plus a room. one that
  // only takes a keyframe is a different shape and only needs the one image.
  if (adapter.accepts.includes("character")) {
    if (adapter.max_references < MIN_REFERENCE_KIT) {
      problems.push(`ceiling ${adapter.max_references} is below the smallest kit (${MIN_REFERENCE_KIT})`);
    }
  } else if (adapter.max_references < 1) {
    problems.push("takes no image at all");
  }
  if (!adapter.reference_field.trim()) {
    problems.push("no field name, and the field name is what a schema rejects");
  }
  if (adapter.evidence === "documented" && !/^https?:\/\//.test(adapter.source ?? "")) {
    problems.push("claims to be documented but cites no source");
  }
  if (!adapter.provider.trim()) problems.push("no provider, and the field name belongs to a provider");
  if (adapter.source_kind === "api-doc" && !adapter.endpoint) {
    problems.push("claims a provider api reference but names no endpoint");
  }
  if (!adapter.licence.trim()) problems.push("licence not declared");
  if (!adapter.notes.trim()) problems.push("no note on what the adapter expects");
  return problems;
}

export function adapterChecks(adapters: Adapter[] = ADAPTERS): AdapterCheck[] {
  return adapters.map((adapter) => ({
    adapter: adapter.id,
    problems: checkAdapterDefinition(adapter),
    verified: adapter.verified,
  }));
}

export interface VerificationReport {
  ok: boolean;
  checks: AdapterCheck[];
  // adapters whose behaviour has never been observed: the honest headline
  unverified: string[];
  // descriptions that rest on reading the endpoint's own schema
  documented: string[];
  // descriptions that rest on inference and have to be confirmed first
  assumed: string[];
  // descriptions read from an aggregator page rather than the provider's own
  catalog_sourced: string[];
  // adapters a real request has been accepted by, from the ledger
  observed: string[];
}

export function verificationReport(
  adapters: Adapter[] = ADAPTERS,
  observations: Observation[] = readObservations(),
): VerificationReport {
  const observed = observedIds(observations);
  const checks = adapterChecks(adapters).map((c) => ({ ...c, verified: c.verified || observed.includes(c.adapter) }));
  return {
    ok: checks.every((c) => c.problems.length === 0),
    checks,
    observed,
    unverified: checks.filter((c) => !c.verified).map((c) => c.adapter),
    documented: adapters.filter((a) => a.evidence === "documented").map((a) => a.id),
    assumed: adapters.filter((a) => a.evidence === "assumed").map((a) => a.id),
    catalog_sourced: adapters.filter((a) => a.source_kind === "catalog").map((a) => a.id),
  };
}
