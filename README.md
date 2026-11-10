# clawbuzz

one internet personality, built as configuration, carried by a surface per platform.

clawbuzz is not a scheduler and not a content tool. it is a person with a name, a
promise, a refusal list, a wardrobe, a set of places she films in, and a voice that
does not change when the platform does. every surface is how she shows up somewhere.
the head is who she is.

```
main        the head: identity, brand, registers, crew, wardrobe, places, aipn
  music     songs
  audio     podcasts and audiobooks
  longform  episodes written as video
  shortform clips
  streaming the live frame
  meetings  the room she is invited into
  static    stills and carousels
  text      the written feed
```

## the internet native

the person all of this adds up to has a name for itself: an **internative**. an
internative is one personality showing up across platforms, and it is not a surface:
`music` is a room it sings in, not the singer. each internative is assigned exactly
one **aipn**, once, and every surface it operates publishes under that number.
`persona/internative.ts` keeps that distinction honest, including the two things a
store always asks for and an internet native can never supply: a rights holder and a
bank account.

## the one rule

**the mouth never redraws the face.**

a surface branch never edits `persona/`, `core/`, `memory/` or `media/`. it syncs them from
main with `tools/sync-context.sh` and gets a byte-identical copy. a surface that
finds itself wanting a different name, promise, refusal or disclosure is not
allowed to want one: that is a config change on the head, reviewed once, for
everyone.

## how a personality is assembled

four layers, and they fail in different ways, so they are written separately.

| layer | file | changes | failure if it lives in the wrong place |
| --- | --- | --- | --- |
| identity | `personas/<id>.persona.jsonc` | almost never | the persona drifts per platform |
| wardrobe | `personas/<id>.wardrobe.jsonc` | daily, deterministic | she wears one outfit forever, or three at once |
| places | `personas/<id>.places.jsonc` | rarely, authored once | her bathroom is a new bathroom every Tuesday |
| appearance | `appearance/tuning.ts` on the `appearance` branch | when the look is retuned | the face is retuned by whoever last touched a prompt |

the head composes prompt blocks from those layers, in a fixed order: character,
location, composition, magnification. `consistencyDrift` names the axes that moved
between two shots, and a series is only allowed to vary composition. that is the
whole consistency story, and it is text, not a setting someone can forget.

## the aipn

the number that means "this person". `persona/aipn.ts`.

a personality is not one file. it is eight layers, and one of them is tuned on
another branch. so the aipn seals a set of layer digests, not a folder:

```
AIPN-000001  example        identity, brand, registers, crew, voice,
                            wardrobe, places, appearance   ->  pack 9f2c...
```

the number is immutable: allocated once, never reused, never edited, and a retired
persona keeps hers forever, because the number is the person and not the current
version of her. the person underneath is versioned instead, and a retuned look
pins a new pack under the same number. `POSTGRES_SCHEMA` in the same module is the
table that keeps those rules when this is a live database, not a decision log.

## two paths for pictures

proskena renders, `static` generates, meetings capture, and a plate is never mixed
with a sample in one series. `media/paths.ts` declares the path per surface and
`checkSeries` refuses a series that moves the character, the room or the outfit.
composition is the one axis a series may vary, which is the entire point of
shooting six frames in one room.

the closet is an inventory with provenance (`media/inventory.ts`): hers, captured
from a closet app, borrowed from a shop window, or photographed. a captured garment
is a candidate until someone writes the thing a photo cannot supply, and an outfit
built from a shop window owes the caption a disclosure.

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

two more branches carry no code yet and are deliberately empty:

```
research     questions with sources, before they become code
revenue      numbers with receipts, kept apart from the product questions
```

```
```

## running it

```sh
deno test --allow-read --allow-write --allow-env
deno run --allow-read tools/check-persona.ts
deno run --allow-read tools/inventory-report.ts
```

`CLAWBUZZ_PERSONA` selects which file in `personas/` is live. unset means the
example, and no credentials live in this repo at all: keys come from the
environment, per surface, and a surface with no key reports itself unconfigured
rather than broken.

## where the truth lives

`docs/coverage.md` says what the head actually does, in the same three words every
time: working, partial, designed. nothing here claims a live capability it has not
run. `docs/roadmap.md` is the order of work. `docs/architecture.md` is the branch
map and the conventions.
