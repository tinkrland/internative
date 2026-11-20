import { assertEquals, assert } from "jsr:@std/assert@1";

const corpus = JSON.parse(
  await Deno.readTextFile(new URL("../voice/corpus/prosody_drift.curated.json", import.meta.url)),
);

Deno.test("the prosody corpus keeps only rows whose claim the numbers support", () => {
  assert(corpus.rows.length > 0);
  assertEquals(corpus.rows.length + corpus.dropped.length, 11);
  assertEquals(corpus.same + corpus.different, corpus.rows.length);
  for (const row of corpus.rows) {
    assertEquals(row.verdict !== "drop", true);
    assertEquals(row.curated_same, row.measured_moved.length === 0);
  }
});

Deno.test("a measured block is compared in its own units, not in prose", () => {
  for (const row of corpus.rows) {
    assert(Object.keys(row.block).length === 4, "f0 median, span, rate, pause");
    assert(row.reason.length > 0);
    if (!row.curated_same) assert(row.measured_moved.length > 0);
  }
  assert(corpus.finding.includes("competing number with a unit"));
});
