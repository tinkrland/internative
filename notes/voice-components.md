# what a voice is made of, beyond accent

2026-11-10. question: yaptel measures "how a person sounds" across mediums. before any of
that can be a schema, what are the parts, and which parts are measurable rather than
described?

## established

prosody is the term for the part of speech that is not the words: pitch, loudness, tempo and
rhythm, timbre or phonatory quality, and pausing. the literature separates two ways of
measuring the same thing, auditory (a listener's impression) and acoustic (hertz, decibels,
seconds), and a system that records one while claiming the other is guessing.
([prosody, wikipedia](https://en.wikipedia.org/wiki/Prosody_(linguistics)))

intonation has a notation, not just adjectives. ToBI transcribes pitch accents (H\*, L\*),
phrase accents (H-, L-), boundary tones (H%, L%) and break indices, and a full transcription
is an audio file, an F0 track, a tones tier, a words tier, a break tier and a miscellaneous
tier. that is the difference between "she sounds unsure" and "L\*H-H% on the final word".
([ToBI, wikipedia](https://en.wikipedia.org/wiki/ToBI))

voice quality is measured, not felt: f0, jitter, shimmer and harmonics-to-noise. in a
standardisation study of normal adult voices the female mean f0 was 205.82 Hz on /a/ (male
119.84 Hz), jitter 0.62% (0.49%), shimmer 0.22 dB and PHR 10.9 dB (0.22 dB, 10.9 dB).
note the units: shimmer in decibels, and PHR rather than HNR. a number quoted without its
unit and its method is not a measurement.
([Felippe et al, BJORL 2006](https://www.bjorl.org/en-standardization-acoustic-measures-for-normal-articulo-S1808869415310235))

who it is, is carried mainly by f0 and formant structure: converging evidence in voice
recognition work points at fundamental frequency and formants as the cues listeners use to
tell one voice from another, which is why timbre belongs to the trained voice and not to a
style guide. ([Xu et al, 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3795466/))

## what this settles for the repo

- a prosody parameter is not an emotion. "sarcasm", "warmth" and "confidence" are inferences
  a listener makes from prosody, so they cannot be a stored parameter without a derivation.
- every stored value carries a unit, a vowel or context, and a method (which tool, which
  corpus), because the studies above disagree on units for the same quantity.
- pitch range must be a span (semitones) rather than an absolute f0, since absolute f0 mostly
  says who the speaker is and span says what they are doing with it.
- timbre and f0 sit with identity (the trained voice, its digest). rate, span, pause length,
  stress placement and voice quality drift sit with register.

## assumed, and what would settle it

assumed: that a written register ("bluesky is clipped and dry") predicts spoken prosody at
all. nothing measured supports that yet. the yaptel research wing is the right instrument:
the same person on a call, a voice note, a stream and a podcast, measured on the dimensions
above, would either show a stable personal signature with medium-specific deltas or it would
not, and either answer changes this schema.
