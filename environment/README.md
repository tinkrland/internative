# environment

the rooms, locked, so the persona lives somewhere instead of somewhere new.

`persona/places.ts` on the head says which places exist and what does not move in
them. a text description cannot pin a window: "on the left" has no height and no
depth, so every generation invents its own kitchen and the series reads as a person
who moves house between posts.

## the mechanism

**a room needs geometry, not adjectives.** what holds a room is a structure pass over
a plate that already exists (a depth or line estimate fed to a structure-conditioned
adapter), which is how practitioners rebuild a room from a background photo. so a
recurring place is only locked when it has a **wide plate**, and the lock names that
plate as the structure source (`structureSource`) rather than pretending the words
did the work.

the two halves of the claim:

- `block`: the invariants as verbatim text, the surfaces with materials and hexes,
  the light direction and time, the props, and an avoid list
- `plates`: the wide plate for geometry, the mirror plate for what a selfie sees, the
  detail plate for texture

a lock with one half is refused. half a room is a new room.

`placeDrift(before, after)` names what moved: `["light", "plates", "surfaces"]`.

## what counts as an invariant

a fact, not a mood. "white walls" fails, because every kitchen has walls and half of
them are white. "the window is on the left wall, above the sink" passes, because a
viewer would notice if it moved. three is the floor: two fixed things is a style.

## a one-off set

a place that exists for one shot is not locked, it is built. `recurring: false` lets it
carry no plates at all, provided `plates_missing_reason` says so. what it cannot do is
pretend to be a room in her life.

## files

| file | what it owns |
|---|---|
| `module.ts` | the place, its plates, the lock, the structure source, the drift report |

tests: `tests/environment_lock_test.ts` (12). the join that puts a room and an outfit
into one prompt is `../scene.ts`.
