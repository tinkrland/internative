// what reaches a prompt, and in what order.
//
// a brief is not a dump of everything the persona knows. it is the smallest set of items
// that answers "who is in front of me, what is true here, what can I do, and what do I only
// half know", ordered so that the certain things sit next to the task and the hedged things
// sit last where a writer can see they are hedged.
//
// the rule that makes this a cognition layer rather than a search index: tacit knowledge is
// never rendered as a sentence. it is rendered as a pointer to the demonstration, because a
// tacit item written out as prose is a claim, and a claim is a different kind of knowledge.

import { itemLine, type KnowledgeItem } from "./item.ts";
import { expired, maySayInPublic } from "./policy.ts";

export interface BriefOptions {
  // characters, not tokens: this is a cut, and a cut has to be a number
  budget: number;
  public: boolean;
  now?: Date;
}

export interface Dropped {
  id: string;
  why: string;
}

export interface KnowledgeBrief {
  block: string;
  used: string[];
  dropped: Dropped[];
}

// the order is the point. acquaintance first (she knows of them), then what is true, then
// why it is true, then what she can do, then what she can only do, then what she half knows.
const ORDER: Record<KnowledgeItem["function"], number> = {
  acquaintance: 0,
  propositional: 1,
  explanatory: 2,
  procedural: 3,
};

export function knowledgeBrief(items: KnowledgeItem[], options: BriefOptions): KnowledgeBrief {
  const now = options.now ?? new Date();
  const dropped: Dropped[] = [];
  const usable: KnowledgeItem[] = [];

  for (const item of items) {
    if (expired(item, now)) {
      dropped.push({ id: item.id, why: `expired ${item.review_after}` });
      continue;
    }
    if (options.public && !maySayInPublic(item)) {
      dropped.push({ id: item.id, why: `scope ${item.scope}, and this brief is public` });
      continue;
    }
    if (options.public && item.evidence === "assumed") {
      dropped.push({ id: item.id, why: "an assumption is not a public claim" });
      continue;
    }
    usable.push(item);
  }

  // certain before hedged within each function, then alphabetical so a re-run is a re-run
  const certainty = { verified: 0, reported: 1, inferred: 2, assumed: 3 };
  usable.sort((a, b) =>
    ORDER[a.function] - ORDER[b.function] ||
    certainty[a.evidence] - certainty[b.evidence] ||
    a.subject.localeCompare(b.subject)
  );

  const lines: string[] = [];
  const used: string[] = [];
  let length = 0;
  for (const item of usable) {
    const line = itemLine(item);
    if (length + line.length + 1 > options.budget) {
      dropped.push({ id: item.id, why: "over budget" });
      continue;
    }
    lines.push(line);
    used.push(item.id);
    length += line.length + 1;
  }

  return { block: lines.join("\n"), used, dropped };
}

// a cover figure for a persona pack: how much of her knowledge is stated, how much is tacit,
// and whether any axis is empty. an all-explicit persona is a documentation site.
export function axisCoverage(items: KnowledgeItem[]) {
  const count = <T extends string>(key: (item: KnowledgeItem) => T) => {
    const out: Record<string, number> = {};
    for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
    return out;
  };
  return {
    origin: count((item) => item.origin),
    articulation: count((item) => item.articulation),
    function: count((item) => item.function),
    evidence: count((item) => item.evidence),
    problems: coverageProblems(items),
  };
}

export function coverageProblems(items: KnowledgeItem[]): string[] {
  const problems: string[] = [];
  const articulation = new Set(items.map((item) => item.articulation));
  const funcs = new Set(items.map((item) => item.function));
  if (items.length && !articulation.has("implicit_tacit") && !articulation.has("inherent_tacit")) {
    problems.push("coverage: nothing she knows is tacit, which means she can only recite");
  }
  if (items.length && !funcs.has("procedural")) {
    problems.push("coverage: nothing she knows is procedural, which means she cannot do anything she has not read");
  }
  if (items.length && !funcs.has("acquaintance")) {
    problems.push("coverage: she has met nobody and been nowhere. acquaintance is the axis a series needs");
  }
  if (items.length && !items.some((item) => item.evidence === "verified")) {
    problems.push("coverage: every item is second-hand. nothing has been checked");
  }
  return problems;
}
