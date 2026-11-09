// the loader: jsonc in, a validated persona manifest out.
//
// a persona is hand-edited configuration, so it is allowed to carry
// comments and trailing commas. it is not allowed to be half-valid: the
// loader either returns a complete manifest or the list of everything
// wrong with it, with the path of each problem. a surface never gets to
// run on a manifest that failed validation.

import {
  DEFAULT_PUBLISHING,
  isSurface,
  MANIFEST_VERSION,
  SURFACES,
  type PersonaManifest,
  type RegisterSpec,
  type SurfaceName,
} from "./schema.ts";
import { crewProblems } from "./crew.ts";
import { checkMediaContract } from "../media/paths.ts";

// strip // and /* */ comments plus trailing commas, leaving string
// content byte-identical. a hand-written manifest may comment anything
// except the inside of a string, same rule as the platform's editors.
export function stripJsonc(src: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  // second pass: drop a comma that is followed only by whitespace and a
  // closing brace or bracket. done outside strings by construction now.
  let cleaned = "";
  let inStr = false;
  for (let j = 0; j < out.length; j++) {
    const ch = out[j];
    if (inStr) {
      cleaned += ch;
      if (ch === "\\") {
        cleaned += out[j + 1] ?? "";
        j += 1;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      cleaned += ch;
      continue;
    }
    if (ch === ",") {
      let k = j + 1;
      while (k < out.length && /\s/.test(out[k])) k += 1;
      if (out[k] === "}" || out[k] === "]") continue;
    }
    cleaned += ch;
  }
  return cleaned;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  manifest?: PersonaManifest;
}

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function isScore(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

function checkRegister(value: unknown, path: string, errors: string[]): void {
  if (!value || typeof value !== "object") {
    errors.push(`${path}: register must be an object`);
    return;
  }
  const r = value as RegisterSpec;
  if (!isNonEmptyString(r.register)) {
    errors.push(`${path}.register: the one sentence describing how the person sounds here is required`);
  }
  if (r.pace !== undefined && !["slow", "measured", "brisk", "quick"].includes(r.pace)) {
    errors.push(`${path}.pace: must be slow, measured, brisk or quick`);
  }
  for (const key of ["energy", "formality"] as const) {
    if (r[key] !== undefined && !isScore(r[key])) errors.push(`${path}.${key}: must be 0..1`);
  }
  if (r.emoji !== undefined && !["none", "sparing", "free"].includes(r.emoji)) {
    errors.push(`${path}.emoji: must be none, sparing or free`);
  }
  if (r.hashtags !== undefined && !["none", "sparing", "free"].includes(r.hashtags)) {
    errors.push(`${path}.hashtags: must be none, sparing or free`);
  }
  for (const key of ["max_chars", "max_sentences"] as const) {
    if (r[key] !== undefined && (!Number.isInteger(r[key]) || (r[key] as number) <= 0)) {
      errors.push(`${path}.${key}: must be a positive integer`);
    }
  }
  for (const key of ["hooks", "cta"] as const) {
    if (r[key] !== undefined && typeof r[key] !== "boolean") errors.push(`${path}.${key}: must be boolean`);
  }
}

// validate an already-parsed object. errors are complete, never
// first-only: fixing a manifest should be one pass, not a dozen.
export function validatePersona(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["manifest: must be a json object"] };
  }
  const m = input as Partial<PersonaManifest>;

  if (!isNonEmptyString(m.id) || !SLUG.test(m.id)) {
    errors.push("id: lowercase slug (letters, digits, dash, underscore) required");
  }
  if (!isNonEmptyString(m.display_name)) errors.push("display_name: required");
  if (!isNonEmptyString(m.one_liner)) errors.push("one_liner: required");

  const brand = m.brand as PersonaManifest["brand"] | undefined;
  if (!brand || typeof brand !== "object") {
    errors.push("brand: required");
  } else {
    if (!isNonEmptyString(brand.positioning)) errors.push("brand.positioning: required");
    if (!isNonEmptyString(brand.promise)) errors.push("brand.promise: required");
    if (!Array.isArray(brand.values) || brand.values.length === 0) {
      errors.push("brand.values: at least one value");
    }
    if (!Array.isArray(brand.never) || brand.never.length === 0) {
      errors.push("brand.never: at least one refusal (a persona with no boundaries is not shippable)");
    }
    if (!isNonEmptyString(brand.disclosure)) errors.push("brand.disclosure: required");
    if (brand.handles && typeof brand.handles === "object") {
      for (const [platform, handle] of Object.entries(brand.handles)) {
        if (handle !== undefined && !isNonEmptyString(handle)) {
          errors.push(`brand.handles.${platform}: must be a non-empty string or omitted`);
        }
      }
    }
  }

  const voice = m.voice as PersonaManifest["voice"] | undefined;
  if (!voice || typeof voice !== "object") {
    errors.push("voice: required");
  } else {
    const tone = voice.tone_defaults;
    if (!tone || typeof tone !== "object") {
      errors.push("voice.tone_defaults: required");
    } else {
      for (const key of ["warmth", "sarcasm_level", "playfulness", "confidence"] as const) {
        if (!isScore(tone[key])) errors.push(`voice.tone_defaults.${key}: must be 0..1`);
      }
    }
    const registers = voice.register_by_surface;
    if (!registers || typeof registers !== "object") {
      errors.push("voice.register_by_surface: required");
    } else {
      for (const surface of SURFACES) {
        if (!(surface in registers)) {
          errors.push(`voice.register_by_surface.${surface}: required for every surface, even unused ones`);
          continue;
        }
        checkRegister((registers as Record<string, unknown>)[surface], `voice.register_by_surface.${surface}`, errors);
      }
      for (const key of Object.keys(registers)) {
        if (!isSurface(key)) errors.push(`voice.register_by_surface.${key}: not a clawbuzz surface`);
      }
    }
    if (voice.register_by_platform && typeof voice.register_by_platform === "object") {
      for (const [platform, override] of Object.entries(voice.register_by_platform)) {
        if (!override || typeof override !== "object") {
          errors.push(`voice.register_by_platform.${platform}: must be an object of register fields`);
        }
      }
    }
  }

  if (!Array.isArray(m.surfaces) || m.surfaces.length === 0) {
    errors.push("surfaces: at least one surface");
  } else {
    const seen = new Set<string>();
    for (const surface of m.surfaces) {
      if (typeof surface !== "string" || !isSurface(surface)) {
        errors.push(`surfaces: unknown surface ${JSON.stringify(surface)}`);
        continue;
      }
      if (seen.has(surface)) errors.push(`surfaces: ${surface} listed twice`);
      seen.add(surface);
    }
  }

  const memory = m.memory;
  if (!memory || typeof memory !== "object" || !isNonEmptyString(memory.persona_id) || !SLUG.test(memory.persona_id)) {
    errors.push("memory.persona_id: lowercase slug required");
  }

  if (m.publishing !== undefined) {
    if (!m.publishing || typeof m.publishing !== "object") {
      errors.push("publishing: must be an object");
    } else {
      if (!["draft", "scheduled", "live"].includes(m.publishing.mode as string)) {
        errors.push("publishing.mode: must be draft, scheduled or live");
      }
      if (typeof m.publishing.requires_owner_approval !== "boolean") {
        errors.push("publishing.requires_owner_approval: must be boolean");
      }
    }
  }

  if (m.manifest_version !== undefined && (!Number.isInteger(m.manifest_version) || (m.manifest_version as number) < 1)) {
    errors.push("manifest_version: positive integer");
  }

  if (errors.length) return { ok: false, errors };

  const manifest: PersonaManifest = {
    ...(m as PersonaManifest),
    manifest_version: m.manifest_version ?? MANIFEST_VERSION,
    publishing: m.publishing ?? { ...DEFAULT_PUBLISHING },
    surfaces: (m.surfaces as SurfaceName[]).slice(),
    cadence: m.cadence ?? {},
  };
  // the crew is validated last: it depends on which surfaces were enabled,
  // so the surface checks must have passed first.
  errors.push(...crewProblems(manifest));
  // and the media contract, because a claimed surface has to say how it gets
  // pictures, and a persona that generates her own stills has to have a look.
  errors.push(...checkMediaContract(manifest.surfaces, manifest.brand?.look));

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], manifest };
}

