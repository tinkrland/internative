// routenote, from their own Upload Guide (support.routenote.com).
//
// the guide is unusually explicit, so this flow follows their page names exactly:
// release data, album details, audio, artwork, manage stores, localisation,
// finalise. two of those pages carry traps worth a step each: the label name
// cannot be "none" or "unsigned", and a sales start date has to be two weeks out.
import type { DistributorFlow } from "../flow.ts";

export const flow: DistributorFlow = {
  id: "routenote",
  name: "RouteNote",
  host: "routenote.com",
  signup_url: "https://routenote.com/signup_page/design",
  dashboard_url: "https://routenote.com/",
  cost: "free-tier",
  commission_pct: 15,
  lane_default: "browserbase",
  lanes: ["browserbase", "browseruse", "kernel"],
  audio: {
    accepts: ["flac (stereo)", "mp3 320 kbps"],
    stereo: true,
    note: "the free door does not take our 24 bit wav, so the master is transcoded first",
  },
  artwork: { min_pixels: 1600, square: true, note: "their Style Guidelines are linked from the artwork page and win" },
  lead_days: { min: 14, note: "a sales start date must be at least two weeks away" },
  review: { moderation: "their moderation team may ask for fixes before release", live_in: "after moderation clears" },
  verification: { senders: ["routenote.com"], window_minutes: 30 },
  sources: ["https://support.routenote.com/kb-article/routenote-upload-guide/"],
  verified: true,
  note: "free tier keeps 15 percent; UPC and ISRC are generated free if left blank",
  phases: [
    {
      name: "signup",
      steps: [
        { id: "open", action: "navigate", target: "the signup page", note: "read live on 9 nov 2026: username, email, password, confirm, security question, terms" },
        { id: "username", action: "type", target: "the username field", value: "handle", note: "the internative's handle for this host, not its display name" },
        { id: "email", action: "type", target: "the email address field", value: "email", note: "the internative's address, tagged for this host" },
        { id: "password", action: "type", target: "the create password field", value: "password", note: "generated per host by agentid/creds" },
        { id: "confirm", action: "type", target: "the confirm password field", value: "password", note: "the same generated value, typed twice because the page asks twice" },
        { id: "security", action: "read", target: "the security question", note: "their bank of questions; the answer is generated and stored with the credential, never reused across hosts" },
        { id: "newsletter", action: "read", target: "the stay up to date with routenote news checkbox", note: "stay up to date with routenote news is an opt-in, and an opt-in is never ticked" },
        { id: "terms", action: "stop", target: "the terms and conditions checkbox", owner: true, note: "the owner accepts, not the agent" },
        { id: "submit", action: "click", target: "the sign up button", note: "one click, and the screenshot either side is the receipt" },
      ],
    },
    {
      name: "verify",
      steps: [
        { id: "wait", action: "wait", target: "their confirmation email", note: "the inbox is polled, not refreshed by hand" },
        { id: "link", action: "click", target: "the confirmation link", note: "matched by agentid/verify: their domain, fresh, not a redirector" },
      ],
    },
    {
      name: "release",
      steps: [
        { id: "new", action: "click", target: "Distribution, then Create New Release", note: "their guide names both, in that order" },
        { id: "upc", action: "read", target: "the UPC field", note: "left blank so they generate one free; a move from another distributor is the reason to fill it" },
        { id: "title", action: "type", target: "the release title", value: "title", note: "a single puts the track title here" },
        { id: "create", action: "click", target: "Create Release", note: "opens the release in progress page" },
        { id: "album", action: "click", target: "Album Details", note: "the first of the six sections, each saved with Save and Continue" },
        { id: "language", action: "type", target: "the language field", value: "language", note: "must match the lyrics language, so it comes from the release" },
        { id: "artist", action: "type", target: "the artist name", value: "artist_name", note: "the internative, and their artist page is selected or created here" },
        { id: "writers", action: "type", target: "the writers and lyricists", value: "rights_holder", note: "composer and lyricist are named separately, both required" },
        { id: "genre", action: "type", target: "the primary genre", value: "genre", note: "their list, not a free text box" },
        { id: "cline", action: "type", target: "the composition copyright line", value: "rights_holder", note: "the C line, which is who wrote it" },
        { id: "pline", action: "type", target: "the sound recording copyright line", value: "rights_holder", note: "the P line, which is who owns the recording" },
        { id: "label", action: "type", target: "the record label name", value: "artist_name", note: "no label means the artist name, never none, unsigned or N/A" },
        { id: "explicit", action: "click", target: "the explicit, clean or not explicit choice", note: "it is one of the things their moderation flags first" },
        { id: "audio", action: "upload", target: "the audio file", value: "audio_sidecar", note: "the transcoded stereo flac, not the master" },
        { id: "isrc", action: "read", target: "the ISRC field", note: "filled automatically, and a previous code goes here on a move" },
        { id: "art", action: "upload", target: "the artwork file", value: "artwork", note: "square, and their style guide is read before this step, not after a rejection" },
        { id: "stores", action: "click", target: "Select all stores", note: "worldwide means no territories added at all" },
        { id: "terms", action: "stop", target: "the Artist and Label Agreement", owner: true, note: "their terms, and a release cannot be submitted without accepting them" },
        { id: "plan", action: "stop", target: "Distribute Free or Distribute Premium", owner: true, note: "the choice that decides the 15 percent, so it is the owner's" },
      ],
    },
    {
      name: "claim",
      steps: [
        { id: "spotify", action: "click", target: "the Spotify artist page link in release metadata", note: "their guide offers select or create, and creating is the first release" },
        { id: "wait", action: "wait", target: "the moderation response", note: "they may ask for fixes, and a silent queue is not an approval" },
      ],
    },
  ],
};
