# coverage: the head

what main actually does, as of the commit that added this file. surface
branches carry their own coverage docs; this one is only about the head, which
is the part every surface depends on and the part that must not be hand waved.

statuses: working (tested), partial (some paths), designed (shape agreed, code
not written), planned (direction), not possible (in this approach).

## persona as configuration

| piece | file | status | evidence |
| --- | --- | --- | --- |
| manifest format (identity, brand, registers, memory, publishing, cadence) | `persona/schema.ts` | working | typed, defaults applied at load |
| jsonc loader with full error list | `persona/loader.ts` | working | tests: comments, trailing commas, string content preserved |
| validation: required branding, non empty never list, all seven registers, slug ids, 0..1 tone | `persona/loader.ts` | working | one error per problem with its path |
| persona directory listing | `persona/loader.ts` | working | `listPersonas`, used by `tools/matrix.ts` |
| reference persona | `personas/example.persona.jsonc` | working | loads, prints, drives every test |
| crew (`persona/crew.ts`) | working | one operator per vertical, identity shared, register narrowable, escalation declared. 7 tests |
| crew validation | working | unknown surface, missing role and empty focus are refused by the loader |

## how one person sounds the same everywhere

| piece | file | status | evidence |
| --- | --- | --- | --- |
| register per surface | `persona/registers.ts` | working | resolution and defaults tested |
| per-platform overrides (x, bluesky, threads, instagram, linkedin, discord, tiktok, youtube, spotify) | `persona/registers.ts` | working | shallow replace, tested |
| a disabled surface refuses to run | `core/surface.ts` | working | construction throws |
| one tone to cue mapping (face, call voice, narrator, podcast) | `persona/voice_adapter.ts` | working | ported byte-identical from the prixie context branch, logic tested |
| brief generation | `persona/brand.ts` | working | deterministic, tested for identity, register, refusals, disclosure, publishing |
| brand sanity checks | `persona/brand.ts` | working | flags vague disclosures, vague refusals, live-with-approval contradiction |

## continuity: who the persona has met

| piece | file | status | evidence |
| --- | --- | --- | --- |
| identity anchors, expanded platform set | `core/connections.ts` | working | normalization per platform, ambiguity to nobody, malformed config to no anchors |
| scope declaration per surface | `core/memory_scope.ts` | working | anchor verdicts: anchored, owner, stranger, no_config, ambiguous |
| provenance tags on writes | `core/memory_scope.ts` | working | `platform:<p>`, `connection:<id>` |
| memory client | `core/memory.ts` | working | real retelldb calls when configured; honest no-op with a warn when not |
| read rules (what carries, what drops) | retelldb `routing/scope.py` at v0.2.8 | working upstream, pinned here | vendored python from the prixie context work; this repo pins the tag |
| python and typescript agreeing on normalization | both sides | partial | same rules written twice; there is no shared fixture test across the two languages yet |

## publishing

| piece | status | evidence |
| --- | --- | --- |
| draft / scheduled / live per persona, approval required by default | working | tested, including the contradiction case |
| credential gate per platform | working | missing token is a refusal with a reason |
| actual posting adapters | designed | each surface branch owns its own; main never posts |

## tooling

| piece | status |
| --- | --- |
| `tools/sync-context.sh` | working (fetch main, sync persona/ and core/, install the retelldb pin) |
| `tools/matrix.ts` | working (persona x surface x platform, generated from the manifest) |
| test suite | working, 38 tests |

## surfaces

not in this branch. each surface branch states its own status in its own
`coverage.md`, and the only claim main makes about a surface is that it exists
and whose mouth it is.
| consistency (`persona/consistency.ts`) | working | four axes mandatory in prompt order, persona-owned character line, seed from the setup, drift by axis name. 6 tests |
| wardrobe (`persona/wardrobe.ts`) | working | outfit cards, deterministic day rotation, validation. 8 tests with places |
| places (`persona/places.ts`) | working | recurring places need a wide plate and at least two, invariants + light required |
| shot (`persona/shot.ts`) | working | four axes plus wardrobe, seed includes the outfit, drift named per axis |
| generation adapters (`generation/adapters.ts`) | designed | reference assembly and refusal logic tested; no model is called, no adapter verified |
| adapter definition checks (`generation/verify.ts`) | working | identity carrier, kit ceiling, declared licence, honest unverified list; 5 tests |
| adapter roster (`generation/adapters.ts`) | working | eight adapters with real field names and caps, evidence per adapter, assumed ones named; 80 tests on main |
| adapter provider surfaces + `buildRequest` | working | field names owned by the provider, scalar vs array bodies, tagged prompts; 87 tests on main |
| run path + observation ledger (`tools/run-frame.ts`, `generation/observations.ts`) | working | dry run prints and records nothing, live run records only an accepted status, report splits observed from unproven; 92 tests on main |
| media contract (`media/paths.ts`) | working | render vs generated vs captured declared per surface, series refuses mixed sources and wardrobe drift, loader refuses generation with no look; 101 tests on main |
| closet inventory (`media/inventory.ts`) | working | four capture sources with provenance rules, candidate to confirmed gate, layer collisions, affiliate disclosure, media anchors per outfit and per place, mix and match; 113 tests on main |
| aipn registry (`persona/aipn.ts`) | working | eight layer digests, pack versioning under an immutable number, retired numbers never reissued, in-memory store plus the postgres table that keeps the same rules |
| music surface | designed | register, crew operator and media path declared on the head; the `music` branch holds the song contract |
| publishing destinations (`publishing/destinations.ts`) | working | twelve destinations with route, tool and licence, grapheme length limits, media kinds, alt text and generated-content requirements, conservative daily caps; the one with no upload api says so |
| publish gate (`publishing/gate.ts`) | working | approved or refused, idempotent key so a retry cannot double post, sliding window rate fuse per destination, receipts; 131 tests on the head |
| oss survey (`docs/oss.md`) | working | licences read from the repositories on 8 november 2026, with what is in use, what is next, and what was refused and why |
| internative (`persona/internative.ts`) | working | one person, one aipn, a set of surfaces, plus the refusal that a surface name is not a person and the artist identity a release needs (name and rights holder kept apart) |
| presence registry (`publishing/accounts.ts`) | working | account per internative and destination with handle, platform id, instance for mastodon, did for bluesky and credential env names only; a secret in the file is refused by shape, and app-review destinations cannot post until reviewed |
| approval (`publishing/approval.ts`) | working | queued, approved or refused with a named reviewer, a refusal reason, and an expiry so a stale yes cannot be replayed; approving one draft does not approve the next |
