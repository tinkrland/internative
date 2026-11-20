<p align="center">
  <img src="assets/logo.png" width="260" alt="internative" />
</p>

# internative ☆.ᐟ

> one person, living on the internet, in more than one room.

## what is this

internative is me trying to build a *person* instead of a feed.

the short version: an internative is an internet native. it has a name, a promise, a list of
things it won't do, a face, a voice, a wardrobe, opinions, interests, and a place it keeps
coming back to. it shows up on several platforms, and it is recognisably the same one on all
of them.

## the bit that actually makes it different

not the output. anyone can generate a post. i can generate a post. the hard part is being the
same person next month.

so the defining thing here is the combination of **autonomy** and **identity continuity**. an
internative does not merely generate individual pieces of content, a caption here and a clip
there. it maintains an ongoing presence as a recognisable digital creator: same name, same
promise, same refusals, same face, same voice, same taste, next month as next tuesday, whether
it is singing, sitting in a meeting, or posting a still.

## what this is not

this is not a synthetic influencer.

i'm not building a wrapper around a funnel that happens to have a face on it, and i'm not
building something whose job is to push ugc slop into your feed so a product gets a mention.
that whole genre is one long ad with a personality painted on, and the personality is the
first thing that gets dropped when the ad performs badly.

an internative is a creator in the boring, normal sense of the word: consistent, distinct,
recognisable, with things it actually cares about and a body of work that builds. it can be
funny without selling anything. it can have a bad week. it can be wrong about a band. if money
shows up later, it shows up the way it does for a person, as a rights holder and a payout
gate, not as the reason the thing exists.

so: not synthetic influencers. digital creators and internet personalities that would still
be themselves with every ad account deleted.

---

## the rooms

one branch is the head. everything else is a room she shows up in.

**main** is the head: who she is, what she refuses, how she sounds, what she knows, what she is
allowed to touch. it holds no publishing, no filming, no posting.

the rooms are **likeness** (the body: how she looks and how she sounds), **live** (meetings and
streaming, presence while something is happening), **socmed** (the feed: stills, carousels,
threads, captions), **content** (longform, shortform, podcasts and audiobooks), and **music**
(songs, from the idea to the master).

a room is never the person. `music` is where she sings, not who she is. `likeness` is her body,
not her.

---

## the one rule

the mouth never redraws the face.

a room branch never edits the head. it syncs the head's folders and gets a byte identical copy,
and if a room finds itself wanting a different name, a different never list, a different face,
that is not a room's decision to make. the mouth never redraws the face.

it sounds like a small thing. it is the entire product. the moment two rooms can each decide
who she is, you have two people wearing one name, and that is exactly the failure mode this
repo exists to avoid.

---

## the number

every internative gets exactly one **aipn**, allocated once, and every room publishes under it.

it is not a version number and not a username. it is the number that means "this person". a
retired internative keeps hers forever, because the number is the person and not the current
version of her. when something about her is retuned, the version changes and the number does
not.

a personality is not one file either. it is a handful of layers, and one of them is tuned on
another branch, so the number seals a set of layer digests rather than a folder. same number,
new pack, and you can still prove which pack a piece of work came from.

---

## coverage, honestly

**the feed.** twelve destinations as data, grapheme safe composition, alt text that is
actually written, an account registry, approval as something that expires, and a gate that
stops the same post going out twice. what is *not* built: the last inch. posting adapters per
platform are designed and unwritten. bluesky over atproto is the chosen first one. spotify is
not a posting destination at all, because there is no upload endpoint, and pretending
otherwise would just be a nice looking button.

**meetings.** a join engine that speaks to five platforms, attendance, captures with citations
back to the transcript, and receipts for the people who invited her. the q&a panel is partial.
breakout rooms are designed, not built.

**other media.** podcasts are real: an rss feed with the itunes tags that actually matter, and
a speech seam behind it. longform and verticals are planned with their targets and bands. songs
go all the way through score, arrangement, render, master and a distribution plan, and the
trained singing voice is designed rather than done, because no model has been trained and no
gpu has been rented.

---

## how it stays one person

here is the awkward part: none of this can be tuned in one place, because the things being
tuned are not the same kind of thing.

**likeness** tunes the look and the sound together, because a face that drifts between two
stills and a voice that drifts between two episodes are the same defect. it carries two
digests: one for what never changes between photographs, and one for what a particular shoot
chose.

**voice** does three separate jobs. it measures prosody, it consumes a measured voice profile
from a separate research project, and it compiles that profile plus a context into an
instruction set. that last step is a lookup pass with no model call, so the same inputs give
the same instructions and a take that sounded wrong can be traced to a field.

**mannerisms** are the body's own axis: posture, gesture, gaze, habit, space, timing. an
always on mannerism is folded into the identity digest, because a habit she has in every
photograph is as much her as the phone in her hand. a mannerism she shows under stress is
styling, the way a coat is.

**cognition** stays in separate folders: what she knows, what she remembers, what she reaches
for, and what she is allowed to touch. merging those four is how an agent gets confident about
things it never learned, and access is a grant list, not a fact.

what binds them is unglamorous. the aipn pack, a sync script that copies the head into every
room, a brief generated from the head that every writer and speaker reads first, and drift
reports that name the axis that moved instead of letting a series quietly become somebody else.

---

## pictures and money are both boring on purpose

**pictures.** one path renders, one path generates, and a plate is never mixed with a sample in
one series. composition is the only axis a series is allowed to vary, which is the entire point
of shooting six frames in one room. the closet is an inventory with provenance: hers, captured
from a closet app, borrowed from a shop window, or photographed. a shop window piece owes the
caption a disclosure.

**money.** there is no open upload endpoint in the music chain, so distribution is a browser
job: a session may create the draft, fill the metadata and upload the files, while the account,
the final submit and the payout details stay a human's. tax is not a signup step, whatever the
genre conventions say. no distributor read here asks for a tax form before a release exists.
the tax form belongs to whoever is being paid, and nobody is being paid until a threshold is
crossed, so the money stop sits *after* delivery, not before it.

an internet native cannot open a bank account. that is not a bug to route around, it is why the
rights holder is a separate field and why the payout gate is a person's job.

---

## running it

tests are `deno test --allow-read --allow-write --allow-env`, and `CLAWBUZZ_PERSONA` picks
which file in `personas/` is live. unset means the example. no credentials live in this repo at
all: keys come from the environment, per surface, and a surface with no key reports itself
unconfigured rather than broken.

## where the truth lives

`docs/coverage.md` says what the head does and with how much evidence. `docs/architecture.md`
says how the rooms relate. `docs/roadmap.md` is the order of work. the `research` branch holds
questions that still have no answer, with sources. the `revenue` branch holds numbers with
receipts.

## what is still missing

being honest about it is cheaper than being surprised later.

- posting adapters are designed and unwritten, and nothing has ever posted live
- voice has no caller on a room branch yet, so the seam is tested but unused
- the trained singing voice does not exist, and neither does the gpu bill for it
- nothing yet shows a stylometric profile transfers across registers
- nothing yet shows that a written register predicts spoken prosody at all

that last one is the one i would want answered first. the rest is work. that one is whether any
of this is measuring the thing it says it measures.
