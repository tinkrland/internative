# knowledge

how this persona knows things, and how what it knows is not one kind of thing.

a memory that stores everything in one table is a search box with a personality
bolted on. it cannot tell a fact from a skill, a fact it checked from a fact
someone told it, or a fact that expires from a fact that is hers. so knowledge
here is a small number of axes, each enforced in code, and a brief that renders
them differently because they are different.

## the human split

the axes are borrowed, not invented. knowledge is divided this way in philosophy
long before it was divided this way in software:

**by origin, how it was acquired**

- innate, a priori: capacities and structures present before experience
- empirical, a posteriori: gathered by meeting the world
  - direct, first hand trial and perception
  - indirect, testimony: books, instruction, what someone told you
- studied, codified: deliberate formal instruction

**by articulation, how easily it can be said**

- explicit, know-what: it can be written down and tested
- tacit, know-how: it is held by doing (Ryle's knowing-how, Polanyi's "we can
  know more than we can tell"), with a further split into what reflection could
  articulate and what is only ever shown

**by function, what it does**

- propositional, that something is the case
- procedural, how to do a sequence
- explanatory, why it is the case
- acquaintance, knowing OF a person, place or thing by having met it (Russell's
  knowledge by acquaintance, as against knowledge by description)

sources:
[nature of knowledge](https://philosophyalevel.com/aqa-philosophy-revision-notes/nature-of-knowledge/),
[tacit knowledge](https://en.wikipedia.org/wiki/Tacit_knowledge),
[know-what vs know-how](https://philarchive.org/archive/BRUTTO-23),
[theory of knowledge questions](https://welearnwegrow.medium.com/35-theory-of-knowledge-questions-unpacked-671a69c15a3e),
[implicit and tacit knowledge](https://bloomfire.com/blog/implicit-tacit-explicit-knowledge/),
[knowledge and the knower](https://pmc.ncbi.nlm.nih.gov/articles/PMC4809766/).

## where a machine has to leave the human taxonomy

**innate does not survive the translation.** a human is born with something; a
model arrives with weights and a version number. those are not memories and must
not be stored as memories, because a memory can be edited by a later run and an
architecture cannot. so `origin` has three values, and an item claiming to be
innate is refused with that reason. her priors are declared in the AIPN pack,
not remembered.

**tacit cannot be typed.** Polanyi's point is not that tacit knowledge is hard
to write, it is that writing it changes what it is. for a machine this is worse:
the model can always produce a plausible verbalisation, so "she knows how" can
be asserted for free, forever, by any run. so a tacit item may not carry a
written claim at all. it points at a demonstration (a procedure, an example, an
eval). a tacit item with no demonstration is refused by name as a claim wearing
a costume.

**two axes are added, because a machine forces them.**

- `evidence`: verified, reported, inferred, assumed. how do we know. a
  conversation is testimony and cannot be verification; an inference names its
  basis; an assumption says why and carries a confidence. without this axis a
  later run contradicts an earlier one and nothing notices.
- `volatility`: durable, seasonal, volatile. does it expire. a taste does not; a
  price, a phone model and a room's furniture do, and each says when to look
  again. a persona fact that expires is refused, because it is really a fact
  about the world that got filed wrong.

and one axis that is not about knowledge at all but decides who may read it:
`scope`, being persona, owner, world or project. the owner's knowledge informs a
private surface and does not go out in public.

## the shape that follows

`item.ts` holds the axes and the refusals. every rule there exists because its
absence produces a specific failure: an unverified claim ascending to fact, a
skill asserted instead of shown, a stale price spoken with confidence, a secret
typed into a committed file.

`policy.ts` holds admission, contradiction and retirement. two items about one
subject with different values are a contradiction, and the resolution is named
(verification first, then recency) rather than averaged. nothing is forgotten by
accident: an item leaves because something replaced it or because it expired.

`brief.ts` renders the smallest useful set into a prompt, ordered acquaintance,
then what is true, then why, then what she can do, then what she can only do,
then what she half knows, with the hedged items carrying their evidence in the
line itself. it cuts whole items against a character budget and reports what it
cut. `coverageProblems` says when a persona can only recite: no tacit items, no
procedures, nobody met, nothing verified.

## the store

the schema lives here; the store lives in `memory/`. the persona's memory is
mem0 (open source, self-hosted) over a graph database, so that a fact can be
reached by meaning and by relationship, and so that a retrieval can explain why
it returned what it returned. the knowledge axes are the contract the store must
satisfy: mem0 holds distilled items, this module decides whether an item is
admissible, what it may be called, and when it expires.

what is deliberately not here yet: a migration from whatever a previous run
wrote, and an embedding strategy. both wait for the store's real API rather than
a guess about it.
