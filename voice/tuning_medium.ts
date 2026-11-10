// the medium a surface actually speaks into, which is not always the channel.
//
// the distinction matters for coverage: a text post on bluesky and a text message on imessage
// are both "text" to us and are different mediums to yaptel, with different measured data. a
// compiler that only knows the channel will happily drive a room nobody measured, so the
// platform is consulted first and the channel is only the fallback.

import type { SurfaceName } from "../persona/schema.ts";
import type { YaptelProfile } from "./yaptel.ts";
import { coverageFor } from "./yaptel.ts";
import type { Channel, TuningContext } from "./tuning.ts";

// our surfaces, mapped to the mediums yaptel measures. absent keys fall back to the channel.
export const PLATFORM_MEDIUM: Record<string, string> = {
  x: "twitter",
  twitter: "twitter",
  bluesky: "twitter",
  threads: "twitter",
  mastodon: "twitter",
  linkedin: "linkedin",
  instagram: "instagram",
  tiktok: "tiktok",
  discord: "slack_sandbox",
  slack: "slack",
};

export function mediumFor(context: TuningContext, channel: Channel): string {
  if (context.surface === "text" && context.platform) {
    return PLATFORM_MEDIUM[context.platform.toLowerCase()] ?? channel;
  }
  return channel;
}

export interface MediumCoverage {
  medium: string;
  state: "real" | "sandbox" | "absent";
  // what the compiler is allowed to do about it
  verdict: "compile" | "compile_as_preview" | "refuse";
  why: string;
}

export function mediumCoverage(profile: YaptelProfile, context: TuningContext, channel: Channel): MediumCoverage {
  const medium = mediumFor(context, channel);
  const state = coverageFor(profile, medium);
  if (state === "real") {
    return { medium, state, verdict: "compile", why: `measured on ${medium}, so the register carries over` };
  }
  if (state === "sandbox") {
    return {
      medium,
      state,
      verdict: "compile_as_preview",
      why: `only sandbox data for ${medium}, so anything delivered says it is a preview`,
    };
  }
  return {
    medium,
    state,
    verdict: "refuse",
    why: `nothing measured on ${medium}. compiling anyway would present a guess in measured clothes`,
  };
}

export function surfaceHasVoice(surface: SurfaceName, channel: Channel | null): channel is Channel {
  return channel !== null;
}
