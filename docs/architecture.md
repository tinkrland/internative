# repo

clawbuzz is one repository with one branch per way of being present. this file
is the map and the house rules.

## the branches

| branch | owns | speaks on |
| --- | --- | --- |
| `main` | the head: persona manifests, loader, registers, brief, voice mapping, connections, memory scope, publishing | nothing. main never talks to an audience |
| `meetings` | joining rooms, attendance, capture requests, transcripts, receipts | zoom, google meet, teams, webex, ringcentral |
| `streaming` | live video out, the obs bridge, chat presence while live | twitch, kick, youtube live |
| `shortform` | vertical clips and their ui safe zones | tiktok, instagram reels, youtube shorts |
| `longform` | written-as-video long form: chapters, b roll, thumbnails | youtube, and vod republishes from streaming |
| `audio` | episodes, chapters, transcripts, the feed | rss, spotify, apple podcasts |
| `static` | stills and carousels, art directed once and sized per platform | instagram, pinterest, linkedin, x, threads |
| `text` | written presence, replies, threads | x, bluesky, threads, instagram, linkedin, discord |

## the rule

main is the head. surface branches never edit `persona/` or `core/`: run
`sh tools/sync-context.sh` and commit the synced copies. if a surface needs
something from the head, it changes on main first, which means every surface
gets it, which is the point.

the same rule as before, restated because it is the one that decays: **the
mouth never redraws the face.** a surface that needs a different register adds
an override in the manifest (`voice.register_by_platform`), never a second
definition of the persona in its own code.

## adding a surface

1. add the value to `SURFACES` in `persona/schema.ts` and the defaults in
   `SURFACE_BRANCH` / `SURFACE_DEFAULT_PLATFORM` / `SURFACE_MEDIUM`.
2. add a register for it in every persona manifest (the loader requires all
   surfaces, so nobody can ship a mouth with no manners).
3. create the branch, sync the head, implement the mechanics, keep identity out
   of it.
4. write that branch's `coverage.md` with honest statuses.

## conventions

- docs are lowercase, short lines, no em dashes, no emoji.
- commit titles are short, one clause, lowercase. the body carries the detail.
- statuses are one of working, partial, designed, planned, not possible, and a
  status is only as good as the artifact that shows it.
- no real handles, no owner names, no client names in the repo. handles that
  ARE the persona's own public accounts live in the manifest; people's handles
  live in env (`CLAWBUZZ_CONNECTIONS`).
- every surface stops at draft unless the persona's publishing mode says
  otherwise, and a missing credential is a refusal, never a half publish.

## vocabulary, settled

an **internative** (internet native) is one personality across platforms, with one
aipn assigned to it once. a **surface** is a room that internative shows up in:
text, shortform, longform, audio, music, streaming, meetings, static, proskena. the
head knows both, and `persona/internative.ts` refuses the confusion of the two.

a **rights holder** is the human or entity behind the internative. releases,
distributors and payouts need one. the internative is the artist name.
