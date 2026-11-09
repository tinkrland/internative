// the video adapters: build the parts separately, then let an open model
// combine them.
//
// the shape of the work, from what practitioners actually do in 2026: a
// character reference, two or three plates of a place, and a prompt that names
// the axes. the model is handed the parts and composes; it is never asked to
// invent a room or a face. that is why the pieces are authored first
// (wardrobe, places) and only then combined here.
//
// an adapter is a description, not a client: which references it takes, under
// which field name, how many, and what evidence the description rests on.
// nothing in this file calls a model.
//
// the field name is the part that breaks. reference_images,
// reference_image_urls, reference_urls and image_urls all mean "the pictures
// of her" to a person and different things to a server, and a schema rejects
// the wrong one. so each adapter names the field its endpoint validates, and
// says whether that came from documentation or from a guess.

import type { ShotPlan } from "../persona/shot.ts";
import { placeReferencePlates } from "../persona/places.ts";

export const SOURCE_EVOLINK_SEEDANCE = "https://evolink.ai/docs/cn/api-manual/video-series/seedance2.0/seedance-2.0-reference-to-video";
export const SOURCE_REFERENCE_CAPS = "https://pixeldojo.ai/ai-video-models-that-accept-reference-images";

export type ReferenceRole = "character" | "place_wide" | "place_mirror" | "place_detail" | "keyframe";

export interface Reference {
  role: ReferenceRole;
  uri: string;
  note?: string;
}

export interface Adapter {
  id: string;
  name: string;
  kind: "reference-to-video" | "image-to-video" | "image";
  licence: string;
  accepts: ReferenceRole[];
  max_references: number;
  // the json field the endpoint validates for the reference images
  reference_field: string;
  // documented = read from the endpoint's own description; assumed = inferred
  evidence: "documented" | "assumed";
  // api-doc = the provider's own API reference; catalog = an aggregator page
  // describing many models, which is one step further from the schema
  source_kind: "api-doc" | "catalog";
  source?: string;
  // who serves it: the field names belong to this surface, not to the model
  provider: string;
  endpoint?: string;
  model?: string;
  // the provider accepts @image1 style tags in the prompt to bind a reference
  prompt_tags: boolean;
  // a request is rejected unless at least one of these arrays is present
  requires_one_of?: string[];
  // rules the request has to respect beyond the count, in plain words
  constraints: string[];
  notes: string;
  // false = the capability is described from reading, not from running it here
  verified: boolean;
}

