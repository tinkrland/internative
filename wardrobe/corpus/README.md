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

## the files

| file | what it is |
|---|---|
| `paraphrase.json` | twelve rewrites of one coat, written here against the invent spec. nine move something, three are faithful to a reader |
| `paraphrase.invented.json` | twelve rewrites of varied garments from adaption labs (dataset `26572b6e-dbcc-415a-83dc-12d8df2ac01f`, `gemma-4-31b-it`, 2 credits estimated, about two hours to download). keeps the generator's labels next to the curated ones, with a reason on every relabel |

tests: `tests/paraphrase_corpus_test.ts` (5). it refuses a row that is a copy of its
block, refuses a label without a reason, and refuses a corpus that is all one answer.
