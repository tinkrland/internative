# integrations

each file is one destination. they share one shape:

    { server, key }

## environment

| variable | used by | notes |
| --- | --- | --- |
| `CLAWBUZZ_TWITCH_STREAM_KEY` | twitch | falls back to `TWITCH_STREAM_KEY` |
| `CLAWBUZZ_KICK_STREAM_URL` | kick | account or relay rtmp url |
| `CLAWBUZZ_KICK_STREAM_KEY` | kick | both kick values are required |
| `CLAWBUZZ_YOUTUBE_STREAM_URL` | youtube live | the studio's account specific url |
| `CLAWBUZZ_YOUTUBE_STREAM_KEY` | youtube live | both youtube values are required |

no key is ever written into this repo, and no receipt prints one. twitch's
ingest url is the one public constant: `rtmp://live.twitch.tv/app`.
