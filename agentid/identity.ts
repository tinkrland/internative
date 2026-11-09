// who the account is for, and what an internative may honestly say about itself.
//
// an internative is not a person. every account it holds was opened by the person
// behind it, under that person's name where a platform asks for a legal identity,
// and under the internative's name where a platform asks for a display name. the
// one thing it never does is claim to be a human when a form is asking precisely
// that question.

export interface FormIdentity {
  display_name: string;
  email: string;
  username_candidates: string[];
}

export interface SignupAuthority {
  // the human or entity that owns the account and accepted the terms
  owner: string;
  // what the owner has authorised in writing: which hosts may be signed up to
  authorised_hosts: string[];
  // a legal identity may only be supplied by the owner, never invented
  may_supply_legal_name: boolean;
  verified_against_tos: boolean;
}

export function identityProblems(identity: FormIdentity): string[] {
  const problems: string[] = [];
  if (!identity.display_name?.trim()) problems.push("no display name, so the account has no name");
  const at = identity.email?.indexOf("@") ?? -1;
  if (at < 1 || at === identity.email.length - 1) problems.push(`"${identity.email}" is not an address`);
  if (!identity.username_candidates?.length) problems.push("no username candidates, so the first availability miss ends the run");
  for (const candidate of identity.username_candidates ?? []) {
    if (!/^[a-z0-9._-]{3,30}$/i.test(candidate)) problems.push(`${candidate}: not a handle a form will accept`);
  }
  return problems;
}

export function authorityProblems(authority: SignupAuthority): string[] {
  const problems: string[] = [];
  if (!authority.owner?.trim()) problems.push("no owner, so nobody can accept anything");
  if (!authority.authorised_hosts?.length) problems.push("no authorised hosts, so every signup is unauthorised");
  if (!authority.verified_against_tos) problems.push("nobody read the host's terms before automating it");
  return problems;
}

export function hostAuthorised(authority: SignupAuthority, host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return authority.authorised_hosts.some((a) => {
    const allowed = a.toLowerCase().replace(/^www\./, "");
    return h === allowed || h.endsWith("." + allowed);
  });
}

// the address a form is filled with is the internative's own, never the owner's:
// the owner's address is where receipts go, not who is acting.
export function addressFor(identity: FormIdentity, host: string): string {
  const [local, domain] = identity.email.split("@");
  const tag = host.toLowerCase().replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]/g, "").slice(0, 20);
  return tag ? `${local}+${tag}@${domain}` : identity.email;
}
