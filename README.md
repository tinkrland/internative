# live

where the internative is present while something is happening.

two kinds of presence, one branch, because both are the same problem lived at
different temperatures: an api session, an obs bridge, a browser that must not be
navigated away from.

| folder | what it owns |
|---|---|
| `interactive/` | meetings: joining zoom, meet, teams, webex and ringcentral, attendance, captures, transcripts, receipts |
| `immersive/` | broadcast: obs bridge, camera publish, twitch, kick and youtube live as one file per destination |

`interactive/` is a room something happens in and the internative is a participant.
`immersive/` is a stage the internative owns and fills.

the join session and the broadcast session are never the same session. navigating
the meeting session away drops the meeting, and a stream that borrows the meeting's
browser is a stream that ends mid sentence.

`interactive/` carries its own http surface and webhook routes, so a `serve` task
exists here and nowhere else in the repo.

## where this came from

| was | at | became |
|---|---|---|
| `meetings` branch | f13080f | `interactive/` |
| `streaming` branch | 22e0b44 | `immersive/` |
