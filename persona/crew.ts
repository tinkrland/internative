// the crew: one persona, several operators.
//
// a single agent that writes podcast chapters in the morning and joins a
// client meeting in the afternoon is one agent wearing seven hats, and the
// hats leak. the alternative is a crew: each vertical gets an operator with
// its own role, its own focus, its own playbooks and its own escalation line,
// while the identity underneath stays shared. the podcast operator sounds
// like the persona because the voice and the brand come from the head; it
// does not sound like the meeting operator because its register and its
// niche do not.
//
// the rule this file enforces: a crew member ADDS. it can narrow the register
// and name the escalation, and it cannot touch the name, the promise, the
// never list, or the disclosure.

import { personaBrief } from "./brand.ts";
import { resolveRegister } from "./registers.ts";
import type { CrewMember, PersonaManifest, SurfaceName } from "./schema.ts";
import { SURFACES } from "./schema.ts";

export interface ResolvedCrew {
  surface: SurfaceName;
  member: CrewMember;
  // the register the operator actually speaks with: the surface register,
  // narrowed by the crew's own notes
  register: string;
  // true when the manifest named a crew member for this vertical
  explicit: boolean;
}

export function crewFor(persona: PersonaManifest, surface: SurfaceName): ResolvedCrew {
  const member = persona.crew?.[surface];
  const surfaceRegister = resolveRegister(persona, surface).register;
  if (!member) {
    return {
      surface,
      member: {
        role: `the ${surface} operator`,
        focus: [],
      },
      register: surfaceRegister,
      explicit: false,
    };
  }
  return {
    surface,
    member,
    register: member.register_notes ? `${surfaceRegister}; ${member.register_notes}` : surfaceRegister,
    explicit: true,
  };
}

export function crewRoster(persona: PersonaManifest): ResolvedCrew[] {
  return persona.surfaces.map((surface) => crewFor(persona, surface));
}

// the operating brief: identity, then this vertical. the identity half is the
// same string every surface gets, which is the point: seven operators, one
// memory of who they work for.
export function crewBrief(persona: PersonaManifest, surface: SurfaceName, platform?: string): string {
  const crew = crewFor(persona, surface);
  const lines: string[] = [personaBrief(persona, { surface, platform }), ""];

  lines.push("# your post");
  lines.push(`${crew.member.role} (${surface})`);
  if (crew.member.focus.length) {
    lines.push(`focus: ${crew.member.focus.join("; ")}`);
  }
  if (crew.member.skills?.length) {
    lines.push(`playbooks: ${crew.member.skills.join(", ")}`);
  }
  if (crew.member.trains_on?.length) {
    lines.push(`taste comes from: ${crew.member.trains_on.join("; ")}`);
  }
  lines.push(`register: ${crew.register}`);
  lines.push(crew.member.autonomy ? `you may: ${crew.member.autonomy}` : "you may: prepare, and ask before anything leaves the house");
  if (crew.member.escalate_to_owner?.length) {
    lines.push(`hand back to the owner for: ${crew.member.escalate_to_owner.join("; ")}`);
  }
  lines.push("");
  lines.push("# what does not change");
  lines.push("the name, the promise, the never list and the disclosure above are the persona, not this post.");
  return lines.join("\n");
}

// a check for the loader: a crew entry is only allowed for a surface the
// persona enabled, and an explicit operator must say what it is for.
export function crewProblems(persona: PersonaManifest): string[] {
  const problems: string[] = [];
  const crew = persona.crew ?? {};
  for (const key of Object.keys(crew)) {
    if (!SURFACES.includes(key as SurfaceName)) {
      problems.push(`crew.${key}: unknown surface`);
      continue;
    }
    const member = crew[key as SurfaceName];
    if (!member) continue;
    if (!member.role || !member.role.trim()) problems.push(`crew.${key}.role: required`);
    if (!Array.isArray(member.focus) || member.focus.length === 0) {
      problems.push(`crew.${key}.focus: name at least one thing this operator is good at`);
    }
  }
  return problems;
}
