// connections: identity anchors, expanded for a personality with more
// rooms than a meeting proxy had.
//
// the question this answers: a surface holds a HANDLE (an email, a
// discord id, an x handle, a phone number) and has to know WHO that is,
// so a second conversation is a continuation instead of a cold start.
// that is the difference between a bot that posts and a personality
// with a memory.
//
// the anchors are CONFIGURATION, not code: CLAWBUZZ_CONNECTIONS is a
// json array in env, one entry per person (id, label, owner flag, the
// handles they hold per platform). real handles never appear in the
// repo. unset config means no anchors, which means every session stays
// honestly unanchored: an unknown person is treated as unknown.
//
// the python mirror lives in retelldb (models/connections.py +
// routing/scope.py). the two sides must agree on normalization, or the
// same person resolves differently on the write side and the read side.

export interface Connection {
  id: string;
  label: string;
  // owner = the persona's OWN accounts (its x handle, its discord).
  // the persona's own words are never mistaken for a stranger's.
  owner?: boolean;
  handles: Record<string, string[]>;
}

// every platform the anchors can cover. the class decides privacy, not
// the brand name.
export const PLATFORMS = [
  // meetings
  "zoom",
  "google_meet",
  "teams",
  "webex",
  "ringcentral",
  // private
  "discord",
  "slack",
  "whatsapp",
  "imessage",
  "telegram",
  "signal",
  "email",
  "phone",
  // public social, the surfaces a personality broadcasts on
  "twitch",
  "kick",
  "youtube",
  "tiktok",
  "instagram",
  "x",
  "bluesky",
  "threads",
  "linkedin",
  "pinterest",
  "facebook",
  "spotify",
  "apple_podcasts",
  "rss",
  // owned
  "website",
] as const;

export type Platform = (typeof PLATFORMS)[number];

const PRIVATE_PLATFORMS = new Set([
  "discord",
  "slack",
  "whatsapp",
  "imessage",
  "telegram",
  "signal",
  "email",
  "phone",
]);
const MEETING_PLATFORMS = new Set(["zoom", "google_meet", "teams", "webex", "ringcentral"]);
const PUBLIC_SOCIAL_PLATFORMS = new Set([
  "twitch",
  "kick",
  "youtube",
  "tiktok",
  "instagram",
  "x",
  "bluesky",
  "threads",
  "linkedin",
  "pinterest",
  "facebook",
  "spotify",
  "apple_podcasts",
  "rss",
]);

export type PlatformClass = "private" | "meeting" | "public_social" | "website" | "unknown";

// an unknown platform is unknown on purpose (the caller gets "unknown",
// not a default), because the read rules drop everything for it.
export function platformClass(platform: string | undefined | null): PlatformClass {
  if (!platform) return "unknown";
  const p = platform.trim().toLowerCase();
  if (PRIVATE_PLATFORMS.has(p)) return "private";
  if (MEETING_PLATFORMS.has(p)) return "meeting";
  if (PUBLIC_SOCIAL_PLATFORMS.has(p)) return "public_social";
  if (p === "website") return "website";
  return "unknown";
}

// per-platform normalization. the rule both sides share: whatever makes
// two handles the SAME handle gets folded; whatever is identity-bearing
// is never touched.
//
//  - emails (and platforms whose identity IS an email): lowercase, trim
//  - phones (whatsapp/imessage/telegram/signal/phone): digits, keeping
//    a leading + when it was written
//  - discord: ids are digits and usernames fold to lowercase (a
//    username can change; an id cannot)
//  - slack: trim only, never fold case (slack ids are uppercase and
//    folding would collide with handles that are not ids)
//  - social handles (x, bluesky, tiktok, instagram, threads, twitch,
//    kick, youtube, pinterest): strip a leading @, then lowercase. a
//    handle is not a display name here.
//  - everything else: lowercase + trim
export function normalizeHandle(platform: string, handle: string): string {
  const p = (platform || "").trim().toLowerCase();
  const h = (handle || "").trim();
  if (!h) return "";
  if (MEETING_PLATFORMS.has(p) || p === "email") return h.toLowerCase();
  if (p === "whatsapp" || p === "imessage" || p === "telegram" || p === "signal" || p === "phone") {
    const plus = h.startsWith("+") ? "+" : "";
    return plus + h.replace(/[^\d]/g, "");
  }
  if (p === "slack") return h;
  if (PUBLIC_SOCIAL_PLATFORMS.has(p)) return h.replace(/^@+/, "").toLowerCase();
  return h.toLowerCase();
}

// the config loader. json in env, validated hard: a malformed config
// means NO connections (fail closed, warn loudly) rather than a partial
// set that silently anchors the wrong person.
export function parseConnections(raw: string | undefined): Connection[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("clawbuzz: CLAWBUZZ_CONNECTIONS is not valid json; running with no anchors");
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.warn("clawbuzz: CLAWBUZZ_CONNECTIONS is not an array; running with no anchors");
    return [];
  }
  const out: Connection[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const c = entry as Partial<Connection>;
    if (!c.id || typeof c.id !== "string") continue;
    const handles: Record<string, string[]> = {};
    for (const [platform, list] of Object.entries(c.handles || {})) {
      if (!Array.isArray(list)) continue;
      const cleaned = list.filter((x): x is string => typeof x === "string" && x.trim() !== "");
      if (cleaned.length) handles[platform] = cleaned;
    }
    out.push({
      id: c.id,
      label: typeof c.label === "string" ? c.label : c.id,
      owner: c.owner === true,
      handles,
    });
  }
  return out;
}

export function loadConnections(): Connection[] {
  return parseConnections(Deno.env.get("CLAWBUZZ_CONNECTIONS"));
}

export interface Resolution {
  connection: Connection | null;
  // why not, when not. kept so a caller can log an honest reason
  // instead of silently treating a person as a stranger.
  reason: "anchored" | "no_config" | "unknown_handle" | "ambiguous";
}

// resolve who holds this handle on this platform. ambiguity (two
// anchors claiming one handle) resolves to NOBODY: an ambiguous anchor
// is worse than an honest stranger.
export function resolveConnection(
  platform: string,
  handle: string | undefined | null,
  connections?: Connection[],
): Resolution {
  const list = connections ?? loadConnections();
  if (!list.length) return { connection: null, reason: "no_config" };
  const want = normalizeHandle(platform, handle || "");
  if (!want) return { connection: null, reason: "unknown_handle" };
  const matches = list.filter((c) =>
    (c.handles[platform] || []).some((h) => normalizeHandle(platform, h) === want)
  );
  if (matches.length === 1) return { connection: matches[0], reason: "anchored" };
  if (matches.length > 1) return { connection: null, reason: "ambiguous" };
  return { connection: null, reason: "unknown_handle" };
}

// the persona's own handle on a platform, for the surfaces that must
// not answer themselves or treat their own post as a stranger's reply.
export function ownerHandle(
  platform: string,
  personaHandles: Record<string, string | undefined> | undefined,
): string | null {
  const handle = personaHandles?.[platform];
  return handle ? normalizeHandle(platform, handle) : null;
}
