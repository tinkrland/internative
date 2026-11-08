# clawbuzz

an internet personality, not a content pipeline.

clawbuzz is one persona with seven ways of being present: in a meeting, on a
stream, in a short clip, in a long video, in your ear, on a still frame, and in
text. the same person in all seven, because identity, voice, brand, memory and
publishing permission are declared once, in configuration, and every surface
reads them.

the tools this is not: a ugc generator that stops at "make me a tiktok". ugc is
one of seven surfaces here, and it is not first. what makes a personality is
that the stream, the clip, the podcast and the post are recognisably the same
person with the same point of view and the same memory of who it has met.

## one head, seven mouths

```
                     personas/<id>.persona.jsonc
                    identity · brand · registers · memory
                                  |
                            persona/ + core/            <- main branch
                                  |
   +-------+-------+-------+-----+-----+-------+-------+
   |       |       |       |           |       |       |
meetings streaming short longform    audio  static   text
   |       |       |       |           |       |       |
 zoom    twitch   tiktok  youtube    rss   insta    x, bsky,
 meet    kick     reels   long form  spotify  pinterest threads,
 teams   youtube  shorts  thumbnails apple    carousel  linkedin,
         live                              stills    discord
```

main is the head. each surface is a branch, with its own machines and its own
coverage doc. a surface never edits `persona/` or `core/`: it syncs them from
main with `tools/sync-context.sh`, so seven branches cannot grow seven slightly
different definitions of who the persona is.

## a surface, in six lines

```ts
import { loadPersona } from "./persona/loader.ts";
import { defineSurface } from "./core/surface.ts";

const persona = await loadPersona();                 // CLAWBUZZ_PERSONA
const text = defineSurface("text", { persona, platform: "bluesky" });

const brief = text.brief();                          // who, where, how it sounds, what it refuses
const scope = text.scope("@someone");                // who is in front of it, from a real handle
const notes = await text.recall("what we owe people"); // null when memory is unset, never invented
```

that is the whole contract. everything else a surface does (render a frame,
join a call, publish a post) is the surface's own business, and none of it gets
to restate the identity.

## what makes it one person

- **registers, in configuration.** how the persona sounds in a meeting is not
  how it sounds in a tiktok, and both are written down per surface, plus
  per-platform overrides (`bluesky is not linkedin`) in the same file.
- **one voice mapping.** a single tone profile (warmth, sarcasm, playfulness,
  confidence) maps to delivery cues in one module, so the face, the voice on a
  call, the narrator and the podcast host are the same voice by construction.
- **identity anchors.** people are known by handles across platforms
  (`core/connections.ts`), so a second conversation is a continuation, and a
  stranger stays a stranger instead of being guessed at.
- **scoped memory.** every read and write declares which surface it is and who
  is in front of it. the head (retelldb, pinned in `requirements.txt`) enforces
  what may carry from a meeting into a public post, and reports what it withheld.
- **one publishing permission.** draft, scheduled or live, per persona, with
  owner approval required by default. a pipeline renders; a persona has accounts.

## surfaces

| surface | branch | what goes out | ported from |
| --- | --- | --- | --- |
| meetings | `meetings` | joins, attendance, captures, transcripts, receipts | the prixie proxy engine |
| streaming | `streaming` | live video to twitch, kick, youtube live, obs bridge | the prixie video branch |
| shortform | `shortform` | verticals: tiktok, reels, shorts, with ui safe zones | the prixie socmed branch |
| longform | `longform` | youtube long form written as video, chapters, thumbnails | new, on the media core |
| audio | `audio` | podcast episodes, chapters, transcripts, feed | new, on the voice core |
| static | `static` | proskena stills and carousels, sized per platform | the prixie plate and set work |
| text | `text` | x, bluesky, threads, instagram, linkedin, discord presence | new, on the brief and registers |

status per surface lives in that branch's own `coverage.md`, and the head's
status is in this branch's `coverage.md`. nothing here claims a live capability
the code cannot show.

## quick start

```sh
cp .env.example .env            # CLAWBUZZ_PERSONA=example
deno task test                  # 38 tests: manifest, registers, brief, scope, publishing
deno task matrix                # print persona x surface x platform
```

## docs

- `repo.md` the branch map and the conventions
- `coverage.md` what the head actually does, honestly
- `roadmap.md` the direction, in order
- `persona/readme.md` the manifest format
- `core/readme.md` the runtime a mouth gets

