# grounding: why accessories split into identity and styling

four sources, read before the corpora were curated, and the two code changes they forced.
the point of doing this first was to check that the distinction invented from one phone
and one threadbare coat is a real distinction, and not a tidy idea.

## 1. continuity is a paid job, and it tracks exactly these things

the script supervisor oversees "wardrobe, props, set dressing, hair, and makeup,
consistent from scene to scene" and keeps "detailed notes on each take", with a
pre-production continuity breakdown so that wardrobe, set dressing, hair and makeup are
"in sync in regard to the progression of time within the story"
([wikipedia](https://en.wikipedia.org/wiki/Script_supervisor),
[screenskills](https://www.screenskills.com/job-profiles/browse/film-and-tv-drama/technical/script-supervisor-film-and-tv-drama/)).

this is the strongest result, because it means the split is not our invention: film
already separates what must hold across scenes from what the story moves on purpose, and
it does so as a named department head with notes per take. the notes are the ancestor of
our digest, and "progression of time within the story" is what our `upgrade` and
`restyle` dates encode. a phone that changes between scenes is a continuity error, which
is precisely the phrase `upgradeProblems` refuses by.

## 2. jewelry metal is a legal category, not a flourish

16 CFR part 23 (the FTC Jewelry Guides) defines the surface products separately: vermeil
must be sterling silver plated with gold of "not less than 10 karat fineness" (23.4), and
gold plated, gold filled, rolled gold plate and gold overlay each have their own rules
(23.3).

so "gold" without a karat is not merely vague, it is the one word the guides exist to
separate, and "gold coloured" is an appearance rather than a material. this forced a
change: `metalProblems` in `wardrobe/jewelry.ts` now refuses vague metal descriptions and
refuses gold or silver with no karat or alloy. a corpus row that swaps "18k yellow gold"
for "gold plated brass" is not a rewording at all, it is a different product claim.

## 3. hair texture means two things, and stylists mean both

the trade glossaries define texture by "the circumference of an individual strand of
hair, with fine hair having a small circumference and coarse hair having a large one",
alongside the pattern words (blunt, layered, graduated, curtain fringe, lob)
([matrix](https://www.matrix.com/blog/hair-cutting-and-hair-styling-terms-and-definitions),
[into the gloss](https://intothegloss.com/2015/07/haircut-terms-to-know)).

so "fine" alone is half a texture. `textureProblems` in `wardrobe/hair.ts` now requires a
strand word and a pattern word, which is the lexicon a stylist would actually check.

## 4. the drift problem is the industry's problem, and the industry's fix is a trained identity

"most generators rebuild the person from the prompt on every run and keep no memory of
who they generated before, so each clip is a fresh guess at the same face", and the
commercial fix is a trained identity from roughly 20+ reference images so that there is
"no re-uploading a reference per shot, no fighting drift between scenes"
([higgsfield](https://higgsfield.ai/blog/keep-ai-character-consistent)).

this is the premise of the whole branch stated by a vendor: prompt text is not a memory,
and the thing that holds an identity is an artifact plus references. it also explains why
`identity_digest` is worth having separately: the vendor's answer is a trained artifact,
ours is a digest and plates, and the digest is what notices when the artifact's subject
has been swapped.

## what grounding did NOT support

nothing found a published taxonomy of accessories by persistence. the identity and styling
split is an inference from continuity practice and from product law, not a term of art, so
it is written down as ours in the module comments rather than presented as convention.

## what changed as a result

| change | source | file |
|---|---|---|
| metal must name a material, not an appearance, and gold needs a karat or alloy | 16 CFR 23 | `wardrobe/jewelry.ts` |
| texture must name strand thickness and pattern | trade glossaries | `wardrobe/hair.ts` |

the accessory corpus was already running when this was read, so the grounding steers
curation and the labels rather than the prompt. if the rows show the contrast is not the
one a reader makes (case swap counted as a different object), the honest next step is a
second run with the prompt corrected by what this established, at about four credits.
