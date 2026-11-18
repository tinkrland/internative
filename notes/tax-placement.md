# where the tax form actually sits

2026-11-18. question from anne: most sites do not ask for tax forms while you are starting, so
check the placement. she was right and the branch had it wrong.

## what the branch claimed

`music/distribution.ts` listed "tax form" in every distributor's `requires`, and the planned
browser run stopped at "tax details and payout" before the final submit. the README said account
creation, the tax form and the final submit all belong to the human. the third item was misplaced.

## what the services say

| service | upload path | where tax appears | source |
| --- | --- | --- | --- |
| routenote | seven steps: release data, album details, audio, artwork, stores, localisation, finalise | payment stage: method on file plus a $50 threshold, paid on the 15th to the 20th cycle | support.routenote.com/kb-article/when-do-i-get-paid, /is-there-a-minimum-payout-amount |
| indiefy | public release form, account created at the end | payout onboarding through stripe | release form read 9 nov 2026; help.indiefy.net royalties and payouts |
| jumpstr | register is name, email, password | payout: "to pay royalties you provide payout details ... and tax identification information (such as a tin) where required by law" | jumpstr.io/privacy-policy section 06 |
| freecords | register, artist tick, then audio and artwork | payout; distribution is a separate product with its own terms | freecords.com/faqs |
| soundon | email code plus terms tick, no password | behind the tiktok payout account, unmapped | signup page captured 9 nov 2026; dashboard not reachable without an account |

the pattern is not a coincidence. a distributor is not the payer at upload time: it is the payer
when royalties exist and a threshold is crossed. tax identification is collected by the payer, at
the point of payment, which is why every one of these puts it behind a payout setup rather than
in front of a release.

## what changed

- `requires` split into `upload_requires` and `payout`, and every verified distributor now carries
  a tax placement with a note and the source it was read from
- `payoutGate(distributor, earnings)` answers whether anybody is owed money at all; below the
  threshold nothing is payable and nothing needs signing
- `taxProblems` refuses any entry that puts a tax form back into the upload list, and refuses a tax
  placement other than the first payout
- the browser run's money stop moved after the delivery receipt, so a run cannot block a release on
  a form nobody has asked for yet

## still open

- soundon's payout flow is unverified: the dashboard is behind a tiktok login and no account was
  made, so "tax arrives with the money" there is inference from the signup page having no tax field
- freecords' payout mechanics are unread beyond the faq
- whether any service requires tax details before a *first release* in some jurisdictions. nothing
  read here does, and one counterexample would need a source before the rule changes
