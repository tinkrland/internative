import { assertEquals, assert } from "jsr:@std/assert@1";
import { digestOf } from "../lock.ts";

interface Row {
  rewrite: string;
  human_same: boolean;
  changed_fields: string[];
}

const corpus = JSON.parse(await Deno.readTextFile("wardrobe/corpus/paraphrase.json")) as {
  locked: string;
  rows: Row[];
};

// the measurement this file exists for: a person accepts a quarter of these rewrites
// as the same garment, and the renderer does not. the lock's answer is not to detect
// the paraphrase better, it is to never paraphrase: the block ships from the lock.
Deno.test("every rewrite is a different string, so no lock could have been reused", async () => {
  const lockedDigest = await digestOf(corpus.locked);
  for (const row of corpus.rows) {
    assert(row.rewrite !== corpus.locked, "a copy of the block is not a paraphrase");
    assert((await digestOf(row.rewrite)) !== lockedDigest, "a rewrite must not digest as the block");
  }
});

Deno.test("the corpus keeps its own labels honest", () => {
  for (const row of corpus.rows) {
    if (row.human_same) assertEquals(row.changed_fields, [], `"${row.rewrite}" is labelled same but changes ${row.changed_fields}`);
    else assert(row.changed_fields.length > 0, `"${row.rewrite}" is labelled different and names no field`);
  }
  const same = corpus.rows.filter((row) => row.human_same).length;
  assert(same > 0 && same < corpus.rows.length, "a corpus that is all one answer proves nothing");
});

Deno.test("the failures a rewrite actually introduces are the ones the rules already refuse", () => {
  const named = new Set(corpus.rows.flatMap((row) => row.changed_fields));
  for (const field of named) {
    assert(["colour", "fabric", "fit", "details", "kind", "avoid"].includes(field), `unexpected field "${field}"`);
  }
});
