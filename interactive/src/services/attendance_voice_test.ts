import { assertEquals } from "jsr:@std/assert@1";
import { ATTENDANCE_CEILING, attendanceMessage, closureMessage } from "./attendance_voice.ts";
import { loadPersonaFile } from "../../../persona/loader.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");

Deno.test("the join line is the persona speaking, not a scheduler string", () => {
  const line = attendanceMessage(persona, { formUrl: "https://forms.example/attendance" });
  assertEquals(line.text.startsWith(`hi, i am ${persona.display_name}`), true);
  assertEquals(line.text.includes("https://forms.example/attendance"), true);
  assertEquals(line.register.length > 0, true);
});

Deno.test("the disclosure survives a tight register", () => {
  const tight = structuredClone(persona);
  tight.voice.register_by_surface.meetings.max_sentences = 1;
  const line = attendanceMessage(tight, { formUrl: "https://forms.example/x" });
  assertEquals(line.disclosed, true);
  assertEquals(line.text.includes(persona.brand.disclosure), true);
  // the ask is what gets dropped when the register is tighter than the words
  assertEquals(line.text.includes("forms.example"), false);
});

Deno.test("no form means no invented form", () => {
  const line = attendanceMessage(persona);
  assertEquals(line.text.includes("http"), false);
  assertEquals(line.text.includes("sign attendance"), false);
});

Deno.test("the ceiling is a ceiling", () => {
  const long = structuredClone(persona);
  long.brand.disclosure = "x".repeat(600);
  const line = attendanceMessage(long, { formUrl: "https://forms.example/y" });
  assertEquals(line.text.length <= ATTENDANCE_CEILING, true);
  assertEquals(line.disclosed, false);
});

Deno.test("emoji policy is applied, not trusted", () => {
  const noisy = structuredClone(persona);
  noisy.display_name = "buzz 🎉";
  const line = attendanceMessage(noisy, { formUrl: "https://forms.example/z" });
  assertEquals(/[\u{1F300}-\u{1FAFF}]/u.test(line.text), false);
});

Deno.test("the closing line is a receipt, not a summary", () => {
  const bye = closureMessage(persona, { recapUrl: "https://notes.example/recap" });
  assertEquals(bye.includes("https://notes.example/recap"), true);
  assertEquals(bye.includes(persona.display_name), true);
  // no claims about content, only where it lives
  assertEquals(/summar/i.test(bye), false);
});
