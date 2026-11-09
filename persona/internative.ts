// the internative: the whole person, cross platform, under one number.
//
// a surface is a mouth. an internative is the person those mouths belong to. the
// distinction is not decoration: a branch called "music" is not an artist, a
// timeline called "example" is not a personality, and the number that proves which
// person posted is assigned to the internative, once, and never to a surface.
//
// so: one internative, one aipn. every surface it operates publishes under that
// number, and the feed, the feed's clips, the songs and the streams are all the
// same internative showing up in different rooms.

import { SURFACES, type SurfaceName } from "./schema.ts";

export interface Internative {
  // the machine form of the artist name. never a surface name: "music" is somewhere
  // a person posts, not a person.
  id: string;
  // the name a reader sees
  name: string;
  // the immutable number. exactly one, and it is the identity rather than a version.
  aipn: string;
  // everywhere this one internative actually shows up
  surfaces: SurfaceName[];
  // the legal person or entity behind it. a distributor, a store and a tax form all
  // need one, and it is never the internative: an internet native can hold a
  // copyright claim and cannot hold a bank account.
  rights_holder?: string;
  // set when the internative has one home it owns, such as its own feed
  home_surface?: SurfaceName;
}

const AIPN = /^AIPN-\d{6}$/;
const SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export function internativeProblems(internative: Internative): string[] {
  const problems: string[] = [];
  if (!SLUG.test(internative.id ?? "")) problems.push(`id: "${internative.id}" is not a slug`);
  if ((SURFACES as readonly string[]).includes(internative.id ?? "")) {
    problems.push(`id: "${internative.id}" is a surface, and a surface is not a person`);
  }
  if (!internative.name?.trim()) problems.push("name: an internative has a name a reader can say out loud");
  if (!AIPN.test(internative.aipn ?? "")) {
    problems.push(`aipn: "${internative.aipn}" is not an aipn. one internative, one number, assigned once`);
  }
  const surfaces = internative.surfaces ?? [];
  if (surfaces.length === 0) problems.push("surfaces: an internative with no surface exists only in a document");
  const seen = new Set<string>();
  for (const surface of surfaces) {
    if (!(SURFACES as readonly string[]).includes(surface)) problems.push(`surfaces: "${surface}" is not a surface this head knows`);
    if (seen.has(surface)) problems.push(`surfaces: "${surface}" listed twice, and one mouth is one mouth`);
    seen.add(surface);
  }
  if (internative.home_surface && !seen.has(internative.home_surface)) {
    problems.push(`home_surface: "${internative.home_surface}" is not one of its surfaces`);
  }
  return problems;
}

// two internatives cannot share a number, and a number cannot be handed to a second
// person later. this is the check that keeps a registry honest.
export function registryProblems(internatives: Internative[]): string[] {
  const problems: string[] = [];
  const numbers = new Map<string, string>();
  const ids = new Map<string, string>();
  for (const internative of internatives) {
    problems.push(...internativeProblems(internative).map((p) => `${internative.id}: ${p}`));
    const previousNumber = numbers.get(internative.aipn);
    if (previousNumber && previousNumber !== internative.id) {
      problems.push(`aipn: ${internative.aipn} is claimed by ${previousNumber} and by ${internative.id}`);
    }
    numbers.set(internative.aipn, internative.id);
    if (ids.has(internative.id)) problems.push(`id: ${internative.id} is registered twice`);
    ids.set(internative.id, internative.aipn);
  }
  return problems;
}

// what a surface branch may say about the person it belongs to. deliberately thin:
// identity comes from the head, and a branch quoting more than this is inventing.
export function internativeLine(internative: Internative): string {
  const rooms = (internative.surfaces ?? []).join(", ");
  return `${internative.name} (${internative.aipn}) shows up on ${rooms}.`;
}

// the artist identity a release carries. stores take an artist name and a rights
// holder and treat them as different things, because they are.
export interface ArtistIdentity {
  artist_name: string;
  rights_holder: string;
  aipn: string;
}

export function artistIdentity(internative: Internative): { identity?: ArtistIdentity; problems: string[] } {
  const problems: string[] = [];
  const holder = internative.rights_holder?.trim();
  if (!holder) {
    problems.push(
      `${internative.id}: a release needs a rights_holder, and it is the human or entity behind the internative rather than the internative`,
    );
  }
  if (!(internative.surfaces ?? []).includes("music")) {
    problems.push(`${internative.id}: does not operate the music surface, so there is no artist identity to give`);
  }
  if (problems.length) return { problems };
  return { problems: [], identity: { artist_name: internative.name, rights_holder: holder as string, aipn: internative.aipn } };
}
