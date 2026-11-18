# internative

one person, built as configuration, carried by a surface per platform.

an **internative** is an autonomous online identity: a coherent personality with its own
visual presentation, creative output, social presence and cross-platform capability, all
of it recognisably the same person on every surface it appears on.

the defining characteristic is not any one of those parts. it is the combination of
**autonomy** and **identity continuity**. an internative does not merely generate
individual pieces of content, a caption here and a clip there. it maintains an ongoing
presence as a recognizable digital creator: the same name, the same promise, the same
refusals, the same face, the same voice, the same taste, next month as next Tuesday,
whether it is singing, sitting in a meeting, or posting a still.

this repository is that person as configuration and contract. `main` is the head: who she
is, what she will not do, how she sounds, what she knows. each other branch is a room she
shows up in. a surface is never the person, and a platform is never the personality.

```
main        the head: identity, brand, registers, crew, wardrobe, places, aipn
  likeness  the body: how she looks and how she sounds
  live      presence while something happens: meetings, and the live frame
  socmed    the feed: what she posts into places she does not own
  content   what she makes: episodes, verticals, podcasts
  music     songs
  research  questions with sources, before they become code
  revenue   numbers with receipts, kept apart from the product questions
```

## the one rule

**the mouth never redraws the face.**

a surface branch never edits `persona/`, `core/`, `memory/`, `knowledge/`, `interests/` or
`access/`. it syncs them from main with `tools/sync-context.sh` and gets a byte-identical
copy. a surface that finds itself wanting a different name, promise, refusal or disclosure
is not allowed to want one: that is a config change on the head, reviewed once, for
everyone.

## coverage

what is actually baked in today, in the three words this repo uses everywhere: **working**
(tested here), **partial** (some paths), **designed** (shape agreed, code not run). the
full per-file table is `docs/coverage.md`; each surface branch carries its own.

### social: the feed

what she posts into places she does not own, in `socmed/` plus `publishing/` on the head.

| piece | status | where |
| --- | --- | --- |
| twelve destinations as data, with real limits | working | `publishing/destinations.ts` |
| grapheme-safe composition, threads, alt text, anchored mentions | working | `socmed/discursive/` |
| an account registry per internative, per destination | working | `publishing/accounts.ts` |
| approval as an expiring object, never a boolean | working | `publishing/approval.ts` |
| one-post-once gate with a digest key and a daily fuse | working | `publishing/gate.ts` |
| stills and carousels, sized per destination | working | `socmed/visual-appeal/` |
| live posting adapters per platform | designed | each surface owns its own. bluesky over atproto is the chosen first (docs/oss.md); none is written yet |
| spotify as a posting destination | not possible | no public upload endpoint exists; the code refuses out loud rather than pretending |

the honest shape of it: she can compose, size, illustrate, address, approve and gate a
post today, and the gate will refuse a second copy of the same post faster than you can
click it twice. the last inch, talking to each platform's API, is per-platform work that
is partly done.

### meetings: the room she is invited into

`live/interactive/`, and the largest surface by test count.

| piece | status | notes |
| --- | --- | --- |
| joining zoom, meet, teams, webex, ringcentral | working | one session per meeting, never shared with a broadcast |
| attendance, captures, transcripts, receipts | working | capture requests are answered with citations, never a summary |
| webhook routes and its own http surface | working | the only `serve` task in the repo |
| Q&A panel participation | partial | webinar-scoped in the platforms; she tries, no promises |
| breakout rooms | designed | the shape exists, the plumbing does not |

### other media: what she makes

`content/` and `music/`, which are different things with different failure modes.

| piece | status | notes |
| --- | --- | --- |
| podcast episodes with a real RSS 2.0 and itunes feed | working | own speech seam, chapters, transcript and WebVTT |
| longform episodes written as video | working | chapters, 1080p and 4K targets, thumbnails; explicitly not a VOD republish |
| verticals and clips | working | 14 percent UI safe bands, overlay, clip plan, captions |
| songs: score, code, render, master | working | score first, then strudel/tidal/sonic pi, then a deterministic render; -14 LUFS, -1 dBTP, 24 bit, dry vocal stem |
| song distribution | partial by design | a browser flow against free distributors; account, tax form and final submit are the human's, because the tax form is the human's liability |
| the trained singing voice itself | designed | lanes and licences are chosen and pinned; no model has been trained yet, and no GPU is rented |

