// soundon, the one route that is signed in through another product.
//
// tiktok owns soundon and says so on every page, so the account is created inside
// the tiktok ecosystem rather than in a form of its own. that has two consequences
// worth a step each: the phone demand lives inside the tiktok panel, and their
// public help material is a forum of search shaped articles rather than a help
// centre, so the upload page field set is the one thing still unmapped.
import type { DistributorFlow } from "../flow.ts";

export const flow: DistributorFlow = {
  id: "soundon-global",
  name: "SoundOn",
  host: "soundon.global",
  signup_url: "https://www.soundon.global/login/signup",
  dashboard_url: "https://www.soundon.global/",
  cost: "free",
  commission_pct: 0,
  lane_default: "browserbase",
  lanes: ["browserbase", "browseruse", "kernel"],
  audio: {
    accepts: ["to be read from the uploader"],
    stereo: true,
    note: "wav is the safe assumption, but nothing published states it, so the uploader is read",
  },
  artwork: {
    min_pixels: 1600,
    square: true,
    note: "1600 square is the figure their own art article gives, and their stores accept it",
  },
  lead_days: { min: 7, note: "a week is the conservative reading; no published figure for their review" },
  review: { moderation: "their review sits between submit and delivery", live_in: "not published, so a week is assumed rather than promised" },
  verification: { senders: ["soundon.global", "tiktok.com"], window_minutes: 30 },
  sources: ["https://www.soundon.global/login/signup", "https://www.soundon.global/forum/music-cover-art-maker?lang=en"],
  verified: true,
  note: "partially mapped: signup entry and artwork floor are seen, the upload field set is not, so no run should claim it is mapped",
  phases: [
    {
      name: "signup",
      steps: [
        { id: "open", action: "navigate", target: "the sign up entry", note: "read live on 9 nov 2026: with email or with phone, a code, no password anywhere" },
        { id: "email-tab", action: "click", target: "the with email tab", note: "the phone tab beside it wants a number, which is not the internative's to give" },
        { id: "region", action: "read", target: "the registered in united states sentence", note: "it says you will be registered in the chosen country, so the owner sets it rather than a default" },
        { id: "email", action: "type", target: "the email address field", value: "email", note: "the internative's address, tagged for this host" },
        { id: "send-code", action: "click", target: "the send code button", note: "soundon has no password: the account is the mailbox" },
        { id: "code", action: "type", target: "the code field", value: "verification_code", note: "read from the inbox by agentid/verify, within the window" },
        { id: "marketing", action: "read", target: "the get emails with trends promotions and account updates checkbox", note: "trends and promotions is an opt-in, and an opt-in is never ticked" },
        { id: "terms", action: "stop", target: "the terms and age confirmation checkbox", owner: true, note: "it confirms 18 plus and accepts their terms, and both are the owner's answers" },
        { id: "create", action: "click", target: "the create an account button", note: "one click, screenshot either side" },
        { id: "tiktok", action: "click", target: "the continue with tiktok panel", optional: true, note: "the other door, if the owner prefers an existing tiktok account to a mailbox" },
        { id: "google", action: "click", target: "the continue with google panel", optional: true, note: "the third door, and the same caveat" },
        { id: "social-stop", action: "stop", target: "an existing social login inside a panel", owner: true, note: "an existing account is the owner's to authorise, whichever door is used" },
      ],
    },
    {
      name: "verify",
      steps: [
        { id: "wait", action: "wait", target: "a confirmation email", note: "only if their form sends one, which the tiktok route may not" },
        { id: "link", action: "click", target: "the confirmation link", value: "verification_link", note: "soundon or tiktok sender, matched by agentid/verify" },
      ],
    },
    {
      name: "release",
      steps: [
        { id: "new", action: "click", target: "the create release control in the dashboard", note: "unmapped: the dashboard is behind the tiktok sign in" },
        { id: "unmapped", action: "stop", target: "the upload field set", owner: true, note: "this flow is not mapped past here, on purpose, until someone reads the real page" },
        { id: "audio", action: "upload", target: "the audio file", value: "audio_master", note: "the accepted format comes from the uploader on the day" },
        { id: "art", action: "upload", target: "the artwork file", value: "artwork", note: "1600 square, from their own art article" },
        { id: "stores", action: "read", target: "the store selection", note: "tiktok, capcut and the usual stores are the reason to pick soundon" },
        { id: "terms", action: "stop", target: "their distribution terms", owner: true, note: "their terms, and the owner accepts them" },
        { id: "submit", action: "stop", target: "the submit button", owner: true, note: "one submit, and the release that goes out is the owner press" },
      ],
    },
    {
      name: "claim",
      steps: [
        { id: "tiktok-profile", action: "click", target: "the tiktok artist profile claim", note: "soundon advertises this as part of the deal, and it is theirs to link" },
        { id: "spotify", action: "wait", target: "the live release", note: "then spotify for artists, with the same artist name" },
        { id: "recheck", action: "wait", target: "the release in stores", note: "a week later, because their review publishes no timing" },
      ],
    },
  ],
};
