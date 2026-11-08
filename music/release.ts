// where a song goes, and what a release has to carry before it goes there.

import { type Rights, rightsProblems } from "./lyrics.ts";
import { masterProblems, type MasterSpec } from "./master.ts";

export interface Release {
  title: string;
  aipn: string;
  targets: string[];
  rights: Rights;
  master: MasterSpec;
  cover_handoff: string;
  explicit: boolean;
  // an ai personality releasing music has a disclosure obligation in more than one
  // store. it costs one line and it is not a mood.
  ai_disclosure: string;
}

export const TARGETS = ["spotify", "apple-music", "bandcamp", "youtube-music"];

export function releaseProblems(release: Release): string[] {
  const problems: string[] = [];
  if (!/^AIPN-\d{6}$/.test(release.aipn ?? "")) problems.push("aipn: a release is published under an aipn");
  if (!release.targets?.length) problems.push("targets: a release with no destination is a file");
  for (const target of release.targets ?? []) {
    if (!TARGETS.includes(target)) problems.push(`targets: "${target}" is not a destination this branch knows`);
  }
  problems.push(...rightsProblems(release.rights));
  problems.push(...masterProblems(release.master));
  if (!release.cover_handoff?.trim()) problems.push("cover_handoff: the cover is static's job and the handoff has to say what it is");
  if (!release.ai_disclosure?.trim()) problems.push("ai_disclosure: the store wants to know, and so does the listener");
  if (/^\s*$/.test(release.title ?? "")) problems.push("title: required");
  return problems;
}

// a release that cannot name its person, its rights or its disclosure does not ship.
export function canShip(release: Release): boolean {
  return releaseProblems(release).length === 0;
}
