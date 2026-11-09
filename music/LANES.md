# three lanes

a song is three decisions: the vibe (key, tempo, groove, arrangement), the words, and
the performance (how those words land on that music in one particular voice).

one model that emits a finished song makes those inseparable. you cannot re-sing a line
in the same key, cannot rewrite a verse without a new melody, cannot audition a better
vocal over the arrangement you already approved. so the lanes are separate artifacts,
each with a digest, and reassembly is a planned step.

## musicality

the vibe. our own score synth plays it deterministically from chords, bass and hits,
and an open model may render it when a richer arrangement is wanted.

| vendor | licence | release |
| --- | --- | --- |
| score-synth (ours) | MIT | yes |
| ace-step-1.5 | MIT | yes |
| ace-step | Apache-2.0 | yes |
| diffrhythm | Apache-2.0 | yes |
| yue | Apache-2.0 | yes |
| musicgen | CC-BY-NC-4.0 weights | preview only |

audiocraft's code is MIT but the released weights are non commercial, so a MusicGen
preview is a reference track and never a delivered one.

## lyric

the words. ours, in `lyrics.ts`, and the only lane with no model in it. what it owes the
other two is a count: syllables per line, so a line that cannot fit a bar is known
before it is sung.

## performance

the singing. melody plus syllables plus a voice identity in, one vocal stem out.

| vendor | licence | release | why it is here |
| --- | --- | --- | --- |
| diffsinger | MIT | yes | the lane as a format: notes, phonemes in, audio out |
| rvc | MIT | yes | conversion from about ten minutes of reference |
| openvoice | MIT | yes | cloning that separates tone colour from style |
| seed-vc | GPL-3.0 | yes, as a process | strong on singing, never imported |
| so-vits-svc | AGPL-3.0 | yes, as a process | needs a trained speaker |
| basic-pitch | Apache-2.0 | yes | reads a melody back out of a reference take |
| whisperx | BSD-2-Clause | yes | word timings, to check a sung line against its words |

the rule that decides this table is the house one: permissive may be vendored, copyleft
runs as a separate service or not at all.

## the join

`voiceIdentityProblems` refuses a song sung in a voice the internative does not speak
in. the singing voice and the speaking voice are one identity with one digest, so a
timbre cannot drift between a podcast and a chorus.

`melodyFor` places one note per syllable, in order, on chord tones, with every line
starting on a bar. `fitProblems` warns when a line needs more beats than a bar has.
`toSvs` converts that to seconds at the song's tempo, so a renderer cannot drift.

## reassembly

`assembly.ts` mixes stems and masters them. it refuses stems from different takes
(`p1` over `m2` is two songs), a vocal that is not dry (it can never be remixed), a
mix where the music sits above the voice, and a master that misses the delivery
contract. a remix is then exactly what it should be: two numbers changed.

demucs is in the vendor table for the other direction, taking a model's single pass
apart into stems when the model insisted on doing all three lanes at once.
