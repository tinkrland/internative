// interests are what she keeps coming back to when nobody is paying her to.
//
// they sit beside knowledge/ and memory/ because they are a third thing. knowledge is what
// she can say, memory is what happened, and an interest is what she reaches for. a persona
// without them answers questions competently and has no reason to ask one, which is the
// difference between an assistant and a person with a life.
//
// three rules keep them from becoming a keyword list:
//
//   a stake   why THIS, in words specific enough that a stranger could not have written it
//   a trail   something she actually did about it. an interest nobody pursues is a claim
//   not skill an interest is not a competence. "expert in" is knowledge/, and it lives there

export type InterestState = "active" | "latent" | "retired";

export interface Use {
  kind: "made" | "read" | "attended" | "asked" | "collected";
  ref: string;
  at: string; // ISO date
}

export interface Interest {
  id: string;
  name: string;
  domain: string;
  // what hooks her. not "it is interesting", which is what everybody says about everything
  why: string;
  // 1 passing curiosity, 2 follows it, 3 studies it
  depth: 1 | 2 | 3;
  state: InterestState;
  uses: Use[];
  // where she would look next, so a later run does not start from a search box
  sources?: string[];
  // her position on it. opinions are not knowledge: a stance can be held and argued
  stance?: string;
  // the versions of the thing she does not care about, which is how taste actually sounds
  avoid?: string[];
  crosses_with?: string[];
}

// competence words. an interest that says one of these is a CV entry wearing a hobby's clothes
const COMPETENCE = ["expert", "professional", "certified", "qualified", "specialist", "authority", "masters degree"];
const GENERIC = ["i just like it", "it is interesting", "it's interesting", "vibes", "everything about it", "i don t know"];

export function interestProblems(interest: Interest): string[] {
  const problems: string[] = [];
  if (!interest.id?.trim()) problems.push("id: required");
  if (!interest.name?.trim()) problems.push("name: required");
  if (!interest.domain?.trim()) problems.push("domain: required, so two interests in the same field can be told apart");

  const why = (interest.why ?? "").trim();
  if (why.length < 20) {
    problems.push("why: say what hooks her, in a sentence only she would write");
  }
  const lower = why.toLowerCase();
  const generic = GENERIC.find((g) => lower.includes(g));
  if (generic) problems.push(`why: "${generic}" is what everybody says about everything, so it says nothing`);
  const competence = COMPETENCE.find((c) => lower.includes(c));
  if (competence) {
    problems.push(`why: "${competence}" is a competence, and competence is knowledge/, not interest`);
  }

  if (![1, 2, 3].includes(interest.depth)) problems.push("depth: 1, 2 or 3");
  if (!["active", "latent", "retired"].includes(interest.state)) problems.push('state: active, latent or retired');

  for (const use of interest.uses ?? []) {
    if (!["made", "read", "attended", "asked", "collected"].includes(use.kind)) {
      problems.push(`uses: "${use.kind}" is not a way to pursue something`);
    }
    if (!/^\d{4}-\d{2}-\d{2}/.test(use.at ?? "")) problems.push("uses: every use carries a date, or the trail has no shape");
    if (!use.ref?.trim()) problems.push("uses: a use names what it was, so it can be checked");
  }

  // depth is earned by doing, not declared
  if (interest.depth === 3 && (interest.uses ?? []).length < 2) {
    problems.push("depth: studying something leaves a trail of at least two, so a 3 with no trail is a claim");
  }
  if (interest.state === "active" && !(interest.uses ?? []).length) {
    problems.push("state: active with nothing done about it. that is a latent interest, or a wish");
  }
  return problems;
}

export interface InterestSet {
  id: string;
  items: Interest[];
}

export const MAX_ACTIVE = 7;
export const STALE_DAYS = 120;

export function setProblems(set: InterestSet): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const interest of set.items) {
    if (ids.has(interest.id)) problems.push(`${interest.id}: declared twice`);
    ids.add(interest.id);
    problems.push(...interestProblems(interest).map((p) => `${interest.id}: ${p}`));
  }

  const active = set.items.filter((i) => i.state === "active");
  if (active.length > MAX_ACTIVE) {
    problems.push(
      `active: ${active.length} interests are live, and a persona interested in everything has no character. keep ${MAX_ACTIVE}`,
    );
  }
  for (const interest of set.items) {
    for (const other of interest.crosses_with ?? []) {
      if (!ids.has(other)) problems.push(`${interest.id}: crosses with "${other}", which is not in this set`);
    }
  }
  // an interest with a stance and no avoid list is a position with no edges
  for (const interest of set.items) {
    if (interest.stance && !(interest.avoid ?? []).length && interest.depth >= 2) {
      problems.push(`${interest.id}: a stance with nothing she dislikes is a summary, not taste`);
    }
  }
  return problems;
}

function daysBetween(fromIso: string, nowIso: string): number {
  return Math.round((Date.parse(nowIso) - Date.parse(fromIso)) / 86_400_000);
}

// the honest one. an active interest nothing has happened to in four months is a claim
export function staleProblems(set: InterestSet, now: string): { id: string; days: number }[] {
  const stale: { id: string; days: number }[] = [];
  for (const interest of set.items) {
    if (interest.state !== "active") continue;
    const dates = (interest.uses ?? []).map((u) => u.at).sort();
    const last = dates[dates.length - 1];
    if (!last) continue;
    const days = daysBetween(last, now);
    if (days > STALE_DAYS) stale.push({ id: interest.id, days });
  }
  return stale;
}

// what reaches a prompt. depth first, then most recent, and the reason stays with it so an
// interest cannot become a bare keyword
export function interestBrief(set: InterestSet, limit = 5): string[] {
  return set.items
    .filter((i) => i.state === "active")
    .sort((a, b) => b.depth - a.depth || (b.uses.at(-1)?.at ?? "").localeCompare(a.uses.at(-1)?.at ?? ""))
    .slice(0, limit)
    .map((i) => `${i.name} (${i.domain}, ${i.depth}/3): ${i.why.replace(/\.$/, "")}${i.stance ? `, and she thinks ${i.stance}` : ""}`);
}

// what she would make something about, without being asked
export function topicsFor(set: InterestSet, n = 3): string[] {
  return set.items
    .filter((i) => i.state === "active" && i.depth >= 2)
    .sort((a, b) => b.depth - a.depth || b.uses.length - a.uses.length)
    .slice(0, n)
    .map((i) => i.name);
}
