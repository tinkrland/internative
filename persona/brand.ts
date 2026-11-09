// brand: the part of the persona that must not drift between surfaces.
//
// identity is cheap to restate and expensive to restate inconsistently.
// seven surfaces each writing their own system prompt is how a persona
// ends up sounding like seven contractors wearing one name. so the
// brief is generated here, once, from the manifest, and every surface
// feeds the same brief to whatever writes or speaks for it.
//
// the brief is text on purpose: it is the one artifact that works for an
// llm prompt, a human reviewing a draft, and a test asserting that a
// surface did not quietly drop the never list.

import type { PersonaManifest, SurfaceName } from "./schema.ts";
import { registerFor, resolveRegister, SURFACE_MEDIUM } from "./registers.ts";
import { voiceStyleForSurface, type VoiceStyle } from "./voice_adapter.ts";

export interface BriefOptions {
  surface: SurfaceName;
  // the network or destination inside the surface (x, bluesky, tiktok,
  // spotify, zoom, twitch...). overrides the surface register when the
  // persona defines one.
  platform?: string;
}

export interface BrandCheck {
  ok: boolean;
  warnings: string[];
}

// invariants a persona must satisfy to be publishable at all. the loader
// enforces presence; this checks the things presence does not catch: a
// disclosure that actually discloses, a never list with substance, and
// no identity value left as a placeholder.
export function checkBrand(persona: PersonaManifest): BrandCheck {
  const warnings: string[] = [];
  const disclosure = persona.brand.disclosure.trim();
  if (disclosure.length < 12) {
    warnings.push("brand.disclosure is too short to actually disclose anything");
  }
  if (!/ai|agent|automated|synthetic|not a human|software/i.test(disclosure)) {
    warnings.push("brand.disclosure should say what the persona is (ai, agent, automated), not just that it is honest");
  }
  for (const item of persona.brand.never) {
    if (item.trim().length < 6) warnings.push(`brand.never: "${item}" is too vague to enforce`);
  }
  if (persona.brand.never.some((n) => /impersonat/i.test(n)) === false) {
    warnings.push("brand.never does not mention impersonation; a personality with a face and a voice should");
  }
  if (persona.publishing?.mode === "live" && persona.publishing.requires_owner_approval) {
    warnings.push("publishing.mode is live but owner approval is still required; one of the two is a lie");
  }
  for (const surface of persona.surfaces) {
    const r = registerFor(persona, surface);
    if (r.register.split(/\s+/).length < 4) {
      warnings.push(`voice.register_by_surface.${surface}: one or two words is not a register`);
    }
  }
  return { ok: warnings.length === 0, warnings };
}

// the brief. deterministic, self-contained, and short enough to sit at
// the top of a prompt without crowding out the actual task.
export function personaBrief(persona: PersonaManifest, opts: BriefOptions): string {
  const r = resolveRegister(persona, opts.surface, opts.platform);
  const platform = (opts.platform ?? "").trim().toLowerCase();
  const tone = persona.voice.tone_defaults;
  const lines: string[] = [];

  lines.push("# who you are");
  lines.push(`${persona.display_name}: ${persona.one_liner}`);
  lines.push(`positioning: ${persona.brand.positioning}`);
  lines.push(`promise: ${persona.brand.promise}`);
  lines.push(`values: ${persona.brand.values.join("; ")}`);
  if (persona.brand.look) lines.push(`look: ${persona.brand.look}`);

  lines.push("");
  lines.push("# where you are");
  lines.push(`surface: ${opts.surface} (${SURFACE_MEDIUM[opts.surface]})`);
  if (platform) lines.push(`platform: ${platform}`);
  lines.push(`register: ${r.register}`);

  lines.push("");
  lines.push("# how you sound");
  lines.push(
    `tone: warmth ${tone.warmth}, sarcasm ${tone.sarcasm_level}, playfulness ${tone.playfulness}, confidence ${tone.confidence}`,
  );
  lines.push(`pace: ${r.pace}; energy ${r.energy}; formality ${r.formality}`);
  if (r.lines) lines.push(`lines: ${r.lines}`);
  lines.push(`hooks: ${r.hooks ? "open with one" : "no hook, go straight in"}`);
  lines.push(`call to action: ${r.cta ? "allowed, one at most" : "none"}`);
  lines.push(`emoji: ${r.emoji}; hashtags: ${r.hashtags}`);
  if (r.max_chars) lines.push(`length: up to ${r.max_chars} characters`);
  if (r.max_sentences) lines.push(`sentences: up to ${r.max_sentences}`);
  if (r.notes) lines.push(`notes: ${r.notes}`);
  if (persona.voice.languages?.length) {
    lines.push(`languages: ${persona.voice.languages.join(", ")}`);
  }
  if (persona.voice.lexica?.fillers?.length) {
    lines.push(`fillers you actually use: ${persona.voice.lexica.fillers.join(", ")}`);
  }

  lines.push("");
  lines.push("# what you never do");
  for (const item of persona.brand.never) lines.push(`- ${item}`);

  lines.push("");
  lines.push("# disclosure");
  lines.push(persona.brand.disclosure);

  const pub = persona.publishing ?? { mode: "draft", requires_owner_approval: true };
  lines.push("");
  lines.push("# publishing");
  lines.push(
    `mode: ${pub.mode}${pub.requires_owner_approval ? "; every artifact stops for owner approval" : "; may go out without review"}`,
  );

  return lines.join("\n");
}

export function voiceFor(persona: PersonaManifest, surface: SurfaceName): VoiceStyle {
  return voiceStyleForSurface(persona, surface);
}

// a one-line identity handle for logs, receipts and dashboards, so a
// surface can say whose mouth spoke without echoing the whole manifest.
export function brandLine(persona: PersonaManifest): string {
  return `${persona.display_name} (${persona.id}) · ${persona.one_liner}`;
}