## cohesion

the parts are tuned separately on purpose. each one has a different failure mode, so each
one gets its own contract, its own tests and its own tuner. cohesion is not achieved by
putting them in one file. it is achieved by the head sealing them together and by every
surface reading that seal.

### likeness: the body is tuned in one place

`likeness/` owns the look and the sound, because a look that drifts between two stills and
a voice that changes between two episodes are the same defect.

- `appearance/` is tuning, not generation: face, hair, wardrobe, places, grade, in a fixed
  order, with a canonical digest the head seals
- `wardrobe/` and `environment/` seal the instances, not the style: clothes as locks, rooms
  as locks, each with a digest and a drift report
- `mannerisms/` is how the body behaves while wearing it: posture, gesture, gaze, habit,
  space, timing, all of it observable, at most three always-on
- `voice/` is the voice backend seam plus the measured profile it consumes

a look carries **two** digests, and they are not interchangeable: `identity_digest` covers
what does not change between photographs (devices, fixed jewelry, hair, the trained voice),
and the composite digest covers what a given shoot chose (outfit, case, accessories). a
series may restyle her. it may not replace her.

### voice: registers per room, a measured profile, a deterministic instruction set

`persona/registers.ts` on the head resolves how she sounds per surface, with per-platform
overrides, so bluesky is not linkedin in configuration rather than in five branches'
if-statements. `likeness/voice/` then does three separate jobs:

- **measured prosody** (`voice/prosody.ts`): pitch, span, rate and pause, each with a unit,
  the vowel it was taken on and the tool that produced it. a number with no method is not a
  measurement, and "warm" is a listener's conclusion, not a parameter
- **the yaptel seam** (`voice/yaptel.ts`): a profile measured by a separate project, in three
  layers, laid over a room she has real data for. no data, no guess; timbre is never taken
  from a profile because the trained voice owns it; sung delivery never comes from a spoken
  profile
- **the tuning pass** (`voice/tuning.ts`): a rules and lookup pass with no model call, so
  the same profile and the same context produce byte-identical instructions, and a take that
  sounded wrong resolves to a layer and a field instead of to a shrug

### cognition: knowledge, interests, memory, access

kept apart because they answer different questions, and merging them is how an agent ends
up confident about things it never learned.

- `knowledge/` is what she can say, on the three human axes (origin, articulation,
  function) plus the two a machine forces on you: evidence and volatility
- `interests/` is what she reaches for when nobody is paying her to
- `memory/` is what happened, and the mem0 plus falkordb plan that keeps it graph-shaped
- `access/` is what she is allowed to touch: tool grants, never knowledge

the boundary matters at generation time: a voice profile can say how she sounds and never
what she knows, because voice is not knowledge and a face that starts explaining things it
was never told is no longer a reconstruction.

### what actually binds it

- **the aipn**: one number per internative, allocated once, never reused or edited, sealing
  eight layer digests into a pack. a retune pins a new pack under the same number
- **the sync**: `tools/sync-context.sh` gives every surface a byte-identical copy of the
  head's contracts, and the script syncs itself so a mouth cannot keep last month's idea of
  what the head owns
- **the brief**: every surface feeds its writer or speaker the same generated brief
  (identity, register, refusals, disclosure, publishing), so nobody improvises a tone
- **the digests**: `identityDrift` names the axis that moved ("device her-phone: changed",
  "fixed jewelry wedding-band: gone", "hair the-bob: changed") instead of letting a series
  quietly become somebody else

### what a surface may vary

composition. one axis, deliberately. a series shot in one room changes the framing and
nothing else, and a surface that wants a different character, room or outfit is asking for a
config change on the head.

### known gaps

