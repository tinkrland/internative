// a post, before it goes anywhere.

import { type Destination, DESTINATIONS, destinationProblems, graphemes } from "./destinations.ts";
import type { MediaSurface } from "../media/paths.ts";

export type Approval = "draft" | "approved";

export interface PublishMedia {
  kind: "image" | "video" | "audio";
  ref: string;
  // the description a reader gets when the picture does not load, and the only
  // thing a screen reader has. count it as part of the post, not as metadata.
  alt?: string;
}

export interface PublishPlan {
  persona: string;
  // the number the post belongs to, so a timeline can be audited years later
  aipn: string;
  destination: Destination;
  surface: MediaSurface;
  body: string;
  media: PublishMedia[];
  // what the platform's own generated-content switch is set to, in words
  ai_disclosure: string;
  approval: Approval;
  scheduled_for?: string;
}

export function planProblems(plan: PublishPlan): string[] {
  const problems: string[] = [];
  const spec = DESTINATIONS[plan.destination];
  if (!spec) return [`"${plan.destination}" is not a destination this head knows`];
  problems.push(...destinationProblems(plan.destination));
  if (plan.approval !== "approved") {
    problems.push("approval: a plan that has not been approved does not leave the building");
  }
  if (!/^AIPN-\d{6}$/.test(plan.aipn ?? "")) problems.push("aipn: a post belongs to a numbered person");

  const length = graphemes(plan.body ?? "");
  if (length === 0) problems.push("body: empty");
  if (length > spec.text_chars) problems.push(`body: ${length} graphemes, and ${plan.destination} allows ${spec.text_chars}`);

  for (const item of plan.media ?? []) {
    const allowed: string[] = spec.media;
    const asKind = item.kind === "image" || item.kind === "video" || item.kind === "audio" ? item.kind : "image";
    if (!allowed.includes(asKind) && !(asKind === "image" && allowed.includes("carousel"))) {
      problems.push(`media: ${plan.destination} does not take ${item.kind}`);
    }
    if (!item.ref?.trim()) problems.push("media: a media item with no reference is a picture of nothing");
    if (spec.alt_text_required && !item.alt?.trim()) {
      problems.push(`media: ${plan.destination} wants alt text on every item, and "${item.ref}" has none`);
    }
  }
  const carousel = (plan.media ?? []).length;
  if (spec.carousel_max !== undefined && carousel > spec.carousel_max) {
    problems.push(`media: ${carousel} items, and ${plan.destination} allows ${spec.carousel_max}`);
  }
  if ((plan.media ?? []).length && !spec.media.length) {
    problems.push(`media: ${plan.destination} takes no media at all`);
  }
  if (spec.ai_label === "required" && !plan.ai_disclosure?.trim()) {
    problems.push(`ai_disclosure: ${plan.destination} requires its generated-content flag, and the plan carries no wording for it`);
  }
  return problems;
}

// the key that makes a retry safe. same person, same destination, same words, same
// pictures is the same post, and posting it twice is the oldest bug in social tooling.
export function planKey(plan: PublishPlan): string {
  const media = (plan.media ?? []).map((m) => `${m.kind}:${m.ref}:${m.alt ?? ""}`).join("|");
  return [plan.persona, plan.aipn, plan.destination, plan.surface, plan.body ?? "", media].join("\n");
}
