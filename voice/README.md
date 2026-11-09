# voice

two jobs, one identity.

`tts.ts` is the speaking seam: text and delivery cues in, a file path out, no provider
baked in.

`reference.ts` is the singing problem, and it is a different shape. a speech adapter can
borrow a timbre at call time. a singing voice cannot: every open singing model needs its
own copy, trained from recordings, which makes the recordings the real asset and the
thing worth reviewing.

## what the checks are for

a reference set is refused when it is too short (600s floor, 1800s before an svs vowel
stops sounding like a neighbour), when takes are stereo or below 40k, when a take is
under three seconds or over thirty (an aligner starves or drifts), when the transcript
covers fewer than five vowels, and when the audio is mixed provenance, because a voice
cannot be half borrowed.

consent is a field, not a feeling: a real human voice carries a name and a date, a
borrowed voice carries the licence that permits training, and synthetic audio names the
adapter that made it.

## what it can become

a spoken reference trains conversion (`rvc`, MIT), which keeps the melody of whatever
sang it: honest for a cover, wrong for an original. a sung reference trains singing
(`diffsinger`, MIT) and the plan reports the span and the minutes it is short by.

the digest check is the one that matters most to the rest of the repo: the trained voice
must carry the same identity digest as the speech voice, or the chorus would not be her.
