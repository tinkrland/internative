// prosody as measurement, not as adjective.
//
// warm, dry and clipped are what a listener concludes. the prosody underneath is pitch,
// loudness, timing and voice quality, and each of those has a unit. a value with no unit and
// no method is a preference wearing a number.
//
// grounding (notes/voice-components.md on the research branch): prosody is pitch, loudness,
// tempo and rhythm, timbre and pausing; intonation is notated rather than described (ToBI:
// pitch accents H*/L*, phrase accents H-/L-, boundary tones H%/L%, break indices); voice
// quality is measured as f0, jitter, shimmer and harmonics-to-noise; speaker identity rides
// on f0 and formants, which is why timbre never belongs to a register.

export type Unit = "hz" | "st" | "db" | "percent" | "syllables_per_second" | "ms";

export interface Measurement {
  value: number;
  unit: Unit;
  // which vowel or context the number was taken on, because f0 on /a/ is not f0 on /i/
  context: string;
  // which tool produced it, because the literature quotes the same quantity in % and in dB
  method: string;
}

export interface Prosody {
  // identity-adjacent: median f0 belongs to the trained voice
  f0_median: Measurement;
  // what she is doing with it: a span in semitones, not an absolute pitch
  f0_span: Measurement;
  rate: Measurement;
  pause_median: Measurement;
  jitter?: Measurement;
  shimmer?: Measurement;
  hnr?: Measurement;
  // ToBI, when somebody has actually annotated
  boundary_tones?: string[];
  notes?: string;
}

const ALLOWED_UNITS: Record<string, Unit[]> = {
  f0_median: ["hz"],
  f0_span: ["st"],
  rate: ["syllables_per_second"],
  pause_median: ["ms"],
  jitter: ["percent"],
  shimmer: ["db", "percent"],
  hnr: ["db"],
};

// adjectives that name a listener's inference instead of a measurement
const INFERENCE = [
  "warm",
  "cold",
  "dry",
  "clipped",
  "confident",
  "sarcastic",
  "sassy",
  "soft",
  "husky",
  "friendly",
  "energetic",
  "flat",
];

export function inferenceWords(text: string): string[] {
  const lower = text.toLowerCase();
  return INFERENCE.filter((word) => new RegExp(`\\b${word}`, "i").test(lower));
}

export function measurementProblems(name: string, m: Measurement | undefined, required: boolean): string[] {
  const problems: string[] = [];
  if (!m) {
    if (required) problems.push(`${name}: missing, and this dimension is not optional`);
    return problems;
  }
  const units = ALLOWED_UNITS[name] ?? [];
  if (!units.length) return problems;
  if (!units.includes(m.unit)) {
    problems.push(`${name}: unit must be one of ${units.join(", ")}, not "${m.unit}"`);
  }
  if (!Number.isFinite(m.value)) problems.push(`${name}: value is not a number`);
  if (!m.context?.trim()) problems.push(`${name}: no context, and f0 on one vowel is not f0 on another`);
  if (!m.method?.trim()) {
    problems.push(`${name}: no method, and this literature quotes the same quantity in percent and in dB`);
  }
  if (m.value <= 0 && m.unit !== "db" && m.unit !== "st") {
    problems.push(`${name}: a positive quantity cannot be ${m.value}`);
  }
  return problems;
}

export function prosodyProblems(p: Prosody): string[] {
  const problems: string[] = [];
  problems.push(...measurementProblems("f0_median", p.f0_median, true));
  problems.push(...measurementProblems("f0_span", p.f0_span, true));
  problems.push(...measurementProblems("rate", p.rate, true));
  problems.push(...measurementProblems("pause_median", p.pause_median, true));
  problems.push(...measurementProblems("jitter", p.jitter, false));
  problems.push(...measurementProblems("shimmer", p.shimmer, false));
  problems.push(...measurementProblems("hnr", p.hnr, false));

  // a median outside human speaking range is a transcription error, not a voice
  if (p.f0_median && (p.f0_median.value < 60 || p.f0_median.value > 400)) {
    problems.push("f0_median: outside 60 to 400 Hz, so this is not a speaking voice as measured here");
  }
  // a span in hertz was never converted: span says what she does, hertz says who she is
  if (p.f0_span && p.f0_span.unit === "hz") problems.push("f0_span: convert to semitones");
  if ((p.boundary_tones ?? []).some((tone) => !/^([HL][*\-]?%?)+$/.test(tone.trim()))) {
    problems.push("boundary_tones: ToBI tones look like H%, L%, H*, L*");
  }
  const inferred = inferenceWords(p.notes ?? "");
  if (inferred.length) {
    problems.push(`notes: "${inferred[0]}" is what a listener concludes, not what was measured`);
  }
  return problems;
}

// how far apart two prosodies are, over the dimensions BOTH measured, normalised per
// dimension so a hertz difference does not drown a pause difference.
export function prosodyDistance(a: Prosody, b: Prosody): { distance: number; compared: string[] } {
  const dims: (keyof Prosody)[] = ["f0_span", "rate", "pause_median", "jitter", "shimmer", "hnr"];
  const scale: Record<string, number> = {
    f0_span: 12,
    rate: 2,
    pause_median: 500,
    jitter: 2,
    shimmer: 1,
    hnr: 10,
  };
  let total = 0;
  const compared: string[] = [];
  for (const dim of dims) {
    const av = (a[dim] as Measurement | undefined)?.value;
    const bv = (b[dim] as Measurement | undefined)?.value;
    if (av === undefined || bv === undefined) continue;
    total += Math.abs(av - bv) / scale[String(dim)];
    compared.push(String(dim));
  }
  return { distance: compared.length ? total / compared.length : 0, compared };
}

// what a text-to-speech adapter can actually be told. the rest of prosody is the voice
// model's business, and a caller that tries to send it here is looking in the wrong file.
export interface SpeechCues {
  rate: "slower" | "measured" | "normal" | "quicker";
  pitch_span: "narrow" | "moderate" | "wide";
  pause: "short" | "natural" | "long";
  emphasis: "light" | "marked";
}

export function speechCues(p: Prosody): { cues: SpeechCues; notes: string[] } {
  const notes: string[] = [];
  const rate = p.rate?.value ?? 0;
  const span = p.f0_span?.unit === "st" ? p.f0_span.value : 0;
  const pause = p.pause_median?.value ?? 0;
  const cues: SpeechCues = {
    rate: rate < 3.5 ? "slower" : rate < 4.2 ? "measured" : rate < 5.2 ? "normal" : "quicker",
    pitch_span: span < 4 ? "narrow" : span < 8 ? "moderate" : "wide",
    pause: pause < 200 ? "short" : pause < 500 ? "natural" : "long",
    emphasis: span >= 8 ? "marked" : "light",
  };
  if (!p.jitter && !p.shimmer && !p.hnr) {
    notes.push("voice quality unmeasured here: breathiness and roughness stay with the trained voice");
  }
  return { cues, notes };
}

export function prosodyLine(p: Prosody): string {
  const parts = [
    `f0 ${Math.round(p.f0_median.value)} Hz median`,
    `span ${p.f0_span.value} st`,
    `${p.rate.value} syl/s`,
    `pauses ${Math.round(p.pause_median.value)} ms`,
  ];
  if (p.hnr) parts.push(`hnr ${p.hnr.value} dB`);
  if (p.jitter) parts.push(`jitter ${p.jitter.value}%`);
  return parts.join(", ");
}
