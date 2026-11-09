# wardrobe

the clothes, locked so an autonomous run cannot quietly restyle them.

`persona/wardrobe.ts` on the head decides **what** she is wearing: an outfit is a list
of garments, a palette, an occasion. that file is prose about clothes, and prose is
the thing a diffusion model is free to reinterpret. this folder is the other half.

## the mechanism, and why it is shaped this way

text alone cannot hold a garment. a model given "oatmeal wool overcoat" will produce
eleven coats, and one of them will have a belt. what holds a garment is reference
conditioning (IP-Adapter class adapters, and the reference-image fields the video
providers accept) plus text that never changes. per-garment LoRA training holds more,
and costs one trained artifact and one licence decision per garment, which is the
wrong default for a closet of thirty pieces. so:

- a garment is an **item**: kind, fabric, colour with a hex, fit, at least three
  details, and an avoid list
- an item without a reference plate is allowed only if `plates_missing_reason` says
  why, because text alone is a promise and a plate is evidence
- an outfit is **sealed**: `lockOutfit` turns items into a block plus a sha-256 digest
  plus a seed
- the block is **derived** from the value, never typed beside it. a stored block that
  does not equal the one the value rebuilds is refused, because that gap is exactly
  where drift lives
- a change is a **version**. same id, new clothes, same version number is refused by
  name: that is the same wardrobe wearing her name
- `outfitDrift(before, after)` returns names (`changed:oatmeal-coat(colour,fit)`), not
  a boolean, because an auditor needs to know which garment moved

## the autonomy rule

a scheduled shoot regenerates its prompt. it does not get to write a new description
of the coat. it loads the lock, emits `lock.block` byte for byte, and passes
`lock.seed`. that is the whole reason this exists: the same world an hour later is the
same picture, not a convincing cousin of it.

`avoid` is required and not decorative. a garment that refuses nothing drifts toward
the model's average, which is a different garment by Thursday.

## three kinds of thing, and why the wardrobe needed the distinction

a coat is **styling**: it changes daily, and a shot may re-roll it from a locked set. a
phone is **identity**: nobody buys a new handset on tuesday, so a series showing an
iphone 13 on monday and an iphone 15 on thursday has introduced a fact nobody decided.
the case in between is styling that rides on an identity part.

so the modules are built so the distinction is structural rather than a label somebody
could forget:

| module | the lock holds | what is chosen per shot | what is an event |
|---|---|---|---|
| `accessory.ts` | the device (`apple iphone 13, graphite, 6.1 inch`) | the dressing, from the ones she owns (`case`, `strap`, `charm`, `chain`) | an `upgrade`, dated, with a reason |
| `jewelry.ts` | a `fixed` piece (a band) | a `styling` piece (earrings, a cuff) | a `retired` fixed piece |
| `hair.ts` | cut, length, parting, texture, finish | up or down, or nothing if no up-do is declared | a `restyle`, dated |

two consequences worth stating, because both are enforced. a dressing she does not own
is **refused rather than invented**: "none" is a legal answer, a silicone sleeve she does
not have is not. and a device change without a dated upgrade is refused by name, because
"iphone 13" and "iphone 15" are one keystroke apart and an entire product cycle apart, so
a string comparison is the honest check.

`look.ts` composes the four into one block and carries **two digests**, which is the
point: `identity_digest` covers devices, fixed jewelry and hair, and must not move across
a series; `digest` covers the whole block including the coat and the case, and moves
whenever she restyles. one digest would have made a daily coat change look exactly like a
haircut.

| file | what it owns |
|---|---|
| `module.ts` | garments, plates, the outfit lock |
| `accessory.ts` | devices and their dressings, the upgrade gate |
| `jewelry.ts` | fixed and styling pieces, the series gate |
| `hair.ts` | the cut, the up-do toggle, the restyle gate |
| `look.ts` | the composition, and the two digests |

## corpus

`corpus/` holds two sets of twelve rewrites: one written here against the invent spec,
one invented by adaption labs. all twenty-four are different strings, so all twenty-four
digest differently, and that is the measurement: the problem is not that a paraphrase
cannot be detected, it is that a paraphrase cannot be undone.

the invented set is the sharper finding. asked to grade its own rewording, the generator
called all twelve "the same garment"; a careful read says nine; the digest says none. a
model grading its own paraphrase is not a gate, which is why the drift check compares
locks and not prose. see `corpus/README.md` for the three-answer table.

## files

| file | what it owns |
|---|---|
| `module.ts` | the item, its plates, the outfit lock, the drift report |

tests: `wardrobe_lock_test.ts` (14), `accessory_lock_test.ts` (11), `jewelry_lock_test.ts`
(9), `hair_test.ts` (8), `look_test.ts` (10). nothing here calls a model; this is the
description a call has to carry.
