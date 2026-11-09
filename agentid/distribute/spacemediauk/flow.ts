// spacemedia, from their own FAQ: register, pick a plan, release, their review.
//
// this folder used to hold a template with no sources. their site answers enough
// to be a real flow now: free is zero upfront and keeps the standard royalties,
// every release passes a quality review before delivery, and payouts are from 25
// euros. their upload requirements are still not published, so the flow reads them
// at the uploader instead of asserting them.
import type { DistributorFlow } from "../flow.ts";

export const flow: DistributorFlow = {
  id: "spacemediauk",
  name: "SpaceMedia",
  host: "spacemedia.uk",
  signup_url: "https://spacemedia.uk/",
  dashboard_url: "https://spacemedia.uk/",
  cost: "free",
  commission_pct: 0,
  lane_default: "browserbase",
  lanes: ["browserbase", "browseruse"],
  audio: {
    accepts: ["to be read from the uploader"],
    stereo: true,
    note: "no format list published; the review step is theirs and the uploader is where the rules live",
  },
  artwork: {
    min_pixels: 1400,
    square: true,
    note: "a floor from the stores, unconfirmed by spacemedia, so the uploader is read first",
  },
  lead_days: { min: 0, note: "no lead time published, and their review sits between submit and delivery" },
  review: { moderation: "their team evaluates each upload against quality standards", live_in: "after the review clears, not stated in days" },
  payout: { threshold: "25 EUR", note: "withdrawals from 25 euros, paid within 24 hours of the request" },
  verification: { senders: ["spacemedia.uk"], window_minutes: 30 },
  sources: ["https://spacemedia.uk/"],
  verified: true,
  note: "250 plus platforms, unlimited releases, and a mandatory quality review before anything is delivered",
  phases: [
    {
      name: "signup",
      steps: [
        { id: "open", action: "navigate", target: "the sign up page", note: "their how it works list starts here" },
        { id: "email", action: "type", target: "the email field", value: "email", note: "the internative's address" },
        { id: "password", action: "type", target: "the password field", value: "password", note: "generated per host" },
        { id: "submit", action: "click", target: "the button that creates the account", note: "then the plan choice appears" },
      ],
    },
    {
      name: "verify",
      steps: [
        { id: "wait", action: "wait", target: "their confirmation email", note: "polled from the internative's inbox" },
        { id: "link", action: "click", target: "the confirmation link", note: "spacemedia.uk sender, fresh, not a redirector" },
      ],
    },
    {
      name: "release",
      steps: [
        { id: "plan", action: "click", target: "the free plan", note: "zero upfront and the standard royalties, which is the whole reason for choosing them" },
        { id: "rules", action: "read", target: "the uploader for its own rules", note: "their requirements are not published outside this page" },
        { id: "new", action: "click", target: "create a new release", note: "their step two, in their words" },
        { id: "audio", action: "upload", target: "the audio file", value: "audio_master", note: "format comes from the step above" },
        { id: "art", action: "upload", target: "the artwork file", value: "artwork", note: "square, because every store downstream wants square" },
        { id: "details", action: "type", target: "the title and artist fields", value: "title", note: "artist is the internative" },
        { id: "terms", action: "stop", target: "their distribution terms", owner: true, note: "including the tax position they advertise, which is not the agent's call" },
        { id: "submit", action: "stop", target: "the button that submits for review", owner: true, note: "one submit, then their review is the queue, and the press is the owner" },
      ],
    },
    {
      name: "claim",
      steps: [
        { id: "review", action: "wait", target: "the quality review outcome", note: "a rejection names what to fix, and a resubmission is a new run" },
        { id: "payout", action: "read", target: "the payout settings", note: "from 25 euros, and the account held by the owner" },
        { id: "spotify", action: "wait", target: "the live release", note: "then the artist claim with the same name" },
      ],
    },
  ],
};
