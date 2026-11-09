// print the persona x surface x platform matrix as markdown.
//
// this is the doc that answers "is this one personality or seven
// products sharing a logo". it is generated from the manifest, so it
// cannot drift from the config. run: deno task matrix

import { listPersonas, loadPersonaFile, personaDir } from "../persona/loader.ts";
import { resolveRegister, SURFACE_MEDIUM } from "../persona/registers.ts";
import { SURFACE_BRANCH } from "../core/surface.ts";
import { publishingDecision } from "../core/publishing.ts";
import { voiceStyleForSurface } from "../persona/voice_adapter.ts";

const dir = personaDir().replace(/\/+$/, "");

for (const summary of await listPersonas(dir)) {
  const persona = await loadPersonaFile(`${dir}/${summary.id}.persona.jsonc`);
  console.log(`### ${persona.display_name} (${persona.id})`);
  console.log("");
  console.log(persona.one_liner);
  console.log("");
  console.log(`publishing: ${publishingDecision(persona).describe()}`);
  console.log("");
  console.log("| surface | branch | medium | register | voice |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const surface of persona.surfaces) {
    const r = resolveRegister(persona, surface);
    const voice = voiceStyleForSurface(persona, surface);
    const cue = [voice.emotion, voice.style, ...(voice.prosody ?? [])].filter(Boolean).join(", ") || "none";
    console.log(
      `| ${surface} | \`${SURFACE_BRANCH[surface]}\` | ${SURFACE_MEDIUM[surface]} | ${r.register} | ${cue} |`,
    );
  }
  console.log("");
  console.log("per platform overrides:");
  console.log("");
  for (const [platform, override] of Object.entries(persona.voice.register_by_platform ?? {})) {
    const merged = resolveRegister(persona, "text", platform);
    const changed = Object.keys(override).join(", ");
    console.log(`- ${platform}: ${changed} (max chars ${merged.max_chars ?? "default"})`);
  }
  console.log("");
}
