# likeness

the internative's body: how it looks and how it sounds.

two backends, one branch, because they fail the same way. a look that drifts between
two stills and a voice that changes between two episodes are the same defect, and
they are fixed in the same place.

| folder | what it owns |
|---|---|
| `appearance/` | the tuning: face, hair, wardrobe, places, grade, and the canonical digest the head seals |
| `voice/` | the voice backend seam: adapters, registration, the style a surface asks for |

`appearance/` is tuning, not generation. it produces a fixed-order description the
head seals into the aipn pack, so a retune is a new pack under the same number and
never a re-roll of the face.

`voice/` is the provider seam. an adapter is registered by name and asked for speech;
which provider answers is a deployment decision, and the surface asks for a style
instead of a voice id.

## where this came from

| was | at | became |
|---|---|---|
| `appearance` branch | b264a29 | `appearance/` |
| `audio` branch, `audio/tts.ts` | eedb467 | `voice/` |

the `audio` branch's episode, feed and transcript work moved to the `content` branch
under `podcast/`. nothing was dropped, only placed.
