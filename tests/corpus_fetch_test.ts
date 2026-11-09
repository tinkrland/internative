import { assertEquals, assert } from "jsr:@std/assert@1";
import { rowsFromJsonl, promptBody, completionJson, completionsJson } from "../tools/corpus-fetch.ts";

// the shape the provider actually sends: a header record, then two quoted fields per row,
// with newlines and doubled quotes inside them.
const download = `enhanced_prompt,enhanced_completion
"outer: oatmeal coat
fit: relaxed","{""rewrite"": ""a coat"", ""human_same"": true}"
"piece: huggie hoops
metal: sterling silver","{""rewrite"": ""hoops"", ""human_same"": true}"`;

Deno.test("a quoted newline is part of the field, not the end of a row", () => {
  const rows = rowsFromJsonl(download);
  assertEquals(rows.length, 2, "two rows, however many lines the blocks take");
  assert(rows[0].prompt.startsWith("outer: oatmeal coat"));
  assert(rows[0].prompt.includes("\n"), "the block keeps its newline");
  assertEquals(rows[1].prompt.split("\n")[1], "metal: sterling silver");
  assertEquals(JSON.parse(rows[0].completion).human_same, true);
});

Deno.test("doubled quotes come back as one quote", () => {
  const rows = rowsFromJsonl(`a,b\n"he said ""no"" twice","{}"`);
  assertEquals(rows[0].prompt, 'he said "no" twice');
});

Deno.test("the header record is not a row", () => {
  assertEquals(rowsFromJsonl("enhanced_prompt,enhanced_completion\n"), []);
});

Deno.test("the generator's own instructions are cut, because they were never the block", () => {
  const prompt = "outer: oatmeal coat\nfit: relaxed\n\nCreate a JSON output for this editorial brief";
  assertEquals(promptBody(prompt), "outer: oatmeal coat\nfit: relaxed");
  assertEquals(promptBody("outer: coat"), "outer: coat");
});

Deno.test("a fenced completion is still a completion", () => {
  const raw = '```json\n{\n  "rewrite": "a coat",\n  "changed_fields": [],\n  "human_same": true\n}\n```';
  const parsed = completionJson(raw);
  assertEquals(parsed?.human_same, true);
  assertEquals(parsed?.rewrite, "a coat");
});

Deno.test("prose instead of json is reported as nothing, not as a row with empty fields", () => {
  assertEquals(completionJson("Sure! Here is the JSON you asked for."), null);
  assertEquals(completionJson(""), null);
});

Deno.test("one prompt can come back with several completions", () => {
  const raw = '```json\n[{"human_same": true, "changed_fields": ["case"]}, {"human_same": true, "changed_fields": ["case"]}]\n```';
  assertEquals(completionsJson(raw).length, 2);
});

Deno.test("a completion that echoes the block first still parses from its first brace", () => {
  const raw = 'device: iphone 13, graphite\ncase: walnut\n{"rewrite": "a case", "human_same": true}';
  assertEquals(completionsJson(raw).length, 1);
  assertEquals(completionsJson(raw)[0].human_same, true);
});

Deno.test("prose with no object at all yields nothing", () => {
  assertEquals(completionsJson("Here is the JSON you asked for:"), []);
});
