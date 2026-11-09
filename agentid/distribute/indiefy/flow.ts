// indiefy, from their distribute page: the account is made after the release.
//
// that inverted order is the whole lesson here. the upload form is public, so the
// audio and the details are entered first and the account is the last gate before
// submission. anyone mapping this flow as signup-then-upload gets the pages wrong.
import type { DistributorFlow } from "../flow.ts";

export const flow: DistributorFlow = {
  id: "indiefy",
  name: "Indiefy",
  host: "indiefy.net",
  signup_url: "https://indiefy.net/distribute",
  dashboard_url: "https://indiefy.net/",
  cost: "free",
  commission_pct: 0,
  lane_default: "browserbase",
  lanes: ["browserbase", "browseruse"],
  audio: {
    accepts: ["wav", "mp3", "flac", "aac"],
    stereo: true,
    max_mb: 200,
    note: "200 MB ceiling per file, and the widest format list of the six",
  },
  artwork: {
    min_pixels: 1400,
    square: true,
    note: "they generate a cover from the title, so own artwork is a swap rather than a requirement",
  },
  lead_days: { min: 0, note: "no lead time asked for, because the wait happens after submit instead" },
  review: { moderation: "submitted to their queue", live_in: "5 to 7 business days on a paid plan, 15 to 30 on free" },
  payout: { note: "free accounts withdraw 90 days after the request, paid 30" },
  verification: { senders: ["indiefy.net"], window_minutes: 30 },
  sources: ["https://indiefy.net/distribute"],
  verified: true,
  note: "non exclusive, rights stay with the artist, and the free plan is slower rather than smaller",
  phases: [
    {
      name: "release",
      steps: [
        { id: "open", action: "navigate", target: "the distribute page", note: "the public form, before any account exists" },
        { id: "audio", action: "upload", target: "the audio field", value: "audio_master", note: "drag and drop, and their list takes the mastered wav directly" },
        { id: "title", action: "type", target: "the track title", value: "title", note: "required, and the generated cover uses it" },
        { id: "artist", action: "type", target: "the artist name", value: "artist_name", note: "the internative, spelled the way the profile will be claimed" },
        { id: "genre", action: "type", target: "the main genre", value: "genre", note: "their fixed list, chosen not typed" },
        { id: "send", action: "click", target: "Send my release to stores", note: "this is what opens the account form" },
      ],
    },
    {
      name: "signup",
      steps: [
        { id: "stop-name", action: "stop", target: "the first and last name fields", owner: true, note: "the form asks for a person's name, and the internative is not one" },
        { id: "email", action: "type", target: "the email field", value: "email", note: "the internative's address, resumeable from here" },
        { id: "password", action: "type", target: "the password field", value: "password", note: "generated per host, and it is the only thing that has to survive" },
        { id: "terms", action: "stop", target: "the terms checkbox", owner: true, note: "the owner accepts, not the agent" },
        { id: "submit", action: "click", target: "Create account and continue", note: "after the account the same release continues" },
      ],
    },
    {
      name: "verify",
      steps: [
        { id: "wait", action: "wait", target: "their confirmation email", note: "the flow continues either way, but the account is not recoverable without it" },
        { id: "link", action: "click", target: "the confirmation link", note: "matched by agentid/verify against indiefy.net" },
      ],
    },
    {
      name: "claim",
      steps: [
        { id: "cover", action: "upload", target: "the cover, replacing the generated one", value: "artwork", note: "editable before submission, and it is the visible difference between two interns" },
        { id: "review", action: "read", target: "the dashboard release list", note: "metadata, stores and cover are all editable until they are sent" },
        { id: "submit", action: "stop", target: "the send to stores", owner: true, note: "a release that goes out cannot be quietly edited afterwards" },
        { id: "spotify", action: "wait", target: "the live release", note: "then the spotify for artists claim, with the same artist name" },
      ],
    },
  ],
};
