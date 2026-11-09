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

## corpus

`corpus/paraphrase.json` is twelve re-descriptions of one locked coat, three of which a
person would accept as the same coat. all twelve are different strings, so all twelve
digest differently, which is the measurement: the problem is not that a paraphrase
cannot be detected, it is that a paraphrase cannot be undone. the corpus also keeps its
own labels honest (a row labelled same may not change a field) and the test refuses a
copy of the block masquerading as a rewrite.

## files

| file | what it owns |
|---|---|
| `module.ts` | the item, its plates, the outfit lock, the drift report |

tests: `tests/wardrobe_lock_test.ts` (14). nothing here calls a model; this is the
description a call has to carry.
