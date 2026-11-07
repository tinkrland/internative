// a pilot is a promise, so the promise is checkable.
//
// the two things this refuses are the two that would be embarrassing later: a
// pilot whose vertical and surface disagree with where it lives, and a pilot
// whose fiction or satire frame is missing or too thin to do any work.

export interface CastMember {
  id: string;
  name: string;
  role: string;
  register: string;
  continuity: string;
}

export interface Repackaging {
  surface: string;
  what_survives: string;
  rule: string;
}

export interface Pilot {
  id: string;
  title: string;
  vertical: string;
  surface: string;
  form: string;
  format: string;
  cadence: string;
  fiction: { kind: string; placement: string; disclosure: string };
  cast?: CastMember[];
  narrator?: { who: string; note: string };
  repackaging?: Repackaging[];
  guardrails: string[];
  episode_zero: { title: string; running_time: string; beats: string[] };
}

// where the frame sits. a photoreal likeness is not disclosed once and forgotten,
// and an invented case can carry its tag at the end if the rest of the packaging
// already says so.
export const PLACEMENTS = ["cold_open", "end_tag", "on_screen_continuous", "stated_in_notes"];

// a show with a cast is a show whose hardest problem is keeping the voices apart
export const MIN_CAST = 2;

// the folders are verticals, because that is how a show is described. the
// surfaces are what the head actually has, so both are named and both are checked.
export const VERTICALS: Record<string, { surface: string; form: string }> = {
  "audio/podcast": { surface: "audio", form: "podcast" },
  "audio/music": { surface: "audio", form: "music" },
  "video/long-form": { surface: "longform", form: "long-form" },
};

export const SURFACES = ["audio", "longform", "text", "static", "streaming", "shortform", "meetings", "proskena"];

export const MIN_DISCLOSURE = 40;
export const MIN_GUARDRAILS = 3;

export function checkPilot(pilot: Pilot, folderId: string, vertical: string): string[] {
  const problems: string[] = [];
  const known = VERTICALS[vertical];
  if (!known) {
    problems.push(`${folderId}: lives in ${vertical}, which is not a vertical this branch knows`);
    return problems;
  }
  if (pilot.id !== folderId) problems.push(`${folderId}: id is "${pilot.id}" and the folder says otherwise`);
  if (pilot.vertical !== vertical) problems.push(`${folderId}: vertical says "${pilot.vertical}" but it lives in ${vertical}`);
  if (pilot.surface !== known.surface) {
    problems.push(`${folderId}: surface "${pilot.surface}" would not reach it, ${vertical} runs on ${known.surface}`);
  }
  if (!SURFACES.includes(pilot.surface)) problems.push(`${folderId}: the head has no surface called "${pilot.surface}"`);
  if (pilot.form !== known.form) problems.push(`${folderId}: form "${pilot.form}" disagrees with ${vertical} (${known.form})`);
  if (!pilot.title.trim()) problems.push(`${folderId}: no title`);
  if (!pilot.format.trim()) problems.push(`${folderId}: no format, so the shape of an episode is undecided`);
  if (!pilot.cadence.trim()) problems.push(`${folderId}: no cadence`);
  if (!pilot.fiction?.kind?.trim()) problems.push(`${folderId}: no kind of fiction, so nothing says what is invented`);
  if (!PLACEMENTS.includes(pilot.fiction?.placement ?? "")) {
    problems.push(`${folderId}: placement "${pilot.fiction?.placement}" is not one of ${PLACEMENTS.join(", ")}`);
  }
  if ((pilot.fiction?.disclosure ?? "").trim().length < MIN_DISCLOSURE) {
    problems.push(`${folderId}: the disclosure is thinner than ${MIN_DISCLOSURE} characters, which is not a frame`);
  }
  if (!Array.isArray(pilot.guardrails) || pilot.guardrails.length < MIN_GUARDRAILS) {
    problems.push(`${folderId}: fewer than ${MIN_GUARDRAILS} guardrails, so the show has no stated refusals`);
  }
  if (pilot.narrator) {
    if (!pilot.narrator.who?.trim()) problems.push(`${folderId}: declares a narrator and does not say who`);
    if (!pilot.narrator.note?.trim()) problems.push(`${folderId}: declares a narrator with no note about what the name is`);
  }
  if (pilot.cast) {
    if (pilot.cast.length < MIN_CAST) problems.push(`${folderId}: a cast of ${pilot.cast.length} is not a show with voices to manage`);
    const registers = new Map<string, string>();
    for (const member of pilot.cast) {
      if (!member.id?.trim() || !member.name?.trim()) problems.push(`${folderId}: a cast member has no id or no name`);
      if (!member.role?.trim()) problems.push(`${folderId}: ${member.id} has no role, so nobody knows why he is on the sofa`);
      if (!member.continuity?.trim()) problems.push(`${folderId}: ${member.id} has no continuity, so he will forget what he was told`);
      const key = (member.register ?? "").toLowerCase().replace(/[^a-z ]/g, "").trim();
      if (key.length < 10) problems.push(`${folderId}: ${member.id} has no usable register`);
      const clash = registers.get(key);
      if (clash) problems.push(`${folderId}: ${member.id} and ${clash} share a register, which is how six voices become one`);
      else registers.set(key, member.id);
    }
  }
  for (const target of pilot.repackaging ?? []) {
    if (!SURFACES.includes(target.surface)) {
      problems.push(`${folderId}: repackages into "${target.surface}", which the head does not have`);
    }
    if (!target.what_survives?.trim()) problems.push(`${folderId}: repackages into ${target.surface} with nothing said about what survives the cut`);
    if (!target.rule?.trim()) problems.push(`${folderId}: repackages into ${target.surface} with no rule about what the cut must keep`);
  }
  if (!pilot.episode_zero?.title?.trim()) problems.push(`${folderId}: no episode zero`);
  if (!Array.isArray(pilot.episode_zero?.beats) || pilot.episode_zero.beats.length < 3) {
    problems.push(`${folderId}: episode zero has fewer than three beats`);
  }
  return problems;
}

