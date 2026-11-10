// knowledge is not one thing, and a persona that stores it as one thing is a search box.
//
// the human split this borrows from is older than the software: a priori against
// empirical (what she brought against what the world gave her), explicit against tacit
// (what she can tell against what she can only do: Ryle's knowing-how, Polanyi's "we can
// know more than we can tell"), and by function, factual against procedural against
// explanatory against acquaintance (Russell's knowledge OF a thing, by meeting it,
// against knowledge about it, by description).
//
// two axes are added because a machine makes them impossible to ignore, and both are
// failure modes this repo has already met once in another layer:
//
//   evidence    how do we know. a claim with no source is a claim a later run will
//               contradict with another claim with no source, and nothing will notice.
//   volatility  does it expire. a taste does not; a price, a phone model and a room's
//               furniture arrangement do.

import { sha256Hex } from "../persona/aipn.ts";

export type Origin = "experienced" | "testimony" | "studied";
// innate is deliberately absent: there is nowhere to store it. her architecture is
// declared in the pack (model, version), never remembered as a fact, because a memory
// that can be edited is not an architecture.

export type Articulation = "explicit" | "implicit_tacit" | "inherent_tacit";
export type Function = "propositional" | "procedural" | "explanatory" | "acquaintance";
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
  function: Function;
  evidence: Evidence;
  volatility: Volatility;
  scope: Scope;
  at: string;
  // stated knowledge: propositional and explanatory carry it, tacit may not, because a
  // tacit item that has been written down as prose has stopped being tacit
  claim?: string;
  phenomenon?: string;
  // acquainted knowledge names the thing met, never a claim about it
  entity?: string;
  // tacit and procedural point at the demonstration: a procedure, an example, an eval
  demonstrated_by?: string;
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
  if (!["experienced", "testimony", "studied", "innate"].includes(item.origin)) {
    problems.push(`origin: "${item.origin}" is not one of experienced, testimony, studied`);
  }
  if ((item.origin as string) === "innate") {
    problems.push("origin: an innate item is not storable. her architecture is declared in the pack, not remembered: a fact that can be edited is not an architecture");
  }

  // the articulation axis, enforced
  const tacit = item.articulation === "implicit_tacit" || item.articulation === "inherent_tacit";
  if (!tacit && item.function !== "acquaintance" && !(item.claim ?? "").trim()) {
    problems.push(`function: a ${item.function} item with no claim is a label, not knowledge`);
  }
  if (tacit && (item.claim ?? "").trim()) {
    problems.push("articulation: a tacit item may not carry a written claim. if it can be stated it is explicit; if it cannot, point at the demonstration");
  }
  if (tacit && !(item.demonstrated_by ?? "").trim()) {
    problems.push("articulation: tacit knowledge is held by a demonstration (procedure, example, eval). without one this is a claim wearing a costume");
  }

  // the function axis, enforced
  if (item.function === "procedural" && !(item.demonstrated_by ?? "").trim()) {
    problems.push("function: procedural knowledge points at the steps or the skill, not at a sentence");
  }
  if (item.function === "explanatory" && !(item.phenomenon ?? "").trim()) {
    problems.push("function: explanatory knowledge names the phenomenon it explains");
  }
  if (item.function === "acquaintance" && !(item.entity ?? "").trim()) {
    problems.push("function: acquaintance names the thing she has met, not a fact about it");
  }

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

  // sources have to exist for the origins that are made of them
  if (item.origin === "experienced" && !["experience", "measurement"].includes(item.source?.kind ?? "")) {
    problems.push("origin: experienced without an episode is a story she was told about herself");
  }
  if (item.origin === "studied" && item.source?.kind !== "document") {
    problems.push("origin: studied needs the document it was studied from");
  }
  if (item.origin === "testimony" && !["conversation", "document"].includes(item.source?.kind ?? "")) {
    problems.push("origin: testimony names who told her, or what she read");
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