## one persona, a crew of operators

the same identity does not have to be carried by the same agent. seven
verticals is seven jobs, and an operator that writes podcast chapters in the
morning and joins a client meeting in the afternoon is one agent wearing seven
hats, with the hats leaking into each other.

so a persona may field a crew: `crew.<surface>` in the manifest names the
operator for that vertical, with a role, a focus, the playbooks it is trusted
with, what it may do alone, and what it hands back to the owner.

what a crew member cannot do is become a different person. `persona/crew.ts`
composes the brief as identity first, then the post: the name, promise, never
list and disclosure come from the head and are identical across all seven,
while the role, register narrowing and escalation line differ. the podcast
operator sounds like the persona; it does not sound like the meetings
operator.

`crewRoster(persona)` lists who is on shift, and `crewBrief(persona, surface)`
is the string an operator runs on. a vertical with no named operator still
gets a post, made from its surface register, so a manifest can grow a crew one
hire at a time.

## the four consistencies

a diffusion model has no memory of the last frame, so consistency is not a
setting, it is a property of the prompt text. loqo.ai names the four axes and
calls consistency the hard part; they are mandatory here, in this order:
character, location, composition, magnification.

`persona/consistency.ts` builds the prompt body. the character block is
generated from the persona's authored look and reused verbatim, so two
surfaces cannot produce two different faces, and a shot may vary its
composition line but never paraphrases the character line. the four texts also
produce a seed, so the same setup re-runs the same image and a changed axis is
a deliberate change. `consistencyDrift()` answers "is it still the same film"
by naming the axes that moved.

## wardrobe and places

identity is not the same thing as the clothes. three layers, kept apart:

- **identity**, in the manifest, authored once, quoted verbatim into every prompt
- **wardrobe**, `personas/<id>.wardrobe.jsonc`: garment level detail (fabric, cut, colour, hardware), one outfit worn per day. `outfitForDay` is deterministic, so the same day gives the same person, and tomorrow is a different day.
- **places**, `personas/<id>.places.jsonc`: the rooms she actually stands in, with their invariants (mirror height, the chip in the windscreen, which side the light comes from) and two or three reference plates each.

a recurring place is authored before it is shot in, never improvised. that is what keeps a bathroom mirror the same bathroom mirror, the way a person's is.

`planShot(persona, {places, wardrobe}, request)` composes the four axes plus a wardrobe line, and `shotDrift` separates the two kinds of drift: the axes lock for as long as the place exists, the outfit locks for one shoot. a shoot locks character, location and wardrobe; composition is free.

## generation

the parts are built separately and combined last. `generation/adapters.ts` describes what an open video model accepts (character reference, place plates by role, keyframe) and refuses a plan the adapter cannot take before anything runs. adapters are descriptions, not clients: each carries `verified: false` until it has been run against a real endpoint, and the parameter names still have to be confirmed per release.

```
character reference + place plates + axis prompt  ->  reference to video  ->  clip
```

this is the 2026 practice, not an invention: reference kits, several wide plates per location reused as structure, wardrobe treated as its own asset.

## a field name belongs to a provider, not to a model

the roster used to describe models. a model does not validate a request; a
provider's schema does, and two providers serving the same weights disagree
about the field that carries the reference. one page settled it: a catalogue
listed Seedance 2.0 references as `reference_images`, and EvoLink's own API
reference for the same model takes `image_urls`, described there as the
`reference_image` role, 0 to 9 items, with `video_urls` up to 3 and `audio_urls`
up to 3, and a request carrying only audio rejected. So the adapter now names a
provider, an endpoint and a model, and the field it declares is the one that
provider validates.

| adapter | provider | field | cap | source |
| --- | --- | --- | --- | --- |
| seedance-2-reference | EvoLink | `image_urls` | 9 | the provider's API reference |
| WAN reference to video | Pixel Dojo | `reference_urls` | 5 | catalogue |
| WAN 3.0 reference | Pixel Dojo | `reference_image_urls` | 10 | catalogue |
| Seedance 2.5 reference | Pixel Dojo | `reference_images` | 30 | catalogue |
| Kling reference to video | Pixel Dojo | `image_urls` | 4 | catalogue |
| MiniMax H3 reference | Pixel Dojo | `reference_images` | 9 | catalogue |
| single first frame | Pixel Dojo | `first_frame_image` | 1 | catalogue |
| HunyuanCustom (self-hosted) | you | assumed | 4 | inference |