export const ADAPTERS: Adapter[] = [
  {
    id: "wan-reference-to-video",
    name: "WAN reference to video",
    kind: "reference-to-video",
    licence: "hosted api, vendor terms",
    accepts: ["character", "place_wide", "place_mirror", "place_detail"],
    max_references: 5,
    reference_field: "reference_urls",
    evidence: "documented",
    source: SOURCE_REFERENCE_CAPS,
    constraints: [
      "the five slots are shared between images and clips, with at most three clips",
      "clips are 5 or 10 seconds; a multi-shot mode composes a sequence across the references",
    ],
    notes: "a face, a set and a room can ride in one call; the prompt addresses a reference by name",
    provider: "Pixel Dojo",
    source_kind: "catalog",
    prompt_tags: true,
    verified: false,
  },
  {
    id: "wan-3-reference",
    name: "WAN 3.0 reference",
    kind: "reference-to-video",
    licence: "hosted api, vendor terms",
    accepts: ["character", "place_wide", "place_mirror", "place_detail"],
    max_references: 10,
    reference_field: "reference_image_urls",
    evidence: "documented",
    source: SOURCE_REFERENCE_CAPS,
    constraints: ["optional reference video and reference audio arrays of up to five each", "the prompt can point at a specific reference"],
    notes: "enough slots for a character plus a place's wide and detail plates",
    provider: "Pixel Dojo",
    source_kind: "catalog",
    prompt_tags: true,
    verified: false,
  },
  {
    id: "seedance-2-reference",
    name: "Seedance 2.0 reference to video (EvoLink)",
    kind: "reference-to-video",
    licence: "hosted api, provider terms",
    accepts: ["character", "place_wide", "place_mirror", "place_detail"],
    max_references: 9,
    reference_field: "image_urls",
    evidence: "documented",
    source_kind: "api-doc",
    source: SOURCE_EVOLINK_SEEDANCE,
    provider: "EvoLink",
    endpoint: "https://api.evolink.ai/v1/videos/generations",
    model: "seedance-2.0-reference-to-video",
    prompt_tags: true,
    requires_one_of: ["image_urls", "video_urls"],
    constraints: [
      "0 to 9 reference images, plus up to 3 reference clips and 3 audio clips",
      "audio alone is rejected: at least one image or one clip is required",
      "the prompt binds a reference with @image1, @video1, @audio1 by array order",
      "duration 4 to 15 seconds, quality 480p to 4k, aspect ratio adaptive by default",
    ],
    notes: "the same model the catalogue called reference_images; this provider's schema calls it image_urls",
    verified: false,
  },
  {
    id: "seedance-2.5-reference",
    name: "Seedance 2.5 reference",
    kind: "reference-to-video",
    licence: "hosted api, vendor terms",
    accepts: ["character", "place_wide", "place_mirror", "place_detail", "keyframe"],
    max_references: 30,
    reference_field: "reference_images",
    evidence: "documented",
    source: SOURCE_REFERENCE_CAPS,
    constraints: ["also takes reference clips and reference audio in the same request", "the prompt can address a reference by name"],
    notes: "closer to a small asset library than a reference: the room's whole plate set fits, wardrobe included",
    provider: "Pixel Dojo",
    source_kind: "catalog",
    prompt_tags: true,
    verified: false,
  },
  {
    id: "kling-reference-to-video",
    name: "Kling reference to video",
    kind: "reference-to-video",
    licence: "hosted api, vendor terms",
    accepts: ["character", "place_wide", "place_mirror"],
    max_references: 4,
    reference_field: "image_urls",
    evidence: "documented",
    source: SOURCE_REFERENCE_CAPS,
    constraints: ["a mode switch picks image references or clip references", "native audio on image references"],
    notes: "a character and two room plates, no more: the tightest useful budget",
    provider: "Pixel Dojo",
    source_kind: "catalog",
    prompt_tags: false,
    verified: false,
  },
  {
    id: "minimax-h3-reference",
    name: "MiniMax H3 reference",
    kind: "reference-to-video",
    licence: "hosted api, vendor terms",
    accepts: ["character", "place_wide", "place_mirror", "place_detail"],
    max_references: 9,
    reference_field: "reference_images",
    evidence: "documented",
    source: SOURCE_REFERENCE_CAPS,
    constraints: ["references and the start and end frame fields are separate modes; pick one per request"],
    notes: "guides subject and scene identity together",
    provider: "Pixel Dojo",
    source_kind: "catalog",
    prompt_tags: false,
    verified: false,
  },
  {
    id: "first-frame-image-to-video",
    name: "single first frame image to video",
    kind: "image-to-video",
    licence: "hosted api, vendor terms",
    accepts: ["keyframe"],
    max_references: 1,
    reference_field: "first_frame_image",
    evidence: "documented",
    source: SOURCE_REFERENCE_CAPS,
    constraints: ["one image, and it is the opening frame rather than a subject reference"],
    notes: "the keyframe is expected to come from a still shot of the same setup, so the axes are decided before motion",
    provider: "Pixel Dojo",
    source_kind: "catalog",
    prompt_tags: false,
    verified: false,
  },
  {
    id: "hunyuan-custom-multi-subject",
    name: "HunyuanCustom multi-subject (self-hosted)",
    kind: "reference-to-video",
    licence: "oss, tencent hunyuan community licence, confirm per release",
    accepts: ["character", "place_wide", "place_detail"],
    max_references: 4,
    reference_field: "assumed: subject_reference images, confirm against the repo's infer call",
    evidence: "assumed",
    constraints: ["runs locally, so the weights and the licence are the operator's problem", "the cli and parameter names were not confirmed against a release here"],
    notes: "the open-weight path: no vendor, no per-clip price, and every unknown is yours",
    provider: "self-hosted",
    source_kind: "catalog",
    prompt_tags: false,
    verified: false,
  },
];

export function adapterForId(id: string): Adapter {
  const adapter = ADAPTERS.find((a) => a.id === id);
  if (!adapter) throw new Error(`generation: no adapter "${id}" (have: ${ADAPTERS.map((a) => a.id).join(", ")})`);
  return adapter;
}

