# likeness

the internative's body: how it looks and how it sounds.

two backends, one branch, because they fail the same way. a look that drifts between
two stills and a voice that changes between two episodes are the same defect, and
they are fixed in the same place.

| folder | what it owns |
|---|---|
| `appearance/` | the tuning: face, hair, wardrobe, places, grade, and the canonical digest the head seals |
| `wardrobe/` | the clothes as locks: items, reference plates, a digest, a drift report |
| `environment/` | the rooms as locks: invariants, plates, a structure source, a drift report |
| `voice/` | the voice backend seam: adapters, registration, the style a surface asks for |
| `scene.ts` | one shot assembled from the locks, plus the framing a photographer chooses |

`appearance/` is tuning, not generation. it produces a fixed-order description the
head seals into the aipn pack, so a retune is a new pack under the same number and
never a re-roll of the face.

`wardrobe/` and `environment/` are the difference between a persona with a look and a
persona with a life. `appearance/` tunes the style; these seal the instances, because an
autonomous run must not be able to paraphrase the coat or re-invent the kitchen. a lock's
text is derived from its value, so a scheduled shoot emits byte-identical words an hour
later, and its seed is the digest, so the same world reproduces the same frame.

`scene.ts` is the join: the head's character line, the wardrobe lock, the environment
lock, and two framing lines a shot is allowed to vary. it does not edit the head to add
a fifth axis; `consistencyView()` hands the head's four axes back unchanged.

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
