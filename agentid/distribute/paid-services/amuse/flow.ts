// Amuse: named here, built later.
//
// the folder exists so the option is visible next to the free routes rather than
// living in somebody's memory. no flow is written for it yet, because paid tiers on top of a limited free one, and the split is a decision.

import type { PendingFlow } from "../../flow.ts";

export const pending: PendingFlow = {
  id: "amuse",
  name: "Amuse",
  host: "",
  cost: "paid",
  why_later: "paid tiers on top of a limited free one, and the split is a decision",
};
