// every distribution route in one list, so a caller picks by id and gets a shape
// it already knows, and a paid service is a named absence rather than a rumour.

import type { DistributorFlow, PendingFlow } from "./flow.ts";
import { flowProblems, laneFor, ownerStops } from "./flow.ts";
import { flow as soundon } from "./soundon-global/flow.ts";
import { flow as indiefy } from "./indiefy/flow.ts";
import { flow as routenote } from "./routenote/flow.ts";
import { flow as freecords } from "./freecords/flow.ts";
import { flow as jumpstr } from "./jumpstr/flow.ts";
import { flow as spacemediauk } from "./spacemediauk/flow.ts";
import { pending as distrokid } from "./paid-services/distrokid/flow.ts";
import { pending as amuse } from "./paid-services/amuse/flow.ts";
import { pending as unchained } from "./paid-services/unchained/flow.ts";

export const FREE_FLOWS: DistributorFlow[] = [soundon, indiefy, routenote, freecords, jumpstr, spacemediauk];
export const PAID_PENDING: PendingFlow[] = [distrokid, amuse, unchained];

export function flowFor(id: string): DistributorFlow | undefined {
  return FREE_FLOWS.find((f) => f.id === id);
}

// the routes that can actually run today: written down, sourced, and not refused
export function readyFlows(): DistributorFlow[] {
  return FREE_FLOWS.filter((f) => f.verified);
}

export function registryProblems(): string[] {
  const problems: string[] = [];
  const ids = FREE_FLOWS.map((f) => f.id);
  for (const id of new Set(ids)) {
    if (ids.filter((other) => other === id).length > 1) problems.push(`${id}: two flows share an id`);
  }
  // flowProblems is per flow and reported where it is asked for. the registry only
  // answers the question the registry owns: are these six distinct routes.
  const hosts = FREE_FLOWS.map((f) => f.host);
  for (const host of new Set(hosts)) {
    if (hosts.filter((other) => other === host).length > 1) problems.push(`${host}: two flows claim one host`);
  }
  for (const pending of PAID_PENDING) {
    if (ids.includes(pending.id)) problems.push(`${pending.id}: is both a flow and a pending paid service`);
  }
  return problems;
}

export * from "./flow.ts";
