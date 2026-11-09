# corpus

two sets of re-descriptions of a locked garment, and the three answers to the same
twelve rewrites.

## the measurement

| who is answering | how many of the twelve are "the same garment" |
|---|---|
| the generator that wrote the rewrites | 12 |
| a careful reading | 9 |
| the digest | 0 |

the third row is not a failure of the digest, it is the reason the lock exists. a
paraphrase cannot be *undone*: nothing in "knee-skimming" tells a renderer that it is
meant to be the hem the lock says is below the knee. so the mechanism is not a better
judge of rewrites, it is never to rewrite: the block ships from the lock.

the first row is the more useful warning. asked to grade its own paraphrase, the
generator said "same garment" twelve times, and three of those had moved a visible
thing (a hem, a slot, a fit). a model grading its own rewording is not a gate, which is
why the drift check compares locks rather than prose.

## the corpora being built

four more are in flight, launched the same way and recorded in `pending.json` with the
dataset ids: accessory persistence (the phone and its case), jewelry drift (metal, stone,
and which body part), hairstyle drift (length, cut, parting, texture), and whole outfit
series. `tools/corpus-fetch.ts` polls them and writes the provider's own jsonl into
`raw/`; curation stays a separate step, because the generator labels its own rewrites
generously and a corpus that inherits those labels inherits the flattery.

the waiting is the part worth writing down: invent returns immediately, the rows arrive
hours later, and until a run exists the download route refuses with "no run has started".
that is not a failure, so poll rather than re-invent, which spends credits twice.

## what the first batch actually delivered

all four landed in under an hour, and the audit is more useful than the corpora:

| corpus | rows | labelled same | rows naming a moved field | unusable |
|---|---|---|---|---|
| accessory persistence | 40 | **40** | 1 | 24 unparsable until the fenced `json` blocks were stripped |
| jewelry drift | 30 | 25 | 5 | 1 |
| hairstyle drift | 30 | 24 | 5 | 1 |
| outfit series | 30 | 30 | 0 | 0 |

so the accessory corpus, the one that mattered, reproduced the generator's habit at full
strength: forty rows, forty times "the same object", one row naming a change, and no
device swap at all in any rewrite. eight distinct devices across forty rows, with the
iphone 13 case repeated a dozen times. it measures the flattery, which is worth having,
but it does not measure the contrast, so a corrected run went out the same day: a fixed
12/12 split (twelve case swaps that are the same object, twelve device swaps that are
not), plain JSON with no fences, and at most two rows per device.

then the corrected run came back, and the first audit of it was wrong in an instructive
way. one prompt row can carry MANY completions: the download returned 24 rows holding 410
completions. counting them properly gives the contrast that was asked for:

| corrected accessory run | completions | labelled same | labelled different |
|---|---|---|---|
| case swaps (styling) | 230 | 230 | 0 |
| device swaps (identity) | 180 | 0 | 180 |

so the counted split did work, and the earlier "it never varied the device" reading was a
parser artefact: the block always said iphone 13 while the rewrite named the other device,
and only the rewrite is the claim. 2 to 3 credits bought 410 labelled examples rather than
24, which changes what a corpus costs.

three lessons for the prompt shape, all now in the record. "include plenty of both" is not
an instruction a generator follows, a counted split is. and a fence is not a failure:
stripping it recovered 24 rows that had been thrown away.

## curation: the labels are the thing under study, so they get checked

`tools/corpus-curate.ts` reads every raw file, unwraps multi completions, dedupes rewrites
and then argues with each row using the block it came from. every kept row carries three
things: the provider's label, ours, and the reason they differ when they do. the companion
file `curated.invented.json` (next to `paraphrase.invented.json`, shaped like it) holds all
of them; `curated/<name>.jsonl` holds the same rows per source.

the relabel rules, in order of how much they trust the row:

- a claimed change is verified against the block first. "material changed" is only true if
  the block's material word is gone from the rewrite, and the claim is dropped when the
  rewrite just reworded the same substance.
- a "same" row is only relabelled on positive evidence: the rewrite NAMES a competing value
  the whole block never held (brass against gold, a bun where the block wore it down, an
  iPhone 15 where the block says 13). absence alone is vagueness, reported in the reason
  but never relabelled.
- garment words are too synonymic to relabel on (trench arrives as trench coat, chelsea as
  chelsea boots), so outfit lines are reported as restated or vague, never as a different
  outfit.
- a case, charm or strap swap is a new dressing on the same object: the phone survives. a
  device, metal, piece or hair swap makes a different object, whichever label the provider
  gave it.

| source | completions | kept | dropped | human same | human different | relabelled |
|---|---|---|---|---|---|---|
| `accessory_device_swap` | 63 | 61 | 2 | 0 | 61 | 0 |
| `accessory_persistence` | 16 | 16 | 0 | 16 | 0 | 0 |
| `accessory_persistence_v2` | 397 | 376 | 21 | 211 | 165 | 0 |
| `hairstyle_drift` | 29 | 29 | 0 | 2 | 27 | 22 |
| `jewelry_drift` | 29 | 24 | 5 | 24 | 0 | 0 |
| `jewelry_style_contrast` | 24 | 20 | 4 | 16 | 4 | 0 |
| `outfit_series` | 30 | 30 | 0 | 30 | 0 | 0 |

556 rows kept, 299 same and 257 different. what the careful read found:

- `hairstyle_drift` is the headline disagreement. the provider called 24 of 29 rows the
  same hairstyle; 22 of those quietly add an arrangement the block never held, a bun, a
  braid, a twisted knot, a half-up ponytail, on top of hair the block described worn down.
  relabelled different, each with the arrangement named. the honest count is 2 same, 27
  different.
- `jewelry_drift` never drifted at all. its four claimed metal changes never left brass
  (weathered, darkened, oxidised: patina rewordings), and its fifth kept white gold while
  dropping the karat. all five dropped as false claims, leaving 24 restatements and no real
  drift in the corpus.
- `accessory_persistence_v2` lost 21 self contradictions (11 claiming a device change while
  still describing the block's phone, 10 claiming a case change while repeating the same
  case). its 211 "same" rows are case and charm swaps on a surviving phone; its 165
  different rows swap the device.
- `accessory_persistence` collapsed from 40 rows to 16 unique completions before curation
  even began: it said the same phone and case a dozen ways.
- `jewelry_style_contrast` was asked for 12/12 and gave 16 same and 4 different after
  checking, so material-versus-style contrast remains the thinnest evidence in the set.
- `outfit_series` held up as 30 restatements. its value is negative: the generator will not
  label an outfit change a change, which is worth knowing before trusting any same.

## the files

| file | what it is |
|---|---|
| `paraphrase.json` | twelve rewrites of one coat, written here against the invent spec. nine move something, three are faithful to a reader |
| `paraphrase.invented.json` | twelve rewrites of varied garments from adaption labs (dataset `26572b6e-dbcc-415a-83dc-12d8df2ac01f`, `gemma-4-31b-it`, 2 credits estimated, about two hours to download). keeps the generator's labels next to the curated ones, with a reason on every relabel |

tests: `tests/paraphrase_corpus_test.ts` (5). it refuses a row that is a copy of its
block, refuses a label without a reason, and refuses a corpus that is all one answer.
