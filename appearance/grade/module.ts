// the grade: one look across everything she posts.
//
// the fastest way to look like two people is to warm the stills and cool the clips.
// a persona gets one grade, and a series that changes it is a different series.

export interface GradeTuning {
  temperature: "warm" | "neutral" | "cool";
  contrast: number;
  key_direction: string;
  lens: string;
  grain: "none" | "fine" | "visible";
  note?: string;
}

export function gradeProblems(grade: GradeTuning): string[] {
  const problems: string[] = [];
  if (!["warm", "neutral", "cool"].includes(grade.temperature)) problems.push("temperature: warm, neutral or cool");
  if (!(grade.contrast >= 0 && grade.contrast <= 1)) problems.push("contrast: 0 to 1");
  if ((grade.key_direction ?? "").trim().length < 3) problems.push("key_direction: where the light comes from, every time");
  if ((grade.lens ?? "").trim().length < 2) problems.push("lens: one lens is a look, three lenses is a camera test");
  if (!["none", "fine", "visible"].includes(grade.grain)) problems.push("grain: none, fine or visible");
  return problems;
}

export function gradeBlock(grade: GradeTuning): string {
  return `grade: ${grade.temperature}, contrast ${grade.contrast}, key ${grade.key_direction}, ${grade.lens}, grain ${grade.grain}.`;
}
