// ORIGIN: how the knowledge got here, and what receipt that demands.
//
// a priori against empirical, split three ways, because the middle case is the one that
// gets filed wrong. what she lived is not what she was told, and what she was told is not
// what she read carefully. each has a different failure: a memory of an episode can be
// misremembered, testimony can be a lie, a document can be out of date.
//
// the fourth category, innate, is not storable and the rule says so out loud. her
// architecture is declared in the pack (model, version, context window), never remembered
// as a fact, because a fact that can be edited is not an architecture.

export type Origin = "experienced" | "testimony" | "studied";

export const ORIGINS: Origin[] = ["experienced", "testimony", "studied"];

export interface OriginItem {
  origin: string;
  source?: { kind: string; ref?: string; at?: string };
}

// what makes each origin checkable. a source is not decoration: it is the difference
// between "she was there" and "she has a story about being there".
const REQUIRED: Record<Origin, string[]> = {
  experienced: ["experience", "measurement"],
  testimony: ["conversation", "document"],
  studied: ["document"],
};

const WHY: Record<Origin, string> = {
  experienced: "an episode or a measurement, with the time it happened",
  testimony: "who told her, or what she read. a conversation never becomes verification by being repeated",
  studied: "the document it was studied from, so a later run can re-read it",
};

export function originProblems(item: OriginItem): string[] {
  const problems: string[] = [];
  if (item.origin === "innate") {
    problems.push(
      "origin: an innate item is not storable. her architecture is declared in the pack, not remembered",
    );
    return problems;
  }
  if (!ORIGINS.includes(item.origin as Origin)) {
    problems.push(`origin: "${item.origin}" is not one of ${ORIGINS.join(", ")}`);
    return problems;
  }
  const origin = item.origin as Origin;
  const kind = item.source?.kind ?? "";
  if (!REQUIRED[origin].includes(kind)) {
    problems.push(`origin: ${origin} needs ${WHY[origin]}`);
  }
  if (!(item.source?.ref ?? "").trim()) {
    problems.push(`origin: ${origin} names where it came from, not just the kind of source`);
  }
  return problems;
}

export function originLine(item: OriginItem): string {
  const origin = item.origin as Origin;
  const kind = item.source?.kind ?? "none";
  return `${origin} (${kind}${item.source?.ref ? `: ${item.source.ref}` : ""})`;
}
