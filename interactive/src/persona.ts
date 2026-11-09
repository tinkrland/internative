// the meeting engine asking the head whose mouth it is.
//
// a surface process declares the persona through CLAWBUZZ_PERSONA. when it
// is unset the engine still runs (a scheduler with no persona is a useful
// test rig), but anything that speaks in the first person refuses to
// pretend: see attendanceMessage's caller.

import { loadPersona } from "../../persona/loader.ts";
import type { PersonaManifest } from "../../persona/schema.ts";

let cached: PersonaManifest | null = null;

export async function currentPersona(): Promise<PersonaManifest | null> {
  if (cached) return cached;
  const id = Deno.env.get("CLAWBUZZ_PERSONA");
  if (!id) return null;
  try {
    cached = await loadPersona(id);
    return cached;
  } catch (err) {
    console.warn(`clawbuzz: persona ${id} did not load: ${(err as Error).message}`);
    return null;
  }
}

export function forgetPersona(): void {
  cached = null;
}
