// the face, as descriptors rather than as a reference photo.
//
// a photo of a real person is a likeness, and a likeness is a licence. these are
// descriptors, authored once, that a render or a diffusion model reads the same way
// every time. the one field that would turn them back into a copy is
// named_reference, and it is refused unless there is paper behind it.

export interface FaceTuning {
  basis: "authored" | "licensed";
  licensed_reference?: string;
  // a real person's name. if this is set, the basis has to be licensed.
  named_reference?: string;
  structure: string;
  brows: string;
  eyes: string;
  nose: string;
  mouth: string;
  skin: string;
  age_range: [number, number];
  asymmetry?: string;
}

export function faceProblems(face: FaceTuning): string[] {
  const problems: string[] = [];
  if (face.named_reference?.trim() && face.basis !== "licensed") {
    problems.push(`named_reference: "${face.named_reference}" is a real person, and a likeness is a licence, not a descriptor`);
  }
  if (face.basis === "licensed" && !face.licensed_reference?.trim()) {
    problems.push("licensed_reference: a licensed likeness names the licence");
  }
  for (const field of ["structure", "brows", "eyes", "nose", "mouth", "skin"] as const) {
    if ((face[field] ?? "").trim().length < 3) problems.push(`${field}: a face needs a decision here, not a blank`);
  }
  const [min, max] = face.age_range ?? [0, 0];
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 18) problems.push("age_range: an appearance is an adult");
  if (max < min) problems.push("age_range: the range runs backwards");
  if (face.asymmetry === undefined) problems.push("asymmetry: say what is not symmetrical, or the render invents it every time");
  return problems;
}

export function faceBlock(face: FaceTuning): string {
  return [
    `face: ${face.structure}; brows ${face.brows}; eyes ${face.eyes}; nose ${face.nose}; mouth ${face.mouth}; skin ${face.skin}`,
    `apparent age ${face.age_range[0]} to ${face.age_range[1]}`,
    face.asymmetry ? `asymmetry: ${face.asymmetry}` : "",
  ]
    .filter(Boolean)
    .join(". ") + ".";
}
