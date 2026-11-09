# content

the things the internative makes, as opposed to the places it posts them.

| folder | what it owns |
|---|---|
| `substantive/` | longform: episodes written as video, chapters, 1080p and 4k targets, thumbnails. explicitly not a vod republish |
| `shortform/` | verticals: sizing and overlay, turn and composite, 14 percent ui safe bands, clip plan, captions |
| `podcast/` | audio first: episode plan, speech seam, chapters, transcript and webvtt, a real rss 2.0 and itunes feed |

`substantive/` and `shortform/` are different shapes of the same footage, which is
why they sit together and why neither is a republish of the other. a longform episode
can yield verticals, and a vertical is never the whole story.

`podcast/` is audio only first. it keeps its own speech seam even though the voice
backend lives on the `likeness` branch, because a feed that waits for another branch
is a feed that never ships. when the head publishes the voice contract, this is the
first caller to point at it.

## where this came from

| was | at | became |
|---|---|---|
| `longform` branch | c7727e1 | `substantive/` |
| `shortform` branch | f0670f9 | `shortform/` |
| `audio` branch | eedb467 | `podcast/` |

the `longform` branch kept its code inside the shared `media/` folder rather than its
own. it is in `substantive/` now, where it can be found.
