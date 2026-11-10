# how yaptel tunes one internative

2026-11-10. question: a voice profile is measured data. what turns it into the thing an
internative actually speaks from, and how does that stay per-internative instead of becoming a
generic "voice agent" preset.

source: yaptel's own documents (agent, applications, research, scope, glossary), read from the
archive Anne supplied. this note records what their engine says, what we built against it, and
what is still theirs.

## established

**the engine is a lookup pass, not a model.** `tuning_engine(voice_profile, interaction_context)
-> instruction_set`, and the same two inputs always produce the same instruction set on any
channel. no model call happens at tune time: distillation and sandbox generation already
happened upstream in the research wing. the stated reason is debuggability and reproducibility,
and it is the right one: a take that sounded wrong has to resolve to a layer, and a demo has to
be repeatable.

**the output is an instruction set, not a prompt string.** the fields are `interaction_id`,
`target_id`, `channel`, `system_prompt`, `lookup_filler_source`, `lookup_cue` and a
`layer_trace` naming which profile fields fed which layer, including which channel shift
corrections applied. the trace exists so "it sounded off" becomes "which layer misfired".

**the prompt is a shared header plus a channel body.** the header carries the disclosure and the
three layers; the body is rendered per channel. on voice, punctuation is never read aloud:
emoji density becomes vocal expressiveness, capitals become stress rather than volume, a
trailing ellipsis becomes a real hesitation. on text, punctuation as tone carries over directly
and the channel's length constraint applies.

**voice is not knowledge.** stated in their header as "never invent biographical facts not
present in this profile". this is the boundary that keeps a reconstruction from becoming an
impersonation, and it is why a voice profile may not be used to answer a question.

**fallbacks are ordered and specific.** no measured coverage for a requested register is a hard
stop before the interaction opens, not something to paper over live. a question outside coverage
falls back to the lingvica register instead of inventing. an unresolved contact gets a neutral
register rather than a guess. hostility toward the reconstruction drops character maintenance
below honesty.

**the identity graph resolves before rendering.** falkordb resolves the contact, and the
instruction set is built for that contact, not a stranger. (Their live wing and our memory plan
landed on the same two stores independently, which is worth noting.)

## what we built

`voice/tuning.ts` and `voice/tuning_medium.ts` on the likeness branch, 15 tests. our compiler is
deterministic in the same way, and refuses four things the note above implies but does not spell
out:

- a profile whose `subject` is not this internative. a borrowed voice is an impression.
- an internative with no aipn. an unpinned voice is one nobody can point at later.
- a medium with no measured data. setup failure, named as such.
- a surface with no delivered voice at all: a caption has no register to carry, and sung
  delivery comes from the arrangement.

and one distinction their engine needs and our surfaces force: a bluesky post and an imessage
are both text to us and different measured mediums to yaptel, so the platform is consulted
before the channel.

## assumed, not established

- that a written register predicts spoken prosody at all. nothing in the research wing has
  published a paired measurement yet.
- that one profile per internative stays enough as registers multiply. the coverage table implies
  it can, but sample size per medium is what would decide it.
- that the disclosure line survives being rendered by each channel adapter. we guard our own
  prompt, not their adapters.

## what would settle it

a paired measurement of one person across three mediums, with the same content delivered in
each, scored for faithfulness by a judge that does not know which sample came from which medium.
that is the study the research wing exists to run, and it is the one number that would make
`coverage.mediums_with_real_data` mean something.
