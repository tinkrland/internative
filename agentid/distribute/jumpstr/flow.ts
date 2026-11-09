// jumpstr, from their own site: free, unlimited, and thinner on published rules.
//
// their landing page answers the money questions and not the delivery ones. no
// format list, no artwork floor, no help centre: support is a widget. so the flow
// carries a step that reads the uploader for its rules at run time, and a note
// that a move to another distributor means removing and re-uploading with the
// same ISRC, which is the only way to keep the streaming history.
import type { DistributorFlow } from "../flow.ts";

export const flow: DistributorFlow = {
  id: "jumpstr",
  name: "Jumpstr",
  host: "jumpstr.io",
  signup_url: "https://jumpstr.io/",
  dashboard_url: "https://jumpstr.io/",
  cost: "free",
  commission_pct: 0,
  lane_default: "browserbase",
  lanes: ["browserbase", "browseruse"],
  audio: {
    accepts: ["to be read from the uploader"],
    stereo: true,
    note: "no format list published, so the uploader is the authority and the run records what it took",
  },
  artwork: {
    min_pixels: 1400,
    square: true,
    note: "a floor from the stores rather than from jumpstr; nothing published to confirm it",
  },
  lead_days: { min: 0, note: "no lead time published; their moderation is reported as fast rather than scheduled" },
  review: { moderation: "their team reviews each release", live_in: "artists report same day, which is a report and not a promise" },
  verification: { senders: ["jumpstr.io"], window_minutes: 30 },
  sources: ["https://jumpstr.io/"],
  verified: true,
  note: "free with unlimited uploads, and the support route is the widget on every page",
  phases: [
    {
      name: "signup",
      steps: [
        { id: "open", action: "navigate", target: "the register page", note: "read live on 9 nov 2026: name, email, password, confirm password, register, or google" },
        { id: "name", action: "type", target: "the name field", value: "display_name", note: "the internative's name, which is public on every release" },
        { id: "email", action: "type", target: "the email field", value: "email", note: "the internative's address" },
        { id: "password", action: "type", target: "the password field", value: "password", note: "generated per host" },
        { id: "confirm", action: "type", target: "the confirm password field", value: "password", note: "the same value, typed twice" },
        { id: "google", action: "click", target: "the sign up with google button", optional: true, note: "the alternative, and an existing google account is the owner's" },
        { id: "terms", action: "stop", target: "the privacy and marketing consent statement", owner: true, note: "this page has no terms checkbox: registering is the consent, so the owner reads the sentence before it is pressed" },
        { id: "submit", action: "click", target: "the register button", note: "one click, screenshot either side" },
      ],
    },
    {
      name: "verify",
      steps: [
        { id: "wait", action: "wait", target: "their confirmation email", note: "polled from the internative's inbox" },
        { id: "link", action: "click", target: "the confirmation link", note: "jumpstr.io sender, fresh, not a redirector" },
      ],
    },
    {
      name: "release",
      steps: [
        { id: "label", action: "type", target: "the custom label name", value: "artist_name", note: "their feature list names it, and it is what stores show" },
        { id: "rules", action: "read", target: "the uploader for its own rules", note: "formats and artwork are not published, so they are read here and recorded" },
        { id: "audio", action: "upload", target: "the audio file", value: "audio_master", note: "the accepted format comes from the step above, not from a guess" },
        { id: "art", action: "upload", target: "the artwork file", value: "artwork", note: "square, because the stores are the ones who require it" },
        { id: "details", action: "type", target: "the release title and date", value: "title", note: "no lead time published, so the date is the owner's call" },
        { id: "terms", action: "stop", target: "their distribution terms", owner: true, note: "their terms are theirs to accept" },
        { id: "submit", action: "stop", target: "the submit button", owner: true, note: "one submit, and the release that goes out is the owner press" },
      ],
    },
    {
      name: "claim",
      steps: [
        { id: "isrc", action: "read", target: "the ISRC assigned to the release", note: "recorded now because switching later requires it" },
        { id: "check", action: "wait", target: "the release appearing in stores", note: "their takedown reports make a seven day recheck worth doing" },
        { id: "support", action: "click", target: "the support widget", note: "a missing release is a widget message, not an email address" },
        { id: "spotify", action: "wait", target: "the live release", note: "then the artist claim, with the same name" },
      ],
    },
  ],
};
