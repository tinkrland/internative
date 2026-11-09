import { assertEquals, assert } from "jsr:@std/assert@1";
import { blockOf, fieldsOf, verdictFor } from "../tools/corpus-curate.ts";

Deno.test("the block is the run of key: value lines, not the first paragraph of instructions", () => {
  const prompt = [
    "I am training a vision-language model to detect discrepancies. Please generate examples.",
    "",
    "BLOCK:",
    "device: iphone 15, midnight",
    "case: walnut brown leather",
    "carried: right hip",
    "",
    "For each example, provide a rewrite.",
  ].join("\n");
  const block = blockOf(prompt);
  assertEquals(block.split("\n").length, 3);
  assertEquals(fieldsOf(block).device, "iphone 15, midnight");
});

Deno.test("a block that is the whole prompt still parses", () => {
  assertEquals(blockOf("piece: huggie hoops\nmaterial: sterling silver\nstyle: minimal").split("\n").length, 3);
});

Deno.test("a device swap is kept when the rewrite really names another device", () => {
  const row = verdictFor(
    { block: "device: iphone 15, midnight\ncase: walnut brown leather", completion: "" },
    "swap",
    { rewrite: "A graphite iPhone 13 in a walnut brown leather case, carried at the right hip", changed_fields: ["device"], human_same: false },
  );
  assertEquals(row.verdict, "keep");
  assertEquals(row.fields_verified, ["device"]);
});

Deno.test("a claim that repeats the block's own device is dropped, however confidently it is labelled", () => {
  const row = verdictFor(
    { block: "device: iphone 15, midnight\ncase: walnut brown leather", completion: "" },
    "swap",
    { rewrite: "A midnight iPhone 15 in a walnut brown leather case, carried at the right hip", changed_fields: ["device"], human_same: false },
  );
  assertEquals(row.verdict, "drop");
  assert(row.reason!.includes("still describes iphone 15"));
});

Deno.test("a case swap is dropped when the same case is described again", () => {
  const row = verdictFor(
    { block: "device: iphone 13, graphite\ncase: walnut brown leather", completion: "" },
    "v2",
    { rewrite: "A graphite iPhone 13 in a worn walnut brown leather case at the right hip", changed_fields: ["case"], human_same: true },
  );
  assertEquals(row.verdict, "drop");
  assert(row.reason!.includes("repeats"));
});

Deno.test("a material swap is kept only when a different material appears", () => {
  const block = "piece: huggie hoops\nmaterial: sterling silver\nstyle: minimal";
  const real = verdictFor({ block, completion: "" }, "s", {
    rewrite: "Huggie hoops in 18k yellow gold, minimal and polished", changed_fields: ["material"], human_same: false,
  });
  assertEquals(real.verdict, "keep");
  const fake = verdictFor({ block, completion: "" }, "s", {
    rewrite: "Huggie hoops in sterling silver, minimal and polished", changed_fields: ["material"], human_same: false,
  });
  assertEquals(fake.verdict, "drop");
});

Deno.test("a style swap is kept only when a different style word appears", () => {
  const block = "piece: signet ring\nmaterial: oxidised brass\nstyle: sculptural";
  const real = verdictFor({ block, completion: "" }, "s", {
    rewrite: "A chunky oxidised brass signet ring", changed_fields: ["style"], human_same: false,
  });
  assertEquals(real.verdict, "keep");
  const fake = verdictFor({ block, completion: "" }, "s", {
    rewrite: "A sculptural oxidised brass signet ring", changed_fields: ["style"], human_same: false,
  });
  assertEquals(fake.verdict, "drop");
});

Deno.test("nothing changed and nothing said is not a usable row", () => {
  const row = verdictFor({ block: "device: iphone 13", completion: "" }, "s", {
    rewrite: "A graphite iPhone 13 on a table beside a cup", changed_fields: [], human_same: false,
  });
  assertEquals(row.verdict, "drop");
});

Deno.test("an empty rewrite is dropped rather than counted as agreement", () => {
  assertEquals(verdictFor({ block: "device: iphone 13", completion: "" }, "s", { rewrite: "", human_same: true }).verdict, "drop");
});