export function findPilots(root = "pilot"): { pilot: Pilot; file: string; vertical: string; folderId: string }[] {
  const found: { pilot: Pilot; file: string; vertical: string; folderId: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of Deno.readDirSync(dir)) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory) walk(path);
      else if (entry.name === "pilot.json") {
        const parts = path.split("/");
        const folderId = parts[parts.length - 2];
        const vertical = parts.slice(1, parts.length - 2).join("/");
        found.push({ pilot: JSON.parse(Deno.readTextFileSync(path)) as Pilot, file: path, vertical, folderId });
      }
    }
  };
  try {
    walk(root);
  } catch {
    return found;
  }
  return found.sort((a, b) => a.pilot.id.localeCompare(b.pilot.id));
}

export function pilotProblems(root = "pilot"): { ok: boolean; problems: string[]; ids: string[] } {
  const pilots = findPilots(root);
  const problems = pilots.flatMap((p) => checkPilot(p.pilot, p.folderId, p.vertical));
  return { ok: problems.length === 0 && pilots.length > 0, problems, ids: pilots.map((p) => p.pilot.id) };
}

if (import.meta.main) {
  const result = pilotProblems();
  const pilots = findPilots();
  for (const p of pilots) {
    const state = checkPilot(p.pilot, p.folderId, p.vertical);
    console.log(`${p.pilot.id}: ${state.length ? `BROKEN: ${state.join("; ")}` : "in shape"}`);
    const cast = p.pilot.cast ? `, ${p.pilot.cast.length} voices` : "";
    const cuts = p.pilot.repackaging?.length ? `, repackages to ${p.pilot.repackaging.map((r) => r.surface).join(" + ")}` : "";
    console.log(`  ${p.vertical} -> ${p.pilot.surface} surface, ${p.pilot.cadence}, frame ${p.pilot.fiction.placement}, ${p.pilot.guardrails.length} guardrails${cast}${cuts}`);
  }
  console.log(`\n${pilots.length} pilots, ${result.ok ? "all in shape" : "problems above"}`);
  if (!result.ok) Deno.exit(1);
}
