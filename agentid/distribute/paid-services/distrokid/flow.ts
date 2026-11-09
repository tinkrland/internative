// DistroKid: named here, built later.
//
// the folder exists so the option is visible next to the free routes rather than
// living in somebody's memory. no flow is written for it yet, because a subscription, and a paid tool is a decision before it is a flow.

import type { PendingFlow } from "../../flow.ts";

export const pending: PendingFlow = {
  id: "distrokid",
  name: "DistroKid",
  host: "",
  cost: "paid",
  why_later: "a subscription, and a paid tool is a decision before it is a flow",
};
