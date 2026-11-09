// the meetings surface, wired to the head.
//
// the engine has three jobs: get into the room, take the notes, and say who
// it is while doing both. the head supplies the third, and this file is where
// the engine's meeting rows get turned into a scope the memory rules can
// enforce.

import { defineSurface, type Surface } from "../../core/surface.ts";
import type { PersonaManifest } from "../../persona/schema.ts";
import { currentPersona } from "./persona.ts";
import { meetingIdentity, type MeetingIdentity } from "./services/meeting_identity.ts";
import type { Connection } from "../../core/connections.ts";

export function meetingsSurface(
  persona: PersonaManifest,
  platform = "zoom",
  connections?: Connection[],
): Surface {
  return defineSurface("meetings", { persona, platform, connections });
}

// a deploy reads its persona from CLAWBUZZ_PERSONA. no persona, no mouth:
// the engine can still schedule, it just cannot speak in the first person.
export async function currentMeetingsSurface(
  platform = "zoom",
  personaId?: string,
  connections?: Connection[],
): Promise<Surface> {
  const persona = personaId ? await (await import("../../persona/loader.ts")).loadPersona(personaId) : await currentPersona();
  if (!persona) {
    throw new Error("meetings: CLAWBUZZ_PERSONA is unset, so there is no persona to attend as");
  }
  return meetingsSurface(persona, platform, connections);
}

// who is in the room, from the only real handle a meeting row carries.
export function attendeeIdentity(
  meeting: { platform?: string | null; zoom_user_email?: string | null; host_name?: string | null },
  connections?: Connection[],
): MeetingIdentity {
  return meetingIdentity(meeting, connections);
}
