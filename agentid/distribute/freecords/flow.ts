// freecords, from their own FAQ: the uploader and the distributor are two products.
//
// uploading a song to freecords is not distributing it. the release is made in the
// app and the distribution rides a separate membership called The Club, so a flow
// that stops at the upload button produces a song nobody can stream.
import type { DistributorFlow } from "../flow.ts";

export const flow: DistributorFlow = {
  id: "freecords",
  name: "Freecords",
  host: "freecords.com",
  signup_url: "https://www.freecords.com/for-artists",
  dashboard_url: "https://app.freecords.com/",
  cost: "free",
  commission_pct: 0,
  lanes: ["browserbase", "browseruse", "kernel"],
  lane_default: "browserbase",
  audio: {
    accepts: ["mp3 320 kbps", "wav", "flac"],
    stereo: true,
    max_mb: 100,
    note: "100 MB per file, and 320 is the floor for mp3, not a default",
  },
  artwork: {
    min_pixels: 600,
    square: true,
    max_mb: 10,
    accepts: ["jpg", "png"],
    note: "a low floor: 600 square passes, but square is compressed to fit if it is not",
  },
  lead_days: { min: 0, note: "no lead time stated, so the release date is set inside the app" },
  review: { moderation: "their anti fraud policy applies to every release", live_in: "not stated in their FAQ" },
  verification: { senders: ["freecords.com"], window_minutes: 30 },
  sources: ["https://www.freecords.com/faqs", "https://www.freecords.com/for-artists"],
  verified: true,
  note: "free with no commission, 100 plus platforms, and The Club is the separate distribution membership",
  phases: [
    {
      name: "signup",
      steps: [
        { id: "open", action: "navigate", target: "the for artists page", note: "the listener signup is a different door and makes a listener account" },
        { id: "artist-tick", action: "click", target: "the are you an artist checkbox", note: "unticked gives a listener account, and the fix is a profile switch afterwards" },
        { id: "email", action: "type", target: "the email field", value: "email", note: "the internative's address" },
        { id: "password", action: "type", target: "the password field", value: "password", note: "generated per host" },
        { id: "submit", action: "click", target: "the button that creates the account", note: "lands in the app, not the site" },
      ],
    },
    {
      name: "verify",
      steps: [
        { id: "wait", action: "wait", target: "their confirmation email", note: "polled from the internative's inbox" },
        { id: "link", action: "click", target: "the confirmation link", note: "freecords.com sender, fresh, not a redirector" },
      ],
    },
    {
      name: "release",
      steps: [
        { id: "upload", action: "click", target: "Upload Music on the app home", note: "the button their FAQ names, and it needs an artist account" },
        { id: "audio", action: "upload", target: "the audio file", value: "audio_master", note: "under 100 MB, which a long master can exceed" },
        { id: "art", action: "upload", target: "the cover art", value: "artwork", note: "jpg or png, square, under 10 MB" },
        { id: "details", action: "type", target: "the title and artist fields", value: "title", note: "artist is the internative, spelled once" },
      ],
    },
    {
      name: "claim",
      steps: [
        { id: "club", action: "click", target: "Join The Club", note: "the distribution membership, which is the step that makes it a release" },
        { id: "stores", action: "read", target: "the store list", note: "100 plus platforms, and covers ride the separate cover distribution product" },
        { id: "terms", action: "stop", target: "the distribution terms", owner: true, note: "a second agreement, separate from the site terms" },
        { id: "send", action: "stop", target: "the send to stores", owner: true, note: "the release that goes out is the owner press, not the agent" },
        { id: "spotify", action: "wait", target: "the live release", note: "then the artist profile claim, with the same name as the upload" },
      ],
    },
  ],
};
