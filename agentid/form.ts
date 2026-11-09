// what a signup page is asking for, and in what order it asks.
//
// the flow rules are prixie's (isFlowingForm, flowActionFor): a screen with a
// submit-shaped button is the last screen, and a screen with neither submit nor
// advance is where the truth stops. the field reading is new, because an account
// form asks for more than an attendance form ever did.

export const FLOWING_HOSTS = ["typeform.com", "surveymonkey.com", "jotform.com", "tally.so"];

export function isFlowingForm(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return FLOWING_HOSTS.some((f) => host === f || host.endsWith("." + f));
  } catch {
    return false;
  }
}

const SUBMIT_TEXTS = ["create account", "sign up", "signup", "register", "submit", "join now", "get started", "continue", "create my account"];
const ADVANCE_TEXTS = ["next", "continue", "verify", "send code"];

// submit beats advance: a screen offering both is the last screen, and clicking
// next there would loop. a screen offering neither is where we stop.
export function flowActionFor(buttonTexts: string[]): { act: "submit" | "advance" | "stuck"; label?: string } {
  const labels = buttonTexts.map((t) => t.toLowerCase().trim());
  const submit = labels.find((l) => SUBMIT_TEXTS.some((t) => l === t || l.includes(t)));
  if (submit) return { act: "submit", label: submit };
  const advance = labels.find((l) => ADVANCE_TEXTS.some((t) => l === t));
  if (advance) return { act: "advance", label: advance };
  return { act: "stuck" };
}

export type FieldKind =
  | "email" | "password" | "password_confirm" | "username" | "name"
  | "dob" | "phone" | "captcha" | "terms" | "payment" | "otp" | "unknown";

// ordered by what hurts to get wrong: a captcha or a card demand ends the run, so
// it is looked for before anything is typed.
const FIELD_MARKERS: Array<{ kind: FieldKind; markers: string[] }> = [
  { kind: "captcha", markers: ["captcha", "recaptcha", "hcaptcha", "turnstile", "are you human", "not a robot"] },
  { kind: "payment", markers: ["card number", "credit card", "cardholder", "cvv", "billing", "payment method", "iban"] },
  { kind: "phone", markers: ["phone", "mobile", "cell", "telephone", "sms"] },
  { kind: "otp", markers: ["one-time code", "verification code", "6-digit", "enter the code", "authenticator"] },
  { kind: "terms", markers: ["terms of service", "terms and conditions", "privacy policy", "i agree", "i accept"] },
  { kind: "dob", markers: ["date of birth", "birthday", "dob", "birth date"] },
  { kind: "password_confirm", markers: ["confirm password", "repeat password", "password again"] },
  { kind: "password", markers: ["password", "passphrase"] },
  { kind: "email", markers: ["email", "e-mail"] },
  { kind: "username", markers: ["username", "handle", "display name", "screen name", "user name"] },
  { kind: "name", markers: ["first name", "last name", "full name", "your name", "name"] },
];

// returned in severity order rather than page order: a caller that reads the list
// from the front meets the captcha before the password, which is the order the
// decisions need and never the order the page happens to use.
const FIELD_ORDER: FieldKind[] = FIELD_MARKERS.map((m) => m.kind);

export function readFields(labels: string[]): FieldKind[] {
  const found = new Set<FieldKind>();
  for (const raw of labels) {
    const t = raw.toLowerCase();
    for (const { kind, markers } of FIELD_MARKERS) {
      if (markers.some((m) => t.includes(m))) {
        found.add(kind);
        break;
      }
    }
  }
  return [...found].sort((a, b) => FIELD_ORDER.indexOf(a) - FIELD_ORDER.indexOf(b));
}

// the fields an internative may fill itself, and the ones that end the run
export const SELF_SERVICE_FIELDS: FieldKind[] = ["email", "password", "password_confirm", "username", "name"];
export const HANDOFF_FIELDS: FieldKind[] = ["captcha", "payment", "phone", "otp", "dob", "terms", "unknown"];

export function handoffFields(fields: FieldKind[]): FieldKind[] {
  return fields.filter((f) => HANDOFF_FIELDS.includes(f));
}
