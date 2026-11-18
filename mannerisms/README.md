# mannerisms

how the body behaves while the wardrobe is being a wardrobe.

a locked look answers what is worn. it cannot answer how she stands in it, and that gap is
the difference between a portrait of a person and a mannequin wearing the same clothes. so
the body gets an axis of its own, in six kinds:

| kind | what it covers |
|---|---|
| `posture` | stance, weight, shoulders, where the spine settles |
| `gesture` | hands and arms in motion, and where they end up |
| `gaze` | where the eyes go, and when they leave |
| `habit` | the repeat offenders: the tuck, the tug, the tap |
| `space` | how she takes up a room: distance, lean, entrance, exit |
| `timing` | the beat before an answer, the interrupt, the trail-off |

## the one rule that matters

**a mannerism has to be something a camera can catch.** "tucks her hair behind her right ear
when a thought starts to form, and leaves her hand there for a beat" is a mannerism.
"radiates quiet confidence" is a mood wearing a mannerism's name, and it is refused by stem
(`mannerisms/module.ts` carries the tripwire list on purpose: it is short, and it is a
tripwire rather than a lexicon).

three more, because a set of these reads as a person only when they add up:

- **placed on a real site.** the site vocabulary is the wardrobe's (`hair`, `face/eyes`,
  `hands`, `waist`, ...), so a mannerism can be blocked for a shot instead of floated.
- **a trigger, not a pose.** a gesture says what it happens around. a posture may be still,
  because the stillness is the posture.
- **three always, not six.** more than three always-on mannerisms reads as a tic, and two
  always-on habits in the same place make the body choose. `setProblems` refuses both.

`signature()` returns the always set, capped at three, for a card or a casting note, and a
set with nothing always-on has no signature at all: worth saying out loud, because a
stranger should be able to recognise her by something.

`mannerismBlock(set, surface)` renders what a shot may act on, always-on first, and keeps a
podcast timing mannerism out of a photograph.

## what this is not

not animation. the block is text a renderer or a model reads, in the same shape as the
wardrobe block, so the same consistency rules apply. lip-sync and skeletal performance belong
to their own projects; this is the authored inventory those projects would animate.

## the fold into identity

an always-on mannerism is not styling, so it is not treated as styling. `look.ts` folds every
mannerism with `frequency: "always"` into the identity parts, which means it enters
`identity_digest` beside the device, the fixed jewelry and the hair.

the line is the same one the wardrobe already draws. a habit she has in every photograph is
as much her as the phone in her hand; a mannerism she shows under stress, or sometimes, is
styling, the way a coat is. so a series may bring the knuckle press in and out, and may not
lose the tuck: `identityDrift` names it as `mannerism hair-tuck: gone`, and `seriesLookProblems`
refuses the series before it spends anything.

`intensity` and `surfaces` stay out of the digest on purpose. they change how the habit reads
in a frame, not whether it is hers, and a digest that moves when a mannerism is turned up is a
digest that will be retuned for no reason.
