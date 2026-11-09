// the hair, plus the thing that actually keeps hair consistent: how often it is cut.

export interface HairTuning {
  length: string;
  texture: string;
  parting: string;
  colour: string;
  // a person's hair does not grow a foot in a week. the cycle is what stops a
  // series shot two months apart from showing two different haircuts.
  cut_cycle_days: number;
  styling?: string;
}

const TEXTURES = ["straight", "wavy", "curly", "coily"];

export function hairProblems(hair: HairTuning): string[] {
  const problems: string[] = [];
  if ((hair.length ?? "").trim().length < 3) problems.push("length: required");
  if (!TEXTURES.includes((hair.texture ?? "").toLowerCase())) problems.push(`texture: one of ${TEXTURES.join(", ")}`);
  if ((hair.parting ?? "").trim().length < 3) problems.push("parting: required, or the fringe moves between shots");
  if ((hair.colour ?? "").trim().length < 3) problems.push("colour: required");
  if (!Number.isInteger(hair.cut_cycle_days) || hair.cut_cycle_days < 14) {
    problems.push("cut_cycle_days: under two weeks is a different haircut every shoot");
  }
  return problems;
}

export function hairBlock(hair: HairTuning): string {
  return `hair: ${hair.length}, ${hair.texture}, ${hair.parting}, ${hair.colour}${hair.styling ? `, ${hair.styling}` : ""}.`;
}

// where in the cycle a shoot lands, so a series does not silently drift past a cut
export function daysSinceCut(shootDay: string, cutDay: string): number {
  const a = Date.parse(`${shootDay}T00:00:00Z`);
  const b = Date.parse(`${cutDay}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN;
  return Math.round((a - b) / 86_400_000);
}

export function hairDrift(hair: HairTuning, shootDay: string, cutDay: string): string | undefined {
  const days = daysSinceCut(shootDay, cutDay);
  if (Number.isNaN(days)) return "the shoot day or the cut day is not a date";
  if (days > hair.cut_cycle_days) return `${days} days after a cut, and the cycle is ${hair.cut_cycle_days}: book the appointment or shoot the same length`;
  return undefined;
}
