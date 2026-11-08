// three ways to play a score as code.
//
// strudel, tidal cycles and sonic pi are not interchangeable, and pretending they are
// is how a "generated song" ends up as three unrelated loops. so the score is the
// truth (music/score.ts) and these are renderings: same chords, same bars, same tempo,
// three dialects. a human can then live-code it, tweak it, and commit the tweak.

import type { Score } from "./score.ts";

function header(score: Score, dialect: string): string {
  const total = score.sections.reduce((sum, s) => sum + s.bars, 0);
  return [
    `// ${score.title} · ${score.key} · ${score.bpm} bpm · ${score.meter} · ${total} bars · seed ${score.seed}`,
    `// ${dialect}. generated from the score, so editing this file is editing the song`,
    `// rather than the output of a generator. keep it in the repo.`,
  ].join("\n");
}

// one chord name per bar, in the angle brackets strudel and tidal both read as
// "one event per cycle", which is why both dialects get the same list
// tidal writes note names in lower case, so the same score is spelled twice
function chordList(score: Score, lower = false): string {
  const chords = score.sections.flatMap((section) => section.chords);
  return (lower ? chords.map((c) => c.toLowerCase()) : chords).join(" ");
}

function bassList(score: Score): string {
  return score.sections.flatMap((section) => section.bass).join(" ");
}

const beatsPerBar = (meter: string) => Number(meter.split("/")[0]) || 4;

export function toStrudel(score: Score): string {
  const sectionPatterns = score.sections.map((section, index) => {
    const name = `s${index}_${section.kind}`;
    const chords = section.chords.join(" ");
    return `const ${name} = chord("<${chords}>").sound("sawtooth").lpf(1400).gain(0.7)`;
  });
  const arrangement = score.sections.map((section, index) => `  [${section.bars}, s${index}_${section.kind}],`).join("\n");
  return [
    header(score, "strudel"),
    `setcpm(${score.bpm}/4)`,
    "",
    ...sectionPatterns,
    "",
    `const bass = note("<${bassList(score)}>").sound("sine").gain(0.8)`,
    "",
    "$: arrange(",
    arrangement,
    ")",
    "",
    "$: bass",
    "",
  ].join("\n");
}

export function toTidal(score: Score): string {
  const total = score.sections.reduce((sum, s) => sum + s.bars, 0);
  const shapes = score.sections.map((s) => `${s.kind}:${s.bars}`).join(" ");
  return [
    header(score, "tidal cycles"),
    `-- ${shapes}`,
    `setcps (${score.bpm}/60/4)`,
    "",
    "-- one event per cycle, so the angle brackets are the bar count",
    `d1 $ note "<${chordList(score, true)}>" # sound "sawtooth" # lpf 1400`,
    `d2 $ note "<${bassList(score)}>" # sound "sine"`,
    "",
    `-- ${total} cycles is ${total} bars at ${score.bpm} bpm in ${score.meter}`,
    "",
  ].join("\n");
}

export function toSonicPi(score: Score): string {
  const beats = beatsPerBar(score.meter);
  const blocks = score.sections.map((section, index) => {
    const chord = section.chords[0] ?? "C";
    const minor = chord.endsWith("m");
    const root = chord.replace("m", "").toLowerCase();
    return [
      `  # ${section.kind} ${index + 1}: ${section.bars} bars`,
      `  use_synth :saw`,
      `  play (chord :${root}3, :${minor ? "minor" : "major"}), release: ${(beats * 0.9).toFixed(1)}`,
      `  play :${section.bass[0]?.toLowerCase() ?? "c2"}, release: ${(beats * 0.9).toFixed(1)}, amp: 0.8`,
      `  sleep ${(section.bars * beats).toFixed(2)}`,
    ].join("\n");
  });
  const totalBeats = score.sections.reduce((sum, s) => sum + s.bars * beats, 0);
  return [
    `# ${score.title} · ${score.key} · ${score.bpm} bpm · ${score.meter}`,
    `# sonic pi. generated from the score (music/score.ts), committed like source.`,
    `# ${totalBeats} beats of sleep in total, which is ${totalBeats / beats} bars`,
    `use_bpm ${score.bpm}`,
    "",
    ...blocks,
    "",
  ].join("\n");
}

export interface CodeSong {
  strudel: string;
  tidal: string;
  sonic_pi: string;
}

export function renderScore(score: Score): CodeSong {
  return { strudel: toStrudel(score), tidal: toTidal(score), sonic_pi: toSonicPi(score) };
}

// the renderings are only worth anything if they agree with the score they claim to
// render, so this is checked rather than assumed
export function renderProblems(score: Score, rendered: CodeSong): string[] {
  const problems: string[] = [];
  if (!rendered.strudel.includes(`setcpm(${score.bpm}/4)`)) problems.push("strudel: the tempo is not the score's tempo");
  if (!rendered.tidal.includes(`setcps (${score.bpm}/60/4)`)) problems.push("tidal: the tempo is not the score's tempo");
  if (!rendered.sonic_pi.includes(`use_bpm ${score.bpm}`)) problems.push("sonic pi: the tempo is not the score's tempo");

  const bars = score.sections.reduce((sum, s) => sum + s.bars, 0);
  const chordNames = score.sections.flatMap((s) => s.chords);
  for (const chord of new Set(chordNames)) {
    if (!rendered.strudel.includes(chord)) problems.push(`strudel: ${chord} is in the score and not in the code`);
    if (!rendered.tidal.includes(chord.toLowerCase())) problems.push(`tidal: ${chord} is in the score and not in the code`);
  }
  const tidalNotes = rendered.tidal.match(/note "<([^"]+)>"/)?.[1]?.trim().split(/\s+/).length ?? 0;
  if (tidalNotes !== bars) problems.push(`tidal: ${tidalNotes} events for ${bars} bars, so the arrangement drifts`);

  const sleeps = [...rendered.sonic_pi.matchAll(/sleep ([\d.]+)/g)].map((m) => Number(m[1]));
  const sleepsTotal = sleeps.reduce((sum, n) => sum + n, 0);
  const beats = beatsPerBar(score.meter);
  if (Math.abs(sleepsTotal - bars * beats) > 0.01) {
    problems.push(`sonic pi: ${sleepsTotal} beats of sleep for ${bars} bars of ${score.meter}`);
  }
  return problems;
}
