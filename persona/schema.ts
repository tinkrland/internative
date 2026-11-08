// the persona manifest: the shape of a clawbuzz persona as CONFIGURATION.
//
// the point of this file is that a persona is data, not code. one jsonc
// file describes who the personality is, how it sounds on each of its
// surfaces, what it refuses to do, and which of its accounts exist.
// every surface branch reads the same manifest through the same loader,
// so "the same person everywhere" is a property of the format, not a
// promise kept by seven separate codebases.
//
// a manifest never carries real handles or secrets: handles are public
// identity (they are the persona's own accounts), secrets stay in env.

// the surfaces a clawbuzz persona can speak on. one branch each, one
// register each. adding a surface is adding a value here plus a
// register in every manifest, which is the point: a persona cannot ship
// with a surface it has not decided how to sound on.
export const SURFACES = [
  "meetings",
  "streaming",
  "shortform",
  "longform",
  "audio",
  "music",
  "static",
  "text",
] as const;

export type SurfaceName = (typeof SURFACES)[number];

export function isSurface(value: string): value is SurfaceName {
  return (SURFACES as readonly string[]).includes(value);
}

// tone is fuzzy on purpose (0..1), because it is the persona's own
// description of itself and not a tts's cue vocabulary. the single
// translation to named cues lives in voice_adapter.ts.
export interface ToneDefaults {
  warmth: number;
  sarcasm_level: number;
  playfulness: number;
  confidence: number;
}

// a register is how the same person sounds in one room. the structured
// knobs are the ones generators actually obey (length, energy, hooks);
// `register` is the human sentence a model reads first.
export interface RegisterSpec {
  register: string;
  pace?: "slow" | "measured" | "brisk" | "quick";
  energy?: number;
  formality?: number;
  lines?: string;
  hooks?: boolean;
  cta?: boolean;
  emoji?: "none" | "sparing" | "free";
  hashtags?: "none" | "sparing" | "free";
  max_chars?: number;
  max_sentences?: number;
  notes?: string;
}

export interface BrandHandles {
  // public handles per platform. the persona's own accounts only; a
  // person it talks to is a connection (core/connections.ts), never a
  // handle in the manifest.
  [platform: string]: string | undefined;
}

export interface Brand {
  positioning: string;
  promise: string;
  values: string[];
  // the never list is required and must not be empty: a personality
  // with no refusals is not shippable, it is a liability.
  never: string[];
  disclosure: string;
  handles?: BrandHandles;
  // optional one-line description of the look, so surfaces that render
  // (static, shortform, streaming) pull the same art direction.
  look?: string;
}

export interface Publishing {
  // draft: everything renders and stops. scheduled: the owner has
  // approved a queue. live: the persona may publish on its own.
  mode: "draft" | "scheduled" | "live";
  // even in live mode, this stays true unless the owner turns it off
  // per persona. it is the guard rail, not a preference.
  requires_owner_approval: boolean;
}

export interface PersonaVoice {
  tone_defaults: ToneDefaults;
  register_by_surface: Record<SurfaceName, RegisterSpec>;
  // optional per-platform overrides on top of a surface register (the
  // text surface speaks on five networks with different manners).
  register_by_platform?: Record<string, Partial<RegisterSpec>>;
  languages?: string[];
  lexica?: {
    fillers?: string[];
    hedges?: string[];
    idiom_preferences?: string[];
  };
}

export interface PersonaMemory {
  // the retelldb persona id. the memory graph is per persona plus one
  // shared graph, so two clawbuzz personas never bleed into each other.
  persona_id: string;
  // how much of the shared graph this persona may read. "all" is the
  // default; "own" keeps it isolated.
  shared?: "all" | "own";
}

export interface Cadence {
  // optional, free-form and honest: "two streams a week", "daily text".
  // a schedule generator reads it; it is never a promise to the viewer.
  [surface: string]: string | undefined;
}

export interface PersonaManifest {
  id: string;
  display_name: string;
  one_liner: string;
  brand: Brand;
  voice: PersonaVoice;
  memory: PersonaMemory;
  surfaces: SurfaceName[];
  // the crew: one operator per vertical. the persona is one identity, but the
  // agent handling a podcast is not the agent handling a meeting. a crew
  // member adds a specialisation on top of the shared identity; it can never
  // replace it.
  crew?: Partial<Record<SurfaceName, CrewMember>>;
  publishing?: Publishing;
  cadence?: Cadence;
  // schema version, so a manifest written today is still loadable when
  // the format grows. bump on breaking change only.
  manifest_version?: number;
}

export interface CrewMember {
  // what this operator is for, in one line
  role: string;
  // the niche it is actually good at: the things it reads, watches and
  // practises when nobody is asking it for anything
  focus: string[];
  // named playbooks and tools this operator is trusted with. the surface
  // branch owns the code; this is the allowance list.
  skills?: string[];
  // what it may do alone, and what it climbs the ladder for
  autonomy?: string;
  // a delivery register override, when this vertical has a house style the
  // surface register does not capture
  register_notes?: string;
  // where its taste comes from: the corpus it is tuned against. declared,
  // because an operator with no sources is a vibe.
  trains_on?: string[];
  // when this operator must hand back to the owner, even when its autonomy
  // would allow it to continue
  escalate_to_owner?: string[];
}

export const MANIFEST_VERSION = 1;

export const DEFAULT_PUBLISHING: Publishing = {
  mode: "draft",
  requires_owner_approval: true,
};
