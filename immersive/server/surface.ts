// the streaming surface, wired to the head.
//
// what this branch adds to the ported bridge is the part a personality
// needs: a register for the room, a presence that knows what it is promising
// at each moment, and one call that puts the persona live on a named
// destination. what it deliberately does not do is read or answer the
// platform's chat: that is the watch side, and it is not claimed here.

import { defineSurface, type Surface } from "../../core/surface.ts";
import type { PersonaManifest } from "../../persona/schema.ts";
import type { ObsBridge } from "../integrations/obs.ts";
import { Presence, type PresencePlan, type PresenceSession, type PresenceState } from "./presence.ts";
import { DESTINATIONS, pointObsAt, readyDestination, readyDestinations, type Destination } from "./destinations.ts";

export function streamingSurface(persona: PersonaManifest, platform = "twitch"): Surface {
  return defineSurface("streaming", { persona, platform });
}

export interface GoLiveOptions {
  destination: Destination;
  scene?: string;
  cameraSource?: string;
}

export interface GoLiveResult {
  destination: Destination;
  plans: PresencePlan[];
  receipt: string;
}

// the smallest honest path to live: point obs at a configured destination,
// walk the presence machine forward, and hand back a receipt. no publish, no
// posting, no platform account touched beyond obs's own stream key.
export async function goLive(
  bridge: ObsBridge,
  presence: Presence,
  opts: GoLiveOptions,
): Promise<GoLiveResult> {
  const ready = readyDestination(opts.destination);
  if (!ready) {
    throw new Error(`streaming: ${opts.destination} is not configured (see integrations/readme.md)`);
  }
  await pointObsAt(bridge, opts.destination);
  const plans = [await presence.to("starting"), await presence.to("live")];
  return {
    destination: opts.destination,
    plans,
    receipt: `live on ${ready.destination} -> ${ready.target.server}`,
  };
}

export function missingCredentials(): Destination[] {
  return DESTINATIONS.filter((d) => readyDestination(d) === null);
}

export { Presence, type PresenceSession, type PresenceState };