`buildRequest` turns a plan into the body, so the field name is exercised rather
than recited: a reference surface gets an array, a first-frame surface gets one
scalar url, and a provider that binds references by tag gets a line saying which
image is which (`@image1 is the character`) instead of leaving it to array order.
the Seedance 2.0 request comes out as `image_urls`, `model`, `prompt`, and
whatever duration and quality were asked for.

the catalogue-sourced ones are printed as exactly that. they are one step further
from the schema, and the tool says so before anyone wires one up.

`tools/verify-adapters.ts` checks the provider, the field, the endpoint when a
source claims to be an API reference, and the identity carrier. it still ends
with every adapter "not yet observed", because none has been run.

## closing the unproven gap without pretending

`tools/run-frame.ts` plans a real shot, builds the body, and either prints it or
sends it. Without `--live` it prints and says plainly that nothing was sent and
nothing was recorded. With `--live` it needs the provider's key in the environment
under that provider's documented name (`EVOLINK_API_KEY`, `PIXELDOJO_API_KEY`),
posts the body, and on an accepted response writes `generation/observations/<adapter>.json`.

That ledger is what moves an adapter from unproven to observed, and it is the only
thing that can. A 400 is not recorded, because a rejected body is evidence the
field name is wrong, not evidence it works. `verify-adapters.ts` prints observed
adapters separately and keeps the rest under "not yet observed", so the report
keeps telling the truth in both directions.

## two paths, and why they never mix

the media contract on this branch, `media/paths.ts`, is the decoupling written
down as code rather than as a convention:

| surface | path | why |
| --- | --- | --- |
| proskena | rendered | a photoshoot needs the same room twice, and a sample cannot promise that |
| static | generated | volume wants samples, held together by the four consistency blocks |
| shortform | rendered | a 9:16 cut is a crop of a decision, not a new sample |
| longform | rendered | an episode keeps one look for forty minutes |
| streaming | rendered | a stream cannot re-roll the face between minutes |
| meetings | captured | a meeting is evidence, so it is captured and never composed |
| audio, text | none | the mouth does not draw the face |

a plate is deterministic and authored. a generated image is a sample. `checkSeries`
refuses a series that mixes the two for one subject, moves character or location
between items, or changes the wardrobe mid-shoot, because that is how a personality
ends up with three faces and no way to say which is hers. composition is the axis a
series is allowed to vary, which is the entire point of shooting several frames in
one room.

`checkMediaContract` runs inside the persona loader: a claimed surface must have a
path, and a persona that claims `static` must declare a `look`, or diffusion is
being asked to generate her with nothing to be consistent with.

## where the clothes come from

`media/inventory.ts` is the closet as an inventory with provenance. wardrobe.jsonc
answers what she wears today; this answers where the piece came from, whether it is
hers, and whether the post has to say so.

| source | hers | needs a name | needs disclosure | how it arrives |
| --- | --- | --- | --- | --- |
| authored | yes | no | no | written by hand |
| whering | yes | yes | no | screenshot or photo of an item |
| ltk | no | yes | yes | pasted look url or shop screenshot |
| photo | yes | yes | no | a photo she already has |

neither whering nor ltk publishes an api a creator can read their own closet
through, so nothing here is an integration. it is a capture, and a capture arrives
as pixels. pixels do not know what a garment is called or what fibre it is, so a
capture is a `candidate` until `confirmItem` is given the kind, the detail and the
colours: the two fields a render actually needs and a photo cannot supply. flipping
the state is not confirming.

`composeOutfit` turns the shelf into an outfit the shot planner already reads: one
base, one outer, one pair of shoes, any number of accessories, and a second base is
two dresses rather than a look. mixing her own pieces with a look she liked is
normal fashion content; `outfitDisclosure` names the borrowed pieces, and
`captionProblems` refuses a caption that calls a shop window her closet.

`anchorsFor` is the part that keeps a series honest. the photograph that already
exists is a better reference than a new one, so an outfit is scored by how much of
it a posted picture already shows, with the unanchored items named. a series with
no anchor is a new invention wearing her name, and now it says so.

`mixMatch` returns the combinations she could actually walk out of the closet in,
season-filtered, capped, accessories optional and never load-bearing.
`deno run --allow-read tools/inventory-report.ts` prints all of it for one closet.
