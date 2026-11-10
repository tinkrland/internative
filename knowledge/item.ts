// an item of knowledge, checked by the three axes it sits on.
//
// the axes live in their own folders because each has its own failure mode and its own
// rules: origin/ decides what receipt a claim needs, articulation/ decides whether it may
// be written down at all, function/ decides what shape it takes. this file composes them
// and adds the parts that belong to no single axis but to the machine: evidence, volatility,
// scope.
//
// two of those exist because a machine forces them, and both are failure modes this repo has
// already met in another layer:
//
//   evidence    how do we know. a claim with no source is a claim a later run will
//               contradict with another claim with no source, and nothing will notice.
//   volatility  does it expire. a taste does not; a price, a phone model and a room's
//               furniture arrangement do.
//
// what she can REACH is not here: that is access/, because knowing how to do a thing and
// being allowed to do it are different questions with different answers.

import { sha256Hex } from "../persona/aipn.ts";
import { originProblems, type Origin } from "./origin/module.ts";
import { articulationProblems, type Articulation } from "./articulation/module.ts";
import { functionProblems, type KnowledgeFunction } from "./function/module.ts";

export type { Origin, Articulation, KnowledgeFunction };
// the earlier name, kept so callers do not have to care about the rename
export type Function = KnowledgeFunction;

export type Evidence = "verified" | "reported" | "inferred" | "assumed";
export type Volatility = "durable" | "seasonal" | "volatile";
export type Scope = "persona" | "owner" | "world" | "project";

export interface Source {
  kind: "experience" | "document" | "conversation" | "measurement";
  // a path, a url, or an episode id she can be asked about later
  ref: string;
  at: string;
  by?: string;
}

export interface KnowledgeItem {
  id: string;
  subject: string;
  origin: Origin;
  articulation: Articulation;
  function: KnowledgeFunction;
  evidence: Evidence;
  volatility: Volatility;
  scope: Scope;
  at: string;
  // stated knowledge: propositional carries it, explanatory carries it with a phenomenon,
  // tacit may not carry it at all
  claim?: string;
  phenomenon?: string;
  // acquainted knowledge names the thing met, never a claim about it
  entity?: string;
  // tacit and procedural point at the demonstration: a procedure, an example, an eval
  demonstrated_by?: string;
  reflection?: string;
  source?: Source;
  basis?: string;
  why_assumed?: string;
  confidence?: number;
  review_after?: string;
  tags: string[];
}

const SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const ISO = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?$/;
// the same rule the publishing layer uses: a committed file must not hold a secret
const SECRET_SHAPED = /(sk-[a-z0-9]{16,}|ghp_[a-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-)/i;

export function itemProblems(item: KnowledgeItem, ids: Set<string> = new Set()): string[] {
  const problems: string[] = [];
  if (!SLUG.test(item.id ?? "")) problems.push(`id: "${item.id}" is not a slug`);
  if ((item.subject ?? "").trim().length < 3) problems.push("subject: what is this knowledge about");
  if (!ISO.test(item.at ?? "")) problems.push("at: when was this learned, as a date");

  // the three axes, each in its own folder
  problems.push(...originProblems(item));
  problems.push(...articulationProblems(item));
  problems.push(...functionProblems(item));

  // evidence, which is where a machine taxonomy has to leave the human one
  if (item.evidence === "verified" && !(item.source?.ref ?? "").trim()) {
    problems.push("evidence: verified needs a receipt (document, measurement, or an episode she can be asked about)");
  }
  if (item.evidence === "verified" && item.source?.kind === "conversation") {
    problems.push("evidence: a conversation is testimony, not verification. it becomes verified when something checks it");
  }
  if (item.evidence === "inferred" && !(item.basis ?? "").trim()) {
    problems.push("evidence: inferred names what it was inferred from");
  }
  if (item.evidence === "assumed" && !(item.why_assumed ?? "").trim()) {
    problems.push("evidence: assumed says why, or it is a guess wearing a fact's clothes");
  }
  if (["inferred", "assumed"].includes(item.evidence) && typeof item.confidence !== "number") {
    problems.push("evidence: inferred and assumed carry a confidence, so later work can weigh them");
  }

  // volatility: what expires must say when
  if (item.volatility !== "durable" && !ISO.test(item.review_after ?? "")) {
    problems.push("volatility: a seasonal or volatile item says when it should be re-checked");
  }
  if (item.volatility !== "durable" && item.scope === "persona") {
    problems.push("volatility: her own taste does not expire. a persona fact that expires is a fact about the world that got filed wrong");
  }

  if (!["persona", "owner", "world", "project"].includes(item.scope)) {
    problems.push(`scope: "${item.scope}" is not one of persona, owner, world, project`);
  }
  if ((item.tags ?? []).length === 0) problems.push("tags: at least one, so a later retrieval is not a scan of everything");
  if (SECRET_SHAPED.test(JSON.stringify(item))) problems.push("secret: this item holds something shaped like a credential");
  if (item.basis && ids.size && !ids.has(item.basis)) problems.push(`basis: "${item.basis}" is not an item she holds`);
  return problems;
}

export function itemLine(item: KnowledgeItem): string {
  const label = `${item.function}/${item.articulation}`;
  const body = item.claim ?? item.entity ?? item.demonstrated_by ?? item.phenomenon ?? "";
  const hedge = item.evidence === "verified" ? "" : ` (${item.evidence})`;
  return `${label}: ${item.subject}: ${body}${hedge}`;
}

export async function itemDigest(item: KnowledgeItem): Promise<string> {
  return await sha256Hex(`${item.subject}\n${item.claim ?? item.entity ?? ""}\n${item.function}`);
}
