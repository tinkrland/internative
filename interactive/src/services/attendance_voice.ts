// what the persona says when it walks into a room, and when it leaves one.
//
// these two lines are the only place a meeting ever hears the personality
// speak in its own words, so they come from the head rather than from a
// string in the scheduler. the register decides the shape (short sentences,
// no emoji), the brand disclosure decides the honesty (it says it is an ai,
// attending for someone), and the consent note decides the ask.
//
// nothing here invents a name: the display name is the persona's.

import type { PersonaManifest } from "../../../persona/schema.ts";
import { resolveRegister } from "../../../persona/registers.ts";

export const ATTENDANCE_CEILING = 400;

export interface AttendanceLine {
  text: string;
  // which register shaped it, for an honest receipt
  register: string;
  // whether the disclosure sentence fit inside the ceiling
  disclosed: boolean;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// the join line. one ask, one disclosure, no warmth that the register did
// not authorise: "brief" means the message earns the room's patience.
export function attendanceMessage(
  persona: PersonaManifest,
  opts: { formUrl?: string | null; hostName?: string | null } = {},
): AttendanceLine {
  const register = resolveRegister(persona, "meetings", "zoom");
  const name = persona.display_name;
  const who = opts.hostName ? `, ${clean(opts.hostName)}` : "";
  const ask = opts.formUrl
    ? `please sign attendance here: ${clean(opts.formUrl)}`
    : "i will take notes and send them after";
  const want = register.max_sentences ? Math.max(1, register.max_sentences) : 3;

  const sentences = [
    `hi${who}, i am ${name}, attending for my user.`,
    ask + ".",
    persona.brand.disclosure ? `${persona.brand.disclosure}.` : "",
  ].filter((s) => s !== "");

  let text = clean(sentences.slice(0, want).join(" "));
  let disclosed = sentences.length <= want;

  // the disclosure is the promise that cannot be dropped for length. if the
  // register is tighter than the sentences, it is the ask that goes.
  if (!disclosed) {
    text = clean(`${sentences[0]} ${persona.brand.disclosure}.`);
    disclosed = text.length <= ATTENDANCE_CEILING;
  }
  if (register.emoji === "none") text = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
  if (text.length > ATTENDANCE_CEILING) {
    // a disclosure that got cut is not a disclosure. the line is capped and
    // the receipt says so rather than claiming honesty it did not deliver.
    text = text.slice(0, ATTENDANCE_CEILING - 1).trimEnd() + ".";
    disclosed = false;
  }

  return { text, register: register.register, disclosed };
}

// the closing line, sent once the meeting is over. a receipt, not a summary:
// where the notes are, and what happens next.
export function closureMessage(
  persona: PersonaManifest,
  opts: { recapUrl?: string | null; notesKept?: boolean } = {},
): string {
  const name = persona.display_name;
  const where = opts.recapUrl ? `notes are here: ${clean(opts.recapUrl)}` : "notes are with my user";
  const kept = opts.notesKept === false ? "" : ` thanks for having ${name} in the room.`;
  return clean(`bye for now. ${where}.${kept}`);
}
