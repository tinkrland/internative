// run a planned frame against a real endpoint, and write down what happened.
//
// without --live this prints the request and sends nothing: the plumbing is
// worth checking on its own, and a dry run is not an observation. with --live it
// needs the provider's key in the environment under the name that provider
// documents, posts the body buildRequest produced, and records the status in the
// ledger so the adapter stops calling itself unproven.

import { loadPersonaFile } from "../persona/loader.ts";
import { loadPlaces, loadWardrobe } from "../tools/libraries.ts";
import { planShot } from "../persona/shot.ts";
import { adapterForId, buildRequest, planGeneration } from "../generation/adapters.ts";
import { accepted, recordObservation } from "../generation/observations.ts";

// one env name per surface. the key is read here and never printed.
export const PROVIDER_KEYS: Record<string, string> = {
  EvoLink: "EVOLINK_API_KEY",
  "Pixel Dojo": "PIXELDOJO_API_KEY",
};

export function keyNameFor(provider: string): string | undefined {
  return PROVIDER_KEYS[provider];
}

interface Args {
  adapter: string;
  persona: string;
  place?: string;
  outfit?: string;
  composition?: string;
  magnification?: string;
  day?: string;
  character?: string;
  keyframe?: string;
  duration?: number;
  quality?: string;
  aspect?: string;
  live: boolean;
}

function parse(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const adapter = get("--adapter");
  const persona = get("--persona") ?? "example";
  if (!adapter) throw new Error('usage: run-frame --adapter <id> [--persona example] [--place id] [--outfit id] [--day yyyy-mm-dd] [--character path] [--keyframe path] [--live]');
  const duration = get("--duration");
  return {
    adapter,
    persona,
    place: get("--place"),
    outfit: get("--outfit"),
    composition: get("--composition"),
    magnification: get("--magnification"),
    day: get("--day"),
    character: get("--character"),
    keyframe: get("--keyframe"),
    duration: duration === undefined ? undefined : Number(duration),
    quality: get("--quality"),
    aspect: get("--aspect"),
    live: argv.includes("--live"),
  };
}

if (import.meta.main) {
  const args = parse(Deno.args);
  const persona = await loadPersonaFile(`personas/${args.persona}.persona.jsonc`);
  const libs = { wardrobe: await loadWardrobe(args.persona), places: await loadPlaces(args.persona) };
  const shot = planShot(persona, libs, {
    place_id: args.place ?? libs.places.places[0].id,
    outfit_id: args.outfit ?? libs.wardrobe.default_outfit ?? libs.wardrobe.outfits[0].id,
    day: args.day ?? "2026-11-07",
    composition: args.composition ?? "waist up, facing the mirror, phone at chest height",
    magnification: args.magnification ?? "medium, one person, the room readable behind her",
  });
  const plan = planGeneration(shot, args.adapter, { characterImage: args.character, keyframe: args.keyframe });
  const request = buildRequest(plan.adapter, plan, { duration: args.duration, quality: args.quality, aspect_ratio: args.aspect });

  console.log(`${request.adapter} via ${request.provider}${request.model ? ` (${request.model})` : ""}`);
  console.log(JSON.stringify(request.body, null, 2));

  if (!args.live) {
    console.log("\ndry run: nothing was sent, and nothing is recorded as observed");
    Deno.exit(0);
  }
  if (!request.endpoint) throw new Error(`${request.adapter} names no endpoint, so there is nowhere to send it`);

  const envName = keyNameFor(request.provider);
  const key = envName ? Deno.env.get(envName) : undefined;
  if (!envName || !key) throw new Error(`no key for ${request.provider}: set ${envName ?? "a documented env name"} before running live`);

  const started = performance.now();
  const response = await fetch(request.endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(request.body),
  });
  const text = await response.text();
  const ms = Math.round(performance.now() - started);
  console.log(`\n${response.status} in ${ms}ms`);
  console.log(text.slice(0, 2000));

  if (accepted(response.status)) {
    const path = recordObservation({
      adapter: request.adapter,
      observed_at: new Date().toISOString(),
      status: response.status,
      endpoint: request.endpoint,
      model: request.model,
      note: `first accepted request, ${ms}ms`,
    });
    console.log(`\nrecorded: ${path}`);
  } else {
    console.log("\nnot recorded: the endpoint did not accept the request");
    Deno.exit(1);
  }
}
