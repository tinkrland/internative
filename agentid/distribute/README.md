
## probing instead of guessing

`probe.ts` checks a flow against a page without opening an account. it reads the
labels and buttons, compares them with the steps the flow expects, and reports what
is missing and what nobody accounted for.

a phase can span several pages (routenote walks six), so a probe is per page and the
caller names the steps that page should show. three rules make the output useful:

- a word matches on itself, or on a plural or a tense, not on a shared prefix. "record"
  does not match "recording", and that difference is a whole field.
- a missing step only fails the probe when it is one that has to exist: terms, submit,
  audio, artwork, title, label, genre.
- a stop only counts while the field it guards is still on the page. if the date of
  birth box disappears, the probe says so, because otherwise a run sails past the
  question that belongs to the owner.

probing an unverified flow is refused for the same reason running one is: there is
nothing to compare it against yet.
