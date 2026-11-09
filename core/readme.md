# core

the runtime a mouth gets. four small modules, each with one job, none of them
owning identity.

- `surface.ts` the contract. `defineSurface(name, { persona, platform })`
  returns the brief, the register in force, the voice cues, the memory scope,
  and the recall / remember pair. a surface that the persona did not enable
  throws at construction rather than improvising.
- `connections.ts` identity anchors. a handle on a platform resolves to a
  person, or honestly to nobody. two anchors claiming one handle is ambiguity,
  which resolves to nobody: guessing which of two people is in front of the
  persona is worse than not knowing.
- `memory_scope.ts` the declaration a surface sends: which surface, which
  persona, who is in front of it, and the provenance tags that travel with
  writes.
- `memory.ts` the client for the persona memory server (retelldb). unset url
  means a warn and a no-op, never a crash and never an invented memory.
- `publishing.ts` the permission gate. `canPublishTo(decision, { token })`
  answers yes or no with a reason, before anything is sent.

## what core deliberately does not do

it does not render, join, stream, encode, upload or post. those are branch
matters, and keeping them out is what lets seven branches share one definition
of who they are.

## syncing

`core/` and `persona/` are synced byte-identical from main by
`tools/sync-context.sh`. a surface that edits them locally has started a fork
of the persona, which is the failure this repo exists to prevent.
