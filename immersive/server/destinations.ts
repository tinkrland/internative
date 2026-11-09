// the destinations: twitch, kick and youtube live, treated as one shape.
//
// the whole platform story of this surface is server plus key. what differs
// per platform is only where those two values come from, and that lives in
// integrations/. this file is the roster: which destinations exist, which
// ones this process is actually configured for, and the one call that points
// obs at one of them.

import type { ObsBridge } from "../integrations/obs.ts";
import { kickTargetFromEnv, pointObsAtKick } from "../integrations/kick.ts";
import { pointObsAtTwitch, twitchTarget, type StreamTarget } from "../integrations/twitch.ts";
import { pointObsAtYoutube, youtubeTargetFromEnv } from "../integrations/youtube.ts";
import { env } from "../integrations/env.ts";

export const DESTINATIONS = ["twitch", "kick", "youtube"] as const;
export type Destination = (typeof DESTINATIONS)[number];

export interface ReadyDestination {
  destination: Destination;
  target: StreamTarget;
}

// a destination is ready only when its credentials are in the environment.
// youtube live and kick both hand out account specific url plus key, so
// nothing here can be hardcoded to make one "just work".
export function readyDestination(destination: Destination): ReadyDestination | null {
  if (destination === "twitch") {
    const key = env("CLAWBUZZ_TWITCH_STREAM_KEY", "TWITCH_STREAM_KEY");
    return key ? { destination, target: twitchTarget(key) } : null;
  }
  if (destination === "kick") {
    const target = kickTargetFromEnv();
    return target ? { destination, target } : null;
  }
  const target = youtubeTargetFromEnv();
  return target ? { destination, target } : null;
}

export function readyDestinations(): Destination[] {
  return DESTINATIONS.filter((d) => readyDestination(d) !== null);
}

export async function pointObsAt(bridge: ObsBridge, destination: Destination): Promise<ReadyDestination> {
  const ready = readyDestination(destination);
  if (!ready) {
    throw new Error(`destination ${destination}: no credentials in the environment`);
  }
  if (destination === "twitch") {
    await pointObsAtTwitch(bridge, ready.target.key);
  } else if (destination === "kick") {
    await pointObsAtKick(bridge, ready.target);
  } else {
    await pointObsAtYoutube(bridge, ready.target);
  }
  return ready;
}

// the key is a credential: this is the shape a log or a receipt may carry.
export function describeDestination(ready: ReadyDestination): string {
  return `${ready.destination} -> ${ready.target.server} (key held, ${ready.target.key.length} chars)`;
}

export { youtubeTargetFromEnv };
