// FUNCTION: what the knowledge is FOR.
//
// propositional states that something is true. procedural is the ability to do a sequence.
// explanatory is why it happens, which is the only one that transfers to a new case.
// acquaintance is knowing OF something by having met it (Russell's knowledge by
// acquaintance), and it is the one a machine taxonomy forgets, which is why personas end up
// claiming intimacy with people they have exchanged three sentences with.
//
// the tests below are the difference between the four. a claim answers "is it true", a
// demonstration answers "can she do it", a mechanism answers "why", an entity answers
// "has she met it".
//
// NOTE: what she can REACH is not here. tool-calling is access/, not knowledge: knowing how
// to change a tyre is knowledge, having the keys to the van is access.

export type KnowledgeFunction = "propositional" | "procedural" | "explanatory" | "acquaintance";

export const KNOWLEDGE_FUNCTIONS: KnowledgeFunction[] = [
  "propositional",
  "procedural",
  "explanatory",
  "acquaintance",
];

export interface FunctionItem {
  function: string;
  claim?: string;
  phenomenon?: string;
  entity?: string;
  demonstrated_by?: string;
  articulation?: string;
}

export function functionProblems(item: FunctionItem): string[] {
  const problems: string[] = [];
  if (!KNOWLEDGE_FUNCTIONS.includes(item.function as KnowledgeFunction)) {
    problems.push(`function: "${item.function}" is not one of ${KNOWLEDGE_FUNCTIONS.join(", ")}`);
    return problems;
  }
  const tacit = item.articulation === "implicit_tacit" || item.articulation === "inherent_tacit";
  if (item.function === "procedural" && !(item.demonstrated_by ?? "").trim()) {
    problems.push("function: procedural knowledge points at the steps or the skill, not at a sentence");
  }
  if (item.function === "explanatory") {
    if (!(item.phenomenon ?? "").trim()) {
      problems.push("function: explanatory knowledge names the phenomenon it explains");
    }
    if (tacit) {
      problems.push("function: an explanation that cannot be stated is not an explanation. why-knowledge is explicit");
    }
  }
  if (item.function === "acquaintance") {
    if (!(item.entity ?? "").trim()) {
      problems.push("function: acquaintance names the thing she has met, not a fact about it");
    }
    if ((item.claim ?? "").trim()) {
      problems.push("function: acquaintance holds no claim. knowing Ana is not a proposition about Ana");
    }
  }
  if (item.function === "propositional" && !tacit && !(item.claim ?? "").trim()) {
    problems.push("function: a propositional item with no claim is a label, not knowledge");
  }
  return problems;
}
