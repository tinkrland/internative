// what may be learned, kept, said, and forgotten.
//
// a memory with no admission rules becomes a diary with no lock: it holds whatever the
// conversation said, forever, and every surface can read it. so the policy is data and the
// rules are refusals, in the same shape as the rest of the repo.

import { type KnowledgeItem } from "./item.ts";

export interface PolicyOptions {
  // a brief or a post that leaves the building
  public: boolean;
}

// the days an item is kept before it must be re-checked, by volatility. durable is null,
// because "forever" is a decision and not a default.
export const RETENTION_DAYS: Record<KnowledgeItem["volatility"], number | null> = {
  durable: null,
  seasonal: 120,
  volatile: 30,
};

// owner-scoped knowledge is the owner's, not the persona's to publish. it may inform a
// private surface and may not appear in anything public without being asked for.
export function maySayInPublic(item: KnowledgeItem): boolean {
  return item.scope !== "owner";
}

export function admissionProblems(item: KnowledgeItem, options: PolicyOptions): string[] {
  const problems: string[] = [];
  if (item.scope === "persona" && item.evidence !== "verified" && options.public) {
    problems.push("public: her own traits are asserted in public only when verified, otherwise the persona is a rumour about herself");
  }
  if (item.scope === "owner" && options.public && !maySayInPublic(item)) {
    problems.push("scope: this is the owner's knowledge, and a public surface is not where it goes");
  }
  if (item.function === "acquaintance" && options.public && item.evidence !== "verified") {
    problems.push("acquaintance: a public claim of knowing someone needs the relationship verified, not familiar");
  }
  if (item.evidence === "assumed" && options.public) {
    problems.push("public: an assumption is not something a persona says out loud about the world");
  }
  if (RETENTION_DAYS[item.volatility] !== null && !item.review_after) {
    problems.push(`retention: ${item.volatility} items are kept ${RETENTION_DAYS[item.volatility]} days and need a review date`);
  }
  return problems;
}

// two items about the same subject that assert different values are a contradiction, and a
// contradiction found later is cheaper than a contradiction published.
export function contradictionProblems(a: KnowledgeItem, b: KnowledgeItem): string[] {
  if (a.subject !== b.subject) return [];
  if (a.function !== "propositional" || b.function !== "propositional") return [];
  if ((a.claim ?? "").trim().toLowerCase() === (b.claim ?? "").trim().toLowerCase()) return [];
  const problems = [`contradiction: "${a.subject}" is held twice, as "${a.claim}" and "${b.claim}"`];
  // the resolution this repo prefers: verification first, then recency
  const rank = (item: KnowledgeItem): number => {
    const evidence = { verified: 3, reported: 2, inferred: 1, assumed: 0 }[item.evidence];
    return evidence * 1e12 + Date.parse(item.at);
  };
  const winner = rank(a) >= rank(b) ? a : b;
  problems.push(`contradiction: ${winner.id} wins (${winner.evidence}, ${winner.at}); retire the other by name`);
  return problems;
}

// nothing is forgotten by accident. an item leaves because something replaced it, said so,
// or expired.
export function retireProblems(item: KnowledgeItem, retired_by: string): string[] {
  const problems: string[] = [];
  if (!(retired_by ?? "").trim()) {
    problems.push("retire: name the item or the event that replaced this one, so the graph keeps the reason");
  }
  if (item.scope === "persona" && item.evidence === "verified" && !(retired_by ?? "").trim()) {
    problems.push("retire: a verified trait of hers does not disappear without a record");
  }
  return problems;
}

export function expired(item: KnowledgeItem, now: Date): boolean {
  if (!item.review_after) return false;
  return Date.parse(item.review_after) <= now.getTime();
}
