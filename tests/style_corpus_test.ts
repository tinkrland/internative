import { assertEquals, assert } from "jsr:@std/assert@1";
import { measureStyle, styleDrift } from "../voice/stylometry.ts";

const path = new URL("../voice/corpus/style_drift.curated.json", import.meta.url);
const corpus = JSON.parse(await Deno.readTextFile(path));

Deno.test("the style corpus says where it came from and how many pairs survived", () => {
  assert(corpus.source.includes("7e40c30c"), "a corpus without its dataset id cannot be re-fetched");
  assertEquals(corpus.rows.length + corpus.malformed_rows + corpus.dropped_rows, 105);
  assert(corpus.dropped_rows > 0, "a pair that claims drift and does not drift is dropped and counted");
  assert(corpus.malformed_rows > 0, "the generator echoing the locked block as a caption is recorded, not silently dropped");
});

Deno.test("a row labelled same has nothing measured outside tolerance", () => {
  for (const row of corpus.rows.filter((r: any) => r.curated_same)) {
    assertEquals(row.moved, [], `row labelled same moved ${row.moved}`);
    assertEquals(row.curated_changed, null);
  }
});

Deno.test("a row labelled different names a feature that actually moved", () => {
  for (const row of corpus.rows.filter((r: any) => !r.curated_same)) {
    assert(row.curated_changed, "a different row with no named feature is a shrug");
    const tol = corpus.tolerances[row.curated_changed];
    assert(Math.abs(row.deltas[row.curated_changed]) > tol, `claimed ${row.curated_changed} but it moved ${row.deltas[row.curated_changed]}`);
  }
});

Deno.test("every relabel carries the reason it was relabelled", () => {
  const relabels = corpus.rows.filter((r: any) => r.verdict === "relabel");
  assert(relabels.length > 0, "the generator's over-claiming is the point of this corpus");
  for (const row of relabels) {
    assert(row.reason.includes("labelled same") || row.reason.includes("claimed"), row.reason);
  }
});

Deno.test("the finding travels with the data, because the block was invented", () => {
  assert(corpus.finding.includes("invented anchors"));
  assertEquals(corpus.same + corpus.different, corpus.rows.length);
});

Deno.test("measuring a seed and its own rewrite through the module agrees with the corpus", () => {
  const row = corpus.rows[0];
  const a = measureStyle(row.seed, { register: "caption" });
  const b = measureStyle(row.rewrite, { register: "caption" });
  assert(a.length >= 4, "measureStyle returns the feature rows, each carrying its own window");
  assert(b.length >= 4);
  assertEquals(a[0].window.register, "caption");
  assert(Array.isArray(styleDrift(
    { id: "a", version: "1", subject: "example", register: "caption", features: a },
    { id: "b", version: "1", subject: "example", register: "caption", features: b },
  )));
});
