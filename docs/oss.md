# oss we can actually incorporate

a tool earns its place here only if it removes a failure mode we already have a
contract for. "it is popular" is not a reason, and neither is "it has an api".

licences below were read from the repositories on 8 november 2026, not remembered.

## in use

| tool | licence | what it does for us | why it is not replaced |
| --- | --- | --- | --- |
| ffmpeg | LGPL/GPL depending on build | every media decision: encoding, geometry, and now loudness | the `loudnorm` filter **is** EBU R128 / BS.1770, so the master contract is measured by the same standard it is written in |
| obs-websocket | GPL-2.0 | the streaming branch drives obs over its documented protocol | the alternative is screen scraping a studio |

## incorporate next, verified

| tool | licence | where it lands |
| --- | --- | --- |
| atproto | MIT (spec and reference implementation) | bluesky publishing: `com.atproto.repo.createRecord` with an `app.bsky.feed.post`, an app password, and alt text on the blob. no aggregator, no review queue |
| mastodon rest api v1 | AGPL server, plain https client | mastodon publishing, one app registration **per instance**, because a hardcoded instance is a bug |
| whisper | MIT | captions on shortform and longform. the branch already knows what a caption is; this fills it |
| whisperX | BSD-2-Clause | word level timestamps when the clip needs a per word effect rather than a caption |
| auto-editor | Unlicense | cutting on silence before the clip planner runs, so a 40 second ramble becomes a 12 second clip instead of being refused |

## evaluated and not adopted

| tool | licence | verdict |
| --- | --- | --- |
| Postiz | AGPL-3.0, 41k stars, active | a real scheduler with 20 platforms, and the right answer for someone who wants a ui. **run it, do not embed it**: the approval gate would move outside our code, and AGPL in the same process is a licence argument nobody wants on release day. if we want a human queue later, it sits in front of our api, not inside it |
| Mixpost | MIT, 3.9k stars, last push march 2026 | MIT is the friendly licence and the dormancy is the problem. parked until it moves again |
| demucs | MIT, 10.4k stars, last push april 2024 | the only honest way to separate a mix into stems after the fact, and it drags in torch. the music branch requires stems **at mix time**, which is better practice anyway, so this stays optional and dormant |
| ComfyUI | GPL-3.0 | the strongest open image pipeline, and GPL. fine as a separate self hosted service behind http for static experiments, never linked into our process |
| IP-Adapter | Apache-2.0 code, 6.7k stars | the code is permissive; the **weights carry their own terms** and some are non commercial. verify per checkpoint before a persona is built on one |
| InstantID | check per release | promising for face consistency and the licence was not confirmed in this pass, so nothing here depends on it |
| pyloudnorm | not needed | it implements the same bs.1770 that ffmpeg's `loudnorm` already implements, and one measurement implementation is enough |
| ffmpeg-normalize | not needed | a wrapper over the filter we call directly. a wrapper would only hide which numbers came from which pass |

## the rule for licences here

**permissive (MIT, Apache, BSD, Unlicense) can be vendored.** **copyleft (GPL,
AGPL) runs as a separate process over http or it does not run.** that is the whole
policy, and it is why the publishing layer is our own code with a `Publisher` seam
rather than a thin skin over somebody's scheduler.

## what is still missing before a social presence

1. **app registrations.** bluesky needs an app password, mastodon needs one
   registration per instance, and instagram, threads, tiktok, youtube and x need
   developer apps and in some cases a review. none of that is code.
2. **a human approval surface.** `publishing/plan.ts` refuses an unapproved plan,
   which means something has to approve it.
3. **ingest waits.** instagram and tiktok take a container and finish with it later,
   so a receipt is not the end of the story for video.
4. **tiktok is private until audited.** a first public post there is a review
   milestone, not a config flag.
5. **spotify has no upload api.** a distributor is the route, and `publishing`
   refuses rather than pretending.