// the references a shot needs: her, then the room. a place plate is attached by
// role so the adapter can weight the wide view above the corner of the sink.
export function referencesForShot(
  shot: ShotPlan,
  opts: { characterImage?: string; keyframe?: string } = {},
): Reference[] {
  const refs: Reference[] = [];
  if (opts.characterImage) refs.push({ role: "character", uri: opts.characterImage, note: "identity reference" });
  for (const plate of placeReferencePlates(shot.place)) {
    refs.push({
      role: plate.role === "wide" ? "place_wide" : plate.role === "mirror" ? "place_mirror" : "place_detail",
      uri: plate.uri,
      note: `${shot.place.id} ${plate.id}`,
    });
  }
  if (opts.keyframe) refs.push({ role: "keyframe", uri: opts.keyframe, note: "first frame" });
  return refs;
}

export function checkReferences(adapter: Adapter, refs: Reference[]): string[] {
  const problems: string[] = [];
  for (const ref of refs) {
    if (!adapter.accepts.includes(ref.role)) {
      problems.push(`${adapter.id}: does not take a ${ref.role} reference`);
    }
    if (!ref.uri?.trim()) problems.push(`${adapter.id}: ${ref.role} reference has no uri`);
  }
  if (refs.length > adapter.max_references) {
    problems.push(`${adapter.id}: ${refs.length} references, ceiling is ${adapter.max_references}`);
  }
  if (adapter.accepts.includes("character") && !refs.some((r) => r.role === "character")) {
    problems.push(`${adapter.id}: no character reference, which is the point of the shot`);
  }
  if (adapter.kind === "image-to-video" && !refs.some((r) => r.role === "keyframe")) {
    problems.push(`${adapter.id}: image-to-video needs a keyframe`);
  }
  return problems;
}

export interface GenerationPlan {
  adapter: Adapter;
  references: Reference[];
  prompt: string;
  seed: number;
}

export function planGeneration(
  shot: ShotPlan,
  adapterId: string,
  opts: { characterImage?: string; keyframe?: string } = {},
): GenerationPlan {
  const adapter = adapterForId(adapterId);
  const references = referencesForShot(shot, opts);
  const problems = checkReferences(adapter, references);
  if (problems.length) throw new Error(`generation: ${problems.join("; ")}`);
  return { adapter, references, prompt: shot.prompt, seed: shot.seed };
}

// the request body, built from the description rather than from memory.
//
// the field name is the adapter's, because the field belongs to the surface
// that validates it, not to the model inside it. two providers serving the same
// weights disagree about it, and one of them will reject the other's name.
export interface GenerationRequest {
  adapter: string;
  provider: string;
  endpoint?: string;
  model?: string;
  body: Record<string, unknown>;
}

export interface RequestOptions {
  duration?: number;
  quality?: string;
  aspect_ratio?: string;
}

export function buildRequest(adapter: Adapter, plan: GenerationPlan, opts: RequestOptions = {}): GenerationRequest {
  const body: Record<string, unknown> = {};
  if (adapter.model) body.model = adapter.model;

  let prompt = plan.prompt;
  let uris: string[] = [];

  if (adapter.kind === "image-to-video") {
    const keyframe = plan.references.find((r) => r.role === "keyframe");
    if (!keyframe) throw new Error(`generation: ${adapter.id} needs a keyframe and none was planned`);
    uris = [keyframe.uri];
  } else {
    uris = plan.references.map((r) => r.uri);
    if (adapter.prompt_tags) {
      // a provider that binds references by tag gets the binding, so the
      // character is not left to be guessed from array order
      const lines = plan.references.map((r, i) => `@image${i + 1} is the ${r.role.replace("_", " ")}${r.note ? ` (${r.note})` : ""}`);
      prompt = `${plan.prompt}\nreferences: ${lines.join("; ")}`;
    }
  }

  body.prompt = prompt;
  // an image-to-video surface takes one url in a scalar field; a reference
  // surface takes an array. same idea, different shape, and the schema knows.
  body[adapter.reference_field] = adapter.kind === "image-to-video" ? uris[0] : uris;

  const present = () => {
    const value = body[adapter.reference_field];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  };
  if (adapter.requires_one_of && !adapter.requires_one_of.slice(1).some((f) => f in body) && !present()) {
    throw new Error(`generation: ${adapter.id} needs one of ${adapter.requires_one_of.join(", ")}`);
  }
  if (opts.duration !== undefined) body.duration = opts.duration;
  if (opts.quality !== undefined) body.quality = opts.quality;
  if (opts.aspect_ratio !== undefined) body.aspect_ratio = opts.aspect_ratio;

  return { adapter: adapter.id, provider: adapter.provider, endpoint: adapter.endpoint, model: adapter.model, body };
}
