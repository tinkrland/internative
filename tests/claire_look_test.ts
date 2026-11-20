import { assertEquals, assert } from "jsr:@std/assert@1";

const root = new URL("../", import.meta.url);
const look = JSON.parse(await Deno.readTextFile(new URL("personas/claire.look.jsonc", root)));
const persona = JSON.parse((await Deno.readTextFile(new URL("personas/claire.persona.jsonc", root))).replace(/^\s*\/\/.*$/gm, ""));

Deno.test("the look comes from the board it says it came from", () => {
  assertEquals(look.source.kind, "playbook");
  assertEquals(look.source.org, "internative");
  assertEquals(look.source.board, "claire @digi.junkie");
  assertEquals(look.source.board_token.length > 10, true, "the token is how the board is found again");
  assertEquals(look.aipn, "AIPN-000002");
});

Deno.test("every asset in the manifest has a file in the repo, and every file is claimed", async () => {
  assertEquals(look.assets.length, look.measured.assets);
  const onDisk = [];
  for await (const entry of Deno.readDir(new URL("assets/claire/", root).pathname)) {
    if (entry.isFile) onDisk.push(entry.name);
  }
  assertEquals(onDisk.length, look.assets.length);
  const claimed = look.assets.map((a: any) => a.file.split("/").pop()).sort();
  assertEquals(claimed, onDisk.sort());
  for (const asset of look.assets) {
    const stat = await Deno.stat(new URL(asset.file, root));
    assert(stat.size > 5000, `${asset.file} is too small to be a photograph`);
  }
});

Deno.test("the series add up, and a treatment is not counted as a person", () => {
  const total = look.series.reduce((sum: number, s: any) => sum + s.count, 0);
  assertEquals(total, look.assets.length);
  assert(look.treatments.includes("black and white"));
  assert(look.series.some((s: any) => s.title === "b/w photoshoot carousel"));
  assertEquals(look.places, ["indoors", "train station", "car"]);
});

Deno.test("her own references owe no disclosure, which is why they are allowed in the repo", () => {
  assertEquals(look.owned, true);
  assert(look.rules.some((r: string) => r.includes("nothing in this set needs a caption disclosure")));
});

Deno.test("the persona points at the board rather than inventing a look in prose", () => {
  assert(persona.brand.look.includes("playbook board claire @digi.junkie"));
  assert(persona.brand.handles.instagram.includes("digi.junkie"));
});
