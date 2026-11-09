// what survives the signup: a record, a name for the secret, and a rule about reuse.
//
// the value never lives here. this branch produces the NAME of an env var and the
// fact that a credential exists, which is exactly what the presence registry on the
// head stores, and nothing more.

export interface CredentialRecord {
  host: string;
  account: string;
  env_name: string;
  password_fingerprint: string;
  created_at: string;
  rotated_at?: string;
}

export function fingerprint(password: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < password.length; i++) {
    h1 = Math.imul(h1 ^ password.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 ^ password.charCodeAt(password.length - 1 - i), 16777619) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

export function envNameFor(host: string): string {
  const slug = host.toLowerCase().replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]/g, "_").toUpperCase();
  return `${slug}_PASSWORD`;
}

const SECRET_SHAPED = [/^[A-Za-z0-9_\-]{32,}$/, /^(sk|pk|bb|gh|AQ)[._-]/i, /^[A-Za-z0-9+/]{40,}={0,2}$/];

export function looksLikeSecret(value: string): boolean {
  return SECRET_SHAPED.some((r) => r.test(value));
}

export function credentialProblems(rec: CredentialRecord, all: CredentialRecord[]): string[] {
  const problems: string[] = [];
  if (!rec.host?.trim()) problems.push("no host, so nobody knows which door this opens");
  if (!rec.account?.trim()) problems.push("no account name");
  if (!/^[A-Z][A-Z0-9_]*_PASSWORD$/.test(rec.env_name ?? "")) problems.push(`${rec.env_name}: not an env var name`);
  if (looksLikeSecret(rec.env_name ?? "")) problems.push("the env field holds a value, and values do not belong in a record");

  const twins = all.filter((r) => r.password_fingerprint === rec.password_fingerprint && r.host !== rec.host);
  if (twins.length) {
    problems.push(`same password as ${twins.map((t) => t.host).join(", ")}: one breach would open both`);
  }
  const duplicate = all.filter((r) => r.host === rec.host && r.account === rec.account && r !== rec);
  if (duplicate.length) problems.push(`${rec.host}: two records for one account`);
  return problems;
}

// rotation is a fact with a date, not a hope
export function needsRotation(rec: CredentialRecord, now: string, max_days = 180): boolean {
  const since = Date.parse(rec.rotated_at ?? rec.created_at);
  if (!Number.isFinite(since)) return true;
  return Date.parse(now) - since > max_days * 86_400_000;
}
