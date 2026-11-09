import { assertEquals, assert } from "jsr:@std/assert@1";
import { digestOf } from "../lock.ts";

interface Row {
  locked: string;
  rewrite: string;
  generated_same_garment?: boolean;
  human_same: boolean;
  changed_fields: string[];
  why?: string;
}

interface Corpus {
  locked?: string;
  source?: Record<string, unknown>;
  rows: Row[];
}

const read = async (path: string) => JSON.parse(await Deno.readTextFile(path)) as Corpus;

const hand = await read("wardrobe/corpus/paraphrase.json");
const invented = await read("wardrobe/corpus/paraphrase.invented.json");

const corpora = [hand, invented];

// every row of both corpora, with the block it re-describes. the hand corpus shares
// one block; the invented one carries a block per row.
function rowsOf(corpus: Corpus): Row[] {
  return corpus.rows.map((row) => ({ ...row, locked: row.locked ?? corpus.locked ?? "" }));
}

const all = corpora.flatMap(rowsOf);

// the measurement these files exist for: a person accepts most of these rewrites as
// the same garment, and the renderer does not. the lock's answer is not to detect the
// paraphrase better, it is to never paraphrase: the block ships from the lock.
Deno.test("every rewrite is a different string, so no lock could have been reused", async () => {
  for (const row of all) {
    assert(row.locked.trim().length > 0, "a row with no locked block cannot be measured");
    assert(row.rewrite !== row.locked, "a copy of the block is not a paraphrase");
    assert((await digestOf(row.rewrite)) !== (await digestOf(row.locked)), "a rewrite must not digest as the block");
  }
});

Deno.test("the corpora keep their own labels honest", () => {
  for (const row of all) {
    if (row.human_same) {
      assertEquals(row.changed_fields, [], `"${row.rewrite}" is labelled same but changes ${row.changed_fields}`);
    } else {
      assert(row.changed_fields.length > 0, `"${row.rewrite}" is labelled different and names no field`);
      assert((row.why ?? "").trim().length > 10, `"${row.rewrite}" is relabelled without a reason`);
    }
  }
  for (const corpus of corpora) {
    const same = rowsOf(corpus).filter((row) => row.human_same).length;
    assert(same > 0 && same < corpus.rows.length, "a corpus that is all one answer proves nothing");
  }
});

// the finding that matters for an autonomous run: the generator asked to judge its own
// rewrite labelled every row the same garment, and three of them had moved. a model
// grading its own paraphrase is not the gate; the lock is.
Deno.test("the generator's self-labels are not a gate: it said same twelve times and drifted three", () => {
  const generated = invented.rows.filter((row) => row.generated_same_garment === true).length;
  const human = invented.rows.filter((row) => row.human_same).length;
  assertEquals(generated, invented.rows.length);
  assertEquals(human, 9);
  const disagreements = invented.rows.filter((row) => row.generated_same_garment !== row.human_same);
  assertEquals(disagreements.length, 3);
  for (const row of disagreements) assert(["fit", "kind"].includes(row.changed_fields[0]), "an unexpected kind of drift");
});

Deno.test("the fields a rewrite can move are the ones the item rules already govern", () => {
  const named = new Set(all.flatMap((row) => row.changed_fields));
  for (const field of named) {
    assert(["colour", "fabric", "fit", "details", "kind", "avoid"].includes(field), `unexpected field "${field}"`);
  }
});

Deno.test("the invented corpus records where it came from, because a corpus without provenance is folklore", () => {
  const source = invented.source ?? {};
  assertEquals(source["provider"], "adaption labs");
  assertEquals(source["dataset_id"], "26572b6e-dbcc-415a-83dc-12d8df2ac01f");
  assertEquals(source["rows"], 12);
  assert(String(source["took"] ?? "").includes("two hours"), "how long it took is part of the record");
});
