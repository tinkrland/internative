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