// parse text into a manifest. throws with the full error list, because a
// broken manifest is a bug in the config, not a runtime condition a
// surface should paper over.
export function parsePersona(src: string): PersonaManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonc(src));
  } catch (err) {
    throw new Error(`persona: not valid jsonc: ${(err as Error).message}`);
  }
  const result = validatePersona(parsed);
  if (!result.ok || !result.manifest) {
    throw new Error(`persona: invalid manifest:\n  ${result.errors.join("\n  ")}`);
  }
  return result.manifest;
}

export async function loadPersonaFile(path: string): Promise<PersonaManifest> {
  return parsePersona(await Deno.readTextFile(path));
}

export function personaDir(): string {
  return Deno.env.get("CLAWBUZZ_PERSONA_DIR") ?? new URL("../personas/", import.meta.url).pathname;
}

// load <dir>/<id>.persona.jsonc. the default persona comes from
// CLAWBUZZ_PERSONA so a surface process never hardcodes whose mouth it is.
export async function loadPersona(id?: string): Promise<PersonaManifest> {
  const wanted = id ?? Deno.env.get("CLAWBUZZ_PERSONA");
  if (!wanted) {
    throw new Error("persona: CLAWBUZZ_PERSONA unset and no id passed; a surface must know whose mouth it is");
  }
  return await loadPersonaFile(`${personaDir().replace(/\/+$/, "")}/${wanted}.persona.jsonc`);
}

export interface PersonaSummary {
  id: string;
  display_name: string;
  surfaces: SurfaceName[];
}

// every persona in the directory, loaded and validated. one broken file
// fails the listing: a partially loadable persona set is worse than a
// loud error.
export async function listPersonas(dir = personaDir()): Promise<PersonaSummary[]> {
  const out: PersonaSummary[] = [];
  const base = dir.replace(/\/+$/, "");
  for await (const entry of Deno.readDir(base)) {
    if (!entry.isFile || !entry.name.endsWith(".persona.jsonc")) continue;
    const manifest = await loadPersonaFile(`${base}/${entry.name}`);
    out.push({ id: manifest.id, display_name: manifest.display_name, surfaces: manifest.surfaces });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
