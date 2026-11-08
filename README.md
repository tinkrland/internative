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
| `music/master_check.ts` | the measurement: what the file actually is |
| `music/release.ts` | where it goes and what it has to carry to get there |

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

the branch vendors nothing from the head. it takes a brief, and `briefProblems`
refuses a brief with no aipn or no register, so a song cannot be planned for a
personality that has no number yet.
