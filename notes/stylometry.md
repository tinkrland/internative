# stylometry, and the movement taxonomy next to it

2026-11-10 (revised 2026-11-18). two questions, because they are the same question asked of two
channels: what makes a person recognisable when the content changes. one is how they write, the
other is what their body does while not talking.

## what is established: writing

stylometry is authorship attribution from style rather than subject. it compares the scaffolding:
function words, punctuation habits, sentence length and its variance, vocabulary richness. the
field's baseline is Burrows's Delta, which z-scores the frequencies of the most frequent words
and takes a distance; newer work generalises it (Rank-Turbulence Delta, Jensen-Shannon Delta)
rather than replacing the idea. function words carry most of the signal because writers choose
them unconsciously while choosing content deliberately.

concrete, checkable findings:

- function word frequency is the strongest and most stable family, and is the basis of Delta
- vocabulary richness must be measured with a length-robust index. type-token ratio climbs as a
  sample grows, so Yule's K is the standard choice; K = 10^4 (sum i^2 Vi - N) / N^2
- punctuation use, average sentence length and its variance are standard feature families, and
  they are what a reader notices as "rhythm" without being able to name it
- short samples are the known failure mode. the literature reports that detection degrades badly
  on short texts, so a floor is not pedantry, it is the difference between a measurement and noise
- modern feature sets (StyloMetrix and similar) split into lexical, grammatical, syntactic and
  punctuation families; in a recent human-versus-LLM study the highest-signal individual features
  were comparative adjectives, function word types, fronting constructions and lemma type-token
  ratio, reaching .87 MCC in a seven-class setting

sources: aclanthology.org/W14-0908.pdf (function words in attribution), arxiv.org/html/2604.19499v5
(Delta generalisations), ceur-ws.org/Vol-1384/paper6.pdf (Yule's K and punctuation features),
arxiv.org/html/2507.00838v1 (StyloMetrix features, human vs LLM, short-sample limits).

## what is established: movement

the kinesic taxonomy in use is Ekman and Friesen's, five functions: emblems (gestures that
translate directly into words and are agreed within a culture), illustrators (movements that
accompany and shape speech), affect displays (feeling shown in face and body), regulators
(turn-taking signals) and adaptors (self-touch and object-touch, usually unconscious, which is
why they read as tells).

the load-bearing consequence for a persona is that these classes are not interchangeable. an
emblem is culturally bound, so one without a stated culture is a guess about a dialect. a
regulator only exists where somebody can answer, so it belongs to conversational surfaces. an
adaptor is the class that can be always-on without becoming a performance, because it was never
a performance to begin with. an affect display that never changes is a mask.

source: creducation.net/resources/nonverbal_communication/kinesics.html, arxiv.org/html/2510.04844v1

## what we built from it

`voice/stylometry.ts` (likeness): nine features, each with a window and a method, per-family
sample floors, Yule's K instead of TTR, `styleDrift` naming moved features against a per-feature
tolerance, and `styleDistance` refusing to call two internatives drift (that is attribution).
`mannerisms/module.ts` gained the five functions with the three rules above. `wardrobe/look.ts`
folds always-on mannerisms into `identity_digest`, so a series may bring a stress habit in and
out and may not lose the tuck.

## what is not established

- whether a stylometric profile transfers across registers. a caption and a longform piece are
  different measurements; nothing here claims one predicts the other, and the digest keeps them
  separate on purpose
- whether an LLM can hold a measured style profile over a long output without drift. the corpus
  launched as `style_drift_pairs` is the first evidence either way
- whether adaptors and emblems can be reliably prompted into a generated image at all. mannerisms
  are specified for shots and for description, not proven to survive a diffusion pass