// the relabel side of the curation: the provider said same, the block disagrees, and both
// labels must survive the argument with the reason it happened.

Deno.test("a case swap keeps the object: relabel refuses to call a new case a new phone", () => {
  const row = verdictFor(
    { block: "device: iphone 13, graphite\ncase: walnut brown leather", completion: "" },
    "v2",
    { rewrite: "A graphite iPhone 13 in a frosted hard shell case, carried at the right hip", changed_fields: ["case"], human_same: true },
  );
  assertEquals(row.verdict, "keep");
  assertEquals(row.human_same, true);
  assertEquals(row.generated_same, true);
  assert(row.reason.includes("new dressing"));
});

Deno.test("a device swap cannot be the same object even when the provider says it is", () => {
  const row = verdictFor(
    { block: "device: iphone 13, graphite\ncase: walnut brown leather", completion: "" },
    "v2",
    { rewrite: "A midnight iPhone 15 in a walnut brown leather case, carried at the right hip", changed_fields: ["device"], human_same: true },
  );
  assertEquals(row.verdict, "keep");
  assertEquals(row.human_same, false);
  assertEquals(row.generated_same, true);
  assert(row.reason.includes("different object"));
});

Deno.test("a same row that names brass where the block says gold is relabelled, not trusted", () => {
  const row = verdictFor(
    { block: "piece: signet ring\nmetal: 18k yellow gold", completion: "" },
    "s",
    { rewrite: "A chunky brass signet ring with a flat oval face on the right little finger", changed_fields: [], human_same: true },
  );
  assertEquals(row.human_same, false);
  assertEquals(row.generated_same, true);
  assert(row.reason.includes("brass"));
});

Deno.test("a same row that adds a bun the block never held is relabelled different", () => {
  const row = verdictFor(
    { block: "hair: mid-back length, V-cut layers\nparting: centre", completion: "" },
    "s",
    { rewrite: "Fine straight mid-back length hair with V-cut layers, centre parted, arranged in a high bun", changed_fields: [], human_same: true },
  );
  assertEquals(row.human_same, false);
  assert(row.reason.includes("bun"));
});

Deno.test("a trench that arrives as a trench coat is agreement, not a competing garment", () => {
  const row = verdictFor(
    { block: "outer: camel wool blend trench, cinched waist\nfootwear: nude suede pumps", completion: "" },
    "s",
    { rewrite: "A camel wool blend trench coat with a cinched waist over nude suede pumps, all as described", changed_fields: [], human_same: true },
  );
  assertEquals(row.human_same, true);
  assert(row.reason.includes("survive"));
});

Deno.test("a thinner description is not a different object", () => {
  const row = verdictFor(
    { block: "device: iphone 13, graphite\ncase: walnut brown leather", completion: "" },
    "s",
    { rewrite: "A graphite iPhone 13 held at the right hip, nothing else in frame", changed_fields: [], human_same: true },
  );
  assertEquals(row.human_same, true);
  assert(row.reason.includes("thinner description"));
});

Deno.test("the companion file carries both labels and a reason on every kept row", async () => {
  const corpus = JSON.parse(await Deno.readTextFile("wardrobe/corpus/curated.invented.json"));
  assert(corpus.rows.length >= 500, "the four corpora plus the later three live here");
  let relabels = 0;
  for (const row of corpus.rows) {
    assert(typeof row.generated_same === "boolean", "the provider's label is kept beside ours");
    assert(typeof row.human_same === "boolean", "our label is present");
    assert(row.reason.trim().length > 10, `a row without a reason cannot be argued with: ${row.reason}`);
    assert(row.block.includes(":"), "every row carries the block it re-describes");
    if (row.generated_same !== row.human_same) {
      relabels++;
      assert(row.human_same === false, "every relabel in these corpora moves same to different");
      assert(/the block says|its own changed_fields/.test(row.reason), `a relabel cites the evidence it moved on: ${row.reason}`);
    }
  }
  assertEquals(relabels, corpus.rows.filter((r: { generated_same: boolean; human_same: boolean }) => r.generated_same !== r.human_same).length);
});
