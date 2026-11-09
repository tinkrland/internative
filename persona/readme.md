# persona

a clawbuzz persona is a file. this folder is the code that reads it.

## the file

`personas/<id>.persona.jsonc`, validated by `persona/loader.ts`. it carries:

- **identity**: id, display name, one liner, positioning, promise, values.
- **refusals**: a never list that must not be empty. a personality with no
  boundaries is not shippable.
- **disclosure**: what it says when asked what it is.
- **handles**: the persona's own public accounts per platform. these are public
  identity, not secrets, and they are how a surface knows its own post is its
  own.
- **voice**: a tone profile (0..1) plus a register for every one of the seven
  surfaces, plus optional per-platform overrides.
- **memory**: the retelldb persona id, and whether the shared graph is readable.
- **surfaces**: which mouths are enabled.
- **publishing**: draft, scheduled or live, and whether owner approval is
  required. defaults to draft plus approval.
- **cadence**: optional, free-form, a generator's input, never a promise to an
  audience.

the registers are required for all seven surfaces even when a persona uses
four. enabling a surface later is then one line in `surfaces`, not a format
change, and it is impossible to enable a mouth that has no manners written down.

## why a file and not code

because a persona is a decision, and decisions belong where they can be read,
diffed and reviewed. two personas are two files. the surfaces never learn whose
mouth they are: they read `CLAWBUZZ_PERSONA`, load the manifest, and call
`defineSurface`.

## the brief

`persona/brand.ts` turns a manifest plus a surface plus a platform into the
brief: identity, register, tone, length and format knobs, the never list, the
disclosure, and the publishing permission. every surface feeds the same brief
to whatever writes or speaks for it, which is the mechanism that keeps seven
branches sounding like one person instead of seven contractors sharing a logo.

## the voice

`persona/voice_adapter.ts` is the only place the persona's fuzzy tone meets a
tts's named cues. it is ported from the prixie context branch, where the face
and the voice both read one file so they could not drift. here the same file
serves calls, streams, clips, narration and podcasts.

## crew.ts, the operators

`crew.ts` is the answer to "one persona, but who is actually doing this job".
a persona may name an operator per surface in `crew`, and the module composes
that operator's brief as identity plus post. identity lines are byte-identical
across every vertical; the role, focus, playbooks, autonomy and escalation are
per vertical. a crew member can narrow a register and name where it escalates,
and cannot touch the name, the promise, the never list or the disclosure.

`crewRoster()` is who is on shift. `crewFor()` resolves one vertical, with a
sensible default post for a vertical the manifest never hired for.
