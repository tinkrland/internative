// what the music branch gets from the head.
//
// this branch is orphaned on purpose: it shares no history with the head and
// vendors nothing. a song is planned against a brief, the head hands one over, and
// the aipn on it is how a released song can prove which personality sang it.

export interface HeadBrief {
  persona: string;
  // the immutable number. AIPN-000001 and not "example v3", because a song stays
  // attached to the person even after she is retuned.
  aipn: string;
  register: {
    register: string;
    energy: number;
    formality: number;
    lines: string;
    notes?: string;
  };
}

const AIPN = /^AIPN-\d{6}$/;

export function briefProblems(brief: HeadBrief): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(brief.persona ?? "")) problems.push("persona: not a persona slug");
  if (!AIPN.test(brief.aipn ?? "")) problems.push(`aipn: "${brief.aipn}" is not an aipn, and a song without one has no person behind it`);
  if (!brief.register?.register?.trim()) problems.push("register: a song needs the register it is sung in");
  if (brief.register && (brief.register.energy < 0 || brief.register.energy > 1)) {
    problems.push("register.energy: outside 0..1");
  }
  return problems;
}
