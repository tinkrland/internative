# music

songs. an orphan branch, separate from `audio`, which is podcasts and audiobooks.

`audio` is one voice talking in your ear for twenty minutes. `music` is one voice
singing the same four bars until it sticks. they share a throat and nothing else:
different lengths, different rights, different delivery, different failure modes.
keeping them on one branch would mean a lyric sheet and an episode transcript
arguing about what a "section" is.

## what it holds

| file | the decision it owns |
| --- | --- |
| `music/brief.ts` | what arrives from the head, and the aipn the song belongs to |
| `music/song.ts` | key, tempo, meter, sections, and the one idea |
| `music/arrangement.ts` | what plays when, and how loud it is allowed to get |
| `music/lyrics.ts` | a section tagged lyric sheet, and the rights basis |
| `music/master.ts` | the delivery contract: loudness, peak, and the stems |
| `music/score.ts` | one score: chords, bass and hits per section, deterministic |
| `music/code.ts` | the score as strudel, tidal cycles and sonic pi |
| `music/render.ts` | the score played: deterministic wav synthesis, and its stems |
| `music/master_check.ts` | the measurement: what the file actually is |
| `music/distribution.ts` | the browser run that gets it to a store, and where it must stop |
| `music/release.ts` | where it goes and what it has to carry to get there |

## songs are code before they are audio

a song starts as a `SongSpec` and becomes a `Score`: chords, bass and hits per
section, derived from the key, the tempo and a seed. `composeScore` is deterministic,
so the same song and seed are the same score, and a change to a song shows up as a
diff rather than as a slightly different render.

that score is then rendered three ways, in `music/code.ts`: **strudel** (one pattern
per section, assembled with `arrange`), **tidal cycles** (angle brackets for one event
per cycle) and **sonic pi** (section blocks whose sleeps add up to the bars). the three
argue with each other by design: `renderProblems` refuses a rendering whose tempo,
chord names, event count or beat total disagrees with the score, so "three cousins of
the same song" is caught mechanically rather than by ear.

`music/render.ts` plays that score as audio by arithmetic: chord tones, a bass note
and a countable click per bar, written straight into a 16 bit wav with no model and no
plugin. it is not a record, and it is not pretending to be: it is the thing a model
later replaces a part of, and the thing `master_check` can measure today. stems come
from the same bars, so a mixdown cannot disagree with them.

open models fill the parts code cannot: a voice, a played instrument, texture. the
order is score first, code second, model last, so the model is always playing something
that can be read, reviewed and re-performed without it.

## distribution is a browser job

there is no open upload endpoint in the music chain. `music/distribution.ts` holds the
free distributors as data (what they keep, which stores, what they demand) and plans a
**browser run** against one of them: navigate, fill, upload, and three hard stops. the
policy is not negotiable and it is a line of code rather than a paragraph:
a session may create the draft, fill the metadata and upload the files, while account
creation, the tax form and the final submit belong to the human behind the internative,
because those are the human's liability. `claimProblems` waits until a release is
actually live before a spotify for artists profile can be claimed, and one isrc may
only be live through one distributor, since two claims on one recording gets both
rejected.

an unverified distributor is refused, not tried. that is why spacemedia is listed as a
name and not a route.

## the rules that are actually rules

**one idea per song.** a song with no thesis is a mood. a song with no chorus is
allowed only if it declares itself through composed, because otherwise the listener
spends three minutes waiting for a thing that was never coming.

**a licence is a reference, not a feeling.** every sheet declares its basis:
original, public domain, licensed or cover. public domain names the work and the
year it entered. a cover of a living writer and a sample of a recording both carry
the paper, or the sheet does not pass.

**the master is a delivery contract.** -14 LUFS integrated, -1 dBTP true peak,
24 bit. a streaming service normalises on the way in, so mastering louder only
costs the transients. the stem set always includes a dry vocal, because a dry vocal
cannot be recovered from a mixdown and it is what makes a song usable for a sync, a
remix or a live set.

**the master is measured, not asserted.** `music/master_check.ts` runs ffmpeg's
`loudnorm` filter (EBU R128 / BS.1770) over the file and says how far it is from the
contract, in LU. the gain for a second pass comes from that measurement. no wrapper
library: the filter is in the tool everyone already has.

**a song knows whose it is.** the aipn rides on the song and on the release, so a
track stays attached to its person after that person is retuned. the release also
carries the ai disclosure, because the stores ask and the listener is owed it.

## running it

```sh
deno task test    # includes a real ffmpeg measurement of a real tone
```

the task carries `--allow-run` because two tests shell out to ffmpeg and ffprobe. without
the permission, or on a machine with neither binary, those two report as ignored rather
than failed: a missing tool is not broken audio, and a suite that cries wolf about its
own dependencies stops being believed.

the branch vendors nothing from the head. it takes a brief, and `briefProblems`
refuses a brief with no aipn or no register, so a song cannot be planned for a
personality that has no number yet.
