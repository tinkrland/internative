// cookie banners and newsletter boxes, ported from prixie.
//
// these are not new decisions. prixie settled them against real pages and the
// owner's rulings, so the rules are carried over in behaviour and named with their
// origin, because a second opinion here would only be a second guess.

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const REJECT_LABELS = ["reject all", "reject all cookies", "reject", "decline all", "decline", "refuse", "deny", "disagree"];
const NECESSARY_ONLY_LABELS = ["only necessary", "necessary only", "essential only", "strictly necessary", "only essential", "continue without accepting"];
const CLOSE_LABELS = ["close", "dismiss", "got it", "okay", "no thanks"];

export interface ConsentChoice {
  action: "click" | "none";
  label?: string;
  why: string;
}

// precedence is the whole point: rejecting is always available before
// necessary-only, and necessary-only before a close, and an accept-only banner
// is never clicked at all.
export function consentChoice(labels: string[]): ConsentChoice {
  const usable = labels.filter((l) => norm(l).length > 0 && norm(l).length <= 60);
  for (const l of usable) if (REJECT_LABELS.some((t) => norm(l).includes(t))) return { action: "click", label: l, why: "reject all wins" };
  for (const l of usable) if (NECESSARY_ONLY_LABELS.some((t) => norm(l).includes(t))) return { action: "click", label: l, why: "necessary only, never analytics" };
  for (const l of usable) if (CLOSE_LABELS.some((t) => norm(l) === t || norm(l).startsWith(t))) return { action: "click", label: l, why: "close, which is not consent" };
  return { action: "none", why: "an accept-only banner stays standing, and the receipt says so" };
}

const NEWSLETTER_MARKERS = [
  "newsletter", "mailing list", "marketing", "promotional", "product updates",
  "email updates", "stay up to date", "stay informed", "subscribe", "opt in",
];

const OPT_OUT_MARKERS = [
  "do not wish", "do not want", "do not receive", "dont wish", "dont want",
  "not to be added", "not to receive", "opt out", "unsubscribe", "no thanks",
  "stop receiving", "rather not", "prefer not",
];

export function newsletterOptIn(text: string): boolean {
  const t = norm(text).replace(/[_\-.]+/g, " ");
  if (!t) return false;
  return NEWSLETTER_MARKERS.some((m) => t.includes(m));
}

// "tick if you do NOT wish to receive" is the box that keeps the address off the
// list, and it is the only newsletter box that ever gets clicked.
export function newsletterDirection(text: string): "opt_in" | "opt_out" | "none" {
  const t = norm(text).replace(/[_\-.]+/g, " ").replace(/['’]/g, "");
  if (!t) return "none";
  if (OPT_OUT_MARKERS.some((m) => t.includes(m))) return "opt_out";
  if (NEWSLETTER_MARKERS.some((m) => t.includes(m))) return "opt_in";
  return "none";
}

export interface NewsletterAction {
  box: string;
  want: "tick" | "untick";
  why: string;
}

// a checkbox list becomes actions. opt-in boxes are unticked even when the site
// pre-ticked them: that tick is the site's yes, not ours.
export function newsletterActions(
  boxes: Array<{ label: string; checked: boolean }>,
): NewsletterAction[] {
  const actions: NewsletterAction[] = [];
  for (const box of boxes) {
    const dir = newsletterDirection(box.label);
    if (dir === "opt_out" && !box.checked) {
      actions.push({ box: box.label, want: "tick", why: "tick this and the address stays off the list" });
    }
    if (dir === "opt_in" && box.checked) {
      actions.push({ box: box.label, want: "untick", why: "the site ticked it; that is the site's yes, not ours" });
    }
  }
  return actions;
}
