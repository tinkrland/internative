// the verification email, and the three ways this goes wrong.
//
// it goes wrong by opening a link that was not from the site, by opening a link
// that goes somewhere else, and by opening a link that is really a login page in a
// costume. all three are checkable before anything is clicked.

export interface MailMessage {
  from: string;
  subject: string;
  received_at: string;
  text: string;
}

export type VerificationResult =
  | { kind: "link"; value: string; why: string }
  | { kind: "code"; value: string; why: string }
  | { kind: "none"; why: string };

const SHORTENERS = ["bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "buff.ly", "rebrand.ly", "cutt.ly", "is.gd"];
const LOGIN_SHAPED = ["/login", "/signin", "/sign-in", "/account/login", "/password", "/reset", "/forgot"];
const VERIFY_SHAPED = ["verif", "confirm", "activate", "validate", "welcome", "account"];

export function hostMatches(host: string, allowed: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  const a = allowed.toLowerCase().replace(/^www\./, "");
  return h === a || h.endsWith("." + a);
}

export function linksIn(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
  return matches.map((m) => m.replace(/[.,;)]+$/, ""));
}

export function codesIn(text: string): string[] {
  const matches = text.match(/\b(\d{4,8})\b/g) ?? [];
  return [...new Set(matches)];
}

export function findVerification(
  msg: MailMessage,
  target: { host: string; issued_after: string; now: string; window_minutes?: number },
): VerificationResult {
  const windowMs = (target.window_minutes ?? 30) * 60_000;
  const age = Date.parse(target.now) - Date.parse(msg.received_at);
  if (!Number.isFinite(age)) return { kind: "none", why: "the message has no readable date, so it cannot be trusted" };
  if (age < 0) return { kind: "none", why: "the message is dated in the future" };
  if (age > windowMs) return { kind: "none", why: `${Math.round(age / 60000)} minutes old, past the ${target.window_minutes ?? 30} minute window` };
  if (Date.parse(msg.received_at) < Date.parse(target.issued_after)) {
    return { kind: "none", why: "older than the signup attempt, so it belongs to something else" };
  }

  const senderHost = msg.from.split("@").pop() ?? "";
  const senderOk = hostMatches(senderHost, target.host);

  for (const link of linksIn(msg.text)) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      continue;
    }
    const host = url.hostname;
    if (SHORTENERS.some((s) => hostMatches(host, s))) {
      return { kind: "none", why: `the link is a shortener (${host}); a redirector hides where it goes, so it is not opened` };
    }
    if (!hostMatches(host, target.host)) {
      return { kind: "none", why: `the link points at ${host}, not ${target.host}` };
    }
    const path = url.pathname.toLowerCase();
    if (LOGIN_SHAPED.some((p) => path.includes(p)) && !VERIFY_SHAPED.some((p) => path.includes(p))) {
      return { kind: "none", why: `the link is shaped like a login page (${path}), so it goes to the owner instead` };
    }
    return {
      kind: "link",
      value: link,
      why: senderOk ? "from the site, on the site's own host, and shaped like a verification" : `on the site's host, though the sender was ${senderHost}`,
    };
  }

  if (senderOk) {
    const codes = codesIn(msg.text);
    if (codes.length === 1) return { kind: "code", value: codes[0], why: `${senderHost} sent exactly one numeric code` };
    if (codes.length > 1) return { kind: "none", why: `${codes.length} numbers in the message and no way to tell which is the code` };
  }

  return { kind: "none", why: "no link on the target host and no single code from the right sender" };
}