written down rather than discovered later:

- `likeness/voice/` is not yet synced to the mouths, so the tuning pass has no caller on a
  surface branch today
- mannerisms are not yet folded into `identity_digest`
- posting adapters are designed, not written, and no surface has ever posted live
- no voice model has been trained, so the voice contract is enforced against a seam
- nothing establishes that a written register predicts spoken prosody. the yaptel research
  wing is what would settle it, and until then coverage says so out loud

## how a personality is assembled

four layers, and they fail in different ways, so they are written separately.

| layer | file | changes | failure if it lives in the wrong place |
| --- | --- | --- | --- |
| identity | `personas/<id>.persona.jsonc` | almost never | the persona drifts per platform |
| wardrobe | `personas/<id>.wardrobe.jsonc` | daily, deterministic | she wears one outfit forever, or three at once |
| places | `personas/<id>.places.jsonc` | rarely, authored once | her bathroom is a new bathroom every Tuesday |
| appearance | `appearance/tuning.ts` on `likeness` | when the look is retuned | the face is retuned by whoever last touched a prompt |

the head composes prompt blocks from those layers in a fixed order: character, location,
composition, magnification. `consistencyDrift` names the axes that moved between two shots.
that is the whole consistency story, and it is text, not a setting someone can forget.

## the aipn

the number that means "this person". `persona/aipn.ts`.

a personality is not one file. it is eight layers, and one of them is tuned on another
branch. so the aipn seals a set of layer digests, not a folder:

```
AIPN-000001  example        identity, brand, registers, crew, voice,
                            wardrobe, places, appearance   ->  pack 9f2c...
```

the number is immutable: allocated once, never reused, never edited, and a retired persona
keeps hers forever, because the number is the person and not the current version of her. the
person underneath is versioned instead, and a retuned look pins a new pack under the same
number. `POSTGRES_SCHEMA` in the same module is the table that keeps those rules when this
is a live database, not a decision log.

## two paths for pictures

renders and samples are never mixed in one series. `media/paths.ts` declares the path per
surface and `checkSeries` refuses a series that moves the character, the room or the outfit.

the closet is an inventory with provenance (`media/inventory.ts`): hers, captured from a
closet app, borrowed from a shop window, or photographed. a captured garment is a candidate
until someone writes the thing a photo cannot supply, and an outfit built from a shop window
owes the caption a disclosure.

## layout

```
persona/     the head's contracts: manifest, brand, registers, crew, consistency,
             shot planning, wardrobe, places, voice adapter, aipn
personas/    the persona files themselves, jsonc, one person per file
media/       how pictures are sourced: render vs generate, and the closet
publishing/  where a post can go, what each place requires, who has an account, and the gate it passes
generation/  provider adapters, observations, verification
core/        the surface contract every branch implements
memory/      the memory client, the scope rule, and the mem0 + falkordb plan
knowledge/   what she knows, on three human axes (origin, articulation, function)
             plus the two a machine forces on you (evidence, volatility)
interests/   what she reaches for when nobody is paying her to
access/      what she is allowed to touch: tool grants, never knowledge
agentid/     the agent's own ids: signup, verification, consented browser forms,
             and the distribution flows it can drive without help
tools/       sync, checkers, reports
tests/       the suite, one file per contract
docs/        architecture, coverage, roadmap, and the oss survey
```

## running it

```sh
deno test --allow-read --allow-write --allow-env
deno run --allow-read tools/check-persona.ts
deno run --allow-read tools/inventory-report.ts
```

`CLAWBUZZ_PERSONA` selects which file in `personas/` is live. unset means the example, and
no credentials live in this repo at all: keys come from the environment, per surface, and a
surface with no key reports itself unconfigured rather than broken.

## where the truth lives

`docs/coverage.md` says what the head actually does, in the same three words every time:
working, partial, designed. nothing here claims a live capability it has not run.
`docs/roadmap.md` is the order of work. `docs/architecture.md` is the branch map and the
conventions. `research/` holds the questions that are not settled yet, with their sources.
