// publishing: whether a mouth is allowed to leave the house.
//
// a content pipeline renders and stops. a personality has accounts, and
// the honest question is not "can it post" but "under what permission".
// the answer is per persona, in the manifest, with a default that cannot
// leak: draft mode, owner approval required.
//
// three modes:
// - draft: nothing leaves. every artifact is a file waiting for a human.
// - scheduled: the owner approved a QUEUE (a calendar of slots and the
//   persona fills them). individual artifacts still honor
//   requires_owner_approval when it is set.
// - live: the persona may publish on its own. this is a deliberate,
//   loud configuration choice, never a default and never inferred.
//
// platforms additionally require credentials that live in env, never in
// the manifest and never in the repo. a mode of live with no token is
// still a draft, and the caller is told so rather than failing mid-post.

import type { PersonaManifest } from "../persona/schema.ts";

export interface PersonaPublishDecision {
  mode: "draft" | "scheduled" | "live";
  requiresOwnerApproval: boolean;
  // true only when the artifact may actually be sent. @approved is the
  // owner's approval for THIS artifact, not for the persona in general.
  allowed(approved?: boolean): boolean;
  // one line a receipt or a dry run shows.
  describe(): string;
}

export function publishingDecision(persona: PersonaManifest): PersonaPublishDecision {
  const pub = persona.publishing ?? { mode: "draft" as const, requires_owner_approval: true };
  const mode = pub.mode;
  const requiresOwnerApproval = pub.requires_owner_approval;
  return {
    mode,
    requiresOwnerApproval,
    allowed(approved = false) {
      if (mode === "draft") return false;
      if (requiresOwnerApproval && !approved) return false;
      return true;
    },
    describe() {
      if (mode === "draft") return "draft only, nothing leaves the house";
      if (mode === "scheduled") {
        return requiresOwnerApproval
          ? "scheduled, and each artifact still needs owner approval"
          : "scheduled from the approved queue, no per-artifact review";
      }
      return requiresOwnerApproval
        ? "live, but each artifact needs owner approval (a contradiction worth fixing in the manifest)"
        : "live, publishing without review";
    },
  };
}

// the gate a platform adapter calls before it sends anything. a missing
// credential is a refusal with a reason, not an exception thrown after
// half a publish.
export function canPublishTo(
  decision: PersonaPublishDecision,
  env: { token?: string | null; approved?: boolean } = {},
): { ok: boolean; reason: string } {
  if (!decision.allowed(env.approved)) {
    return { ok: false, reason: `publishing blocked: ${decision.describe()}` };
  }
  if (!env.token) {
    return { ok: false, reason: "publishing blocked: no credential for this platform" };
  }
  return { ok: true, reason: "publishing allowed" };
}
