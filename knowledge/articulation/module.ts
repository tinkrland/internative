// ARTICULATION: whether it can be said, and what changes when you try.
//
// explicit is knowledge that survives being written down. tacit is knowledge that does not,
// and the split inside tacit matters: implicit tacit can be articulated on reflection ("I
// brake before the corner, I think because of the camber"), inherent tacit cannot be
// articulated at all and is only ever visible as doing (Polanyi: we can know more than we
// can tell).
//
// the rule follows and it is the sharpest one in this folder: A TACIT ITEM MAY NOT CARRY A
// WRITTEN CLAIM. writing it down does not preserve it, it replaces it with a sentence a
// model can produce without having the skill. so a tacit item points at its demonstration:
// a procedure, an example, an eval. without one it is a claim wearing a costume.

export type Articulation = "explicit" | "implicit_tacit" | "inherent_tacit";

export const ARTICULATIONS: Articulation[] = ["explicit", "implicit_tacit", "inherent_tacit"];

export interface ArticulationItem {
  articulation: string;
  claim?: string;
  demonstrated_by?: string;
  // implicit tacit items may carry the reflection, which is a note about the knowledge and
  // explicitly not the knowledge itself
  reflection?: string;
}

export function isTacit(articulation: string): boolean {
  return articulation === "implicit_tacit" || articulation === "inherent_tacit";
}

export function articulationProblems(item: ArticulationItem): string[] {
  const problems: string[] = [];
  if (!ARTICULATIONS.includes(item.articulation as Articulation)) {
    problems.push(`articulation: "${item.articulation}" is not one of ${ARTICULATIONS.join(", ")}`);
    return problems;
  }
  if (!isTacit(item.articulation)) return problems;
  if ((item.claim ?? "").trim()) {
    problems.push(
      "articulation: a tacit item may not carry a written claim. if it can be stated it is explicit; if it cannot, point at the demonstration",
    );
  }
  if (!(item.demonstrated_by ?? "").trim()) {
    problems.push(
      "articulation: tacit knowledge is held by a demonstration (procedure, example, eval). without one this is a claim wearing a costume",
    );
  }
  if (item.articulation === "inherent_tacit" && (item.reflection ?? "").trim()) {
    problems.push(
      "articulation: inherent tacit cannot be reflected on. if she can put it into words when asked, it is implicit",
    );
  }
  return problems;
}
