# socmed

the feed: everything the internative posts into a place it does not own.

| folder | what it owns |
|---|---|
| `discursive/` | text: x, bluesky, threads, instagram, linkedin, discord. grapheme safe compose, threads, alt text, anchored mentions |
| `visual-appeal/` | stills for a feed: instagram non reels, pinterest, carousels |
| `productshoot/` | the rendered path: plate, scene, set, sizes, composite, photoshoot and shot list |

the split is by what the thing is, not by which platform it lands on. a caption is
discursive even when it rides an image, a still is visual-appeal even when it is
generated from a phrase, and a plate is productshoot because it is authored and
deterministic rather than sampled.

`productshoot/` is a render, never a generation. a plate is built once and shot from
several cameras, so two posts of the same set are the same room.

the video surfaces are not here. shorts and longform live on the `content` branch,
because they are made rather than posted.

## where this came from

| was | at | became |
|---|---|---|
| `text` branch | 6e39f34 | `discursive/` |
| `static` branch | 69e81c2 | `visual-appeal/` |
| `proskena` branch | 78554b6 | `productshoot/` |
