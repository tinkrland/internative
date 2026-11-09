import { assertEquals } from "jsr:@std/assert@1";
import {
  AIPN_LAYERS,
  aipnRules,
  canonicalPack,
  formatAipn,
  LAYER_OWNER,
  layerDigest,
  memoryAipnStore,
  packProblems,
  parseAipn,
  POSTGRES_SCHEMA,
  sealPack,
  type LayerDigest,
} from "../persona/aipn.ts";
import { loadPersonaFile } from "../persona/loader.ts";

const d = (layer: string, fill: string): LayerDigest => ({
  layer: layer as LayerDigest["layer"],
  digest: fill.repeat(64).slice(0, 64),
});

async function fullPack(seed = "a") {
  const layers: LayerDigest[] = [];
  for (const layer of AIPN_LAYERS) layers.push({ layer, digest: await layerDigest(layer, seed) });
  const sealed = await sealPack(layers);
  return sealed.pack!;
}

Deno.test("a pack needs all eight layers, and every layer says who owns it", () => {
  assertEquals(AIPN_LAYERS.length, 8);
  assertEquals(Object.keys(LAYER_OWNER).length, 8);
  assertEquals(LAYER_OWNER.appearance.branch, "appearance");
  const missing = packProblems([d("identity", "a")]);
  assertEquals(missing.filter((p) => p.includes("missing")).length, 7);
  assertEquals(packProblems([]).length, 8);
  assertEquals(packProblems([...AIPN_LAYERS].map((l) => d(l, "b"))), []);
});

Deno.test("a layer sealed twice, or a digest that is not a digest, is refused", () => {
  const twice = [...AIPN_LAYERS].map((l) => d(l, "c"));
  twice.push(d("brand", "d"));
  assertEquals(packProblems(twice).some((p) => p.includes("sealed twice")), true);
  const junk = [...AIPN_LAYERS].map((l) => d(l, "e"));
  junk[0] = { layer: "identity", digest: "not-a-digest" };
  assertEquals(packProblems(junk).some((p) => p.includes("not a sha256")), true);
});

Deno.test("the pack hashes layer order away, and changes when one layer changes", async () => {
  const layers = [...AIPN_LAYERS].map((l) => d(l, "f"));
  const forward = await sealPack(layers);
  const backward = await sealPack([...layers].reverse());
  assertEquals(forward.pack?.pack, backward.pack?.pack);
  const moved = layers.map((l) => (l.layer === "appearance" ? d("appearance", "1") : l));
  assertEquals((await sealPack(moved)).pack?.pack === forward.pack?.pack, false);
});

Deno.test("an aipn formats, parses, and refuses anything that is not one", () => {
  assertEquals(formatAipn(1), "AIPN-000001");
  assertEquals(formatAipn(91234), "AIPN-091234");
  assertEquals(parseAipn("AIPN-000042"), 42);
  assertEquals(parseAipn("aipn-1"), undefined);
  assertEquals(parseAipn("AIPN-0"), undefined);
  assertEquals(parseAipn("42"), undefined);
});

Deno.test("one person, one number, and the number is never handed out twice", async () => {
  const store = memoryAipnStore();
  const first = await store.allocate("example", await fullPack("a"), "2026-11-08T00:00:00Z");
  assertEquals(first.problems, []);
  assertEquals(first.record?.aipn, 1);
  const again = await store.allocate("example", await fullPack("b"), "2026-11-08T00:01:00Z");
  assertEquals(again.record, undefined);
  assertEquals(again.problems.some((p) => p.includes("not renumbered")), true);
  const other = await store.allocate("second-persona", await fullPack("c"), "2026-11-08T00:02:00Z");
  assertEquals(other.record?.aipn, 2);
});

Deno.test("a retuned personality pins a new pack and keeps its number", async () => {
  const store = memoryAipnStore();
  await store.allocate("example", await fullPack("a"), "2026-11-08T00:00:00Z");
  const retuned = await store.pin(1, await fullPack("b"), "2026-11-09T00:00:00Z");
  assertEquals(retuned.problems, []);
  assertEquals(retuned.record?.aipn, 1);
  assertEquals(retuned.record?.packs.length, 2);
  const same = await store.pin(1, retuned.record!.packs[1], "2026-11-09T01:00:00Z");
  assertEquals(same.problems.some((p) => p.includes("already sealed")), true);
  assertEquals((await store.pin(99, await fullPack("c"), "2026-11-09T00:00:00Z")).problems.length, 1);
});

Deno.test("a retired number is spent, not recycled, and the person stays findable", async () => {
  const store = memoryAipnStore();
  await store.allocate("example", await fullPack("a"), "2026-11-08T00:00:00Z");
  const retired = await store.retire(1, "2026-11-10T00:00:00Z");
  assertEquals(retired.record?.retired_at, "2026-11-10T00:00:00Z");
  assertEquals((await store.retire(1, "2026-11-10T00:00:01Z")).problems.some((p) => p.includes("already retired")), true);
  assertEquals((await store.pin(1, await fullPack("b"), "2026-11-10T00:00:00Z")).problems.some((p) => p.includes("never reissued")), true);
  assertEquals((await store.byPersona("example"))?.aipn, 1);
  const next = await store.allocate("someone-else", await fullPack("c"), "2026-11-11T00:00:00Z");
  assertEquals(next.record?.aipn, 2, "number 1 is spent");
});

Deno.test("a pack that a store is handed without its layers is refused before it is stored", async () => {
  const store = memoryAipnStore();
  const bad = { layers: [d("identity", "a")], pack: "0".repeat(64) };
  const result = await store.allocate("example", bad, "2026-11-08T00:00:00Z");
  assertEquals(result.record, undefined);
  assertEquals(result.problems.some((p) => p.includes("missing")), true);
  assertEquals(await store.get(1), undefined);
});

Deno.test("the store's rules are the table's rules", async () => {
  const store = memoryAipnStore();
  await store.allocate("example", await fullPack("a"), "2026-11-08T00:00:00Z");
  const record = (await store.get(1))!;
  assertEquals(aipnRules(record, "someone-else", await fullPack("b")).some((p) => p.includes("already belongs")), true);
  assertEquals(POSTGRES_SCHEMA.includes("persona    text not null unique"), true);
  assertEquals(POSTGRES_SCHEMA.includes("create sequence if not exists aipn_seq"), true);
  assertEquals(POSTGRES_SCHEMA.includes("aipn is immutable"), true);
  assertEquals(POSTGRES_SCHEMA.includes("before delete on aipn"), true);
});

Deno.test("a head layer's digest moves when the thing it digests moves", async () => {
  const manifest = await Deno.readTextFile("personas/example.persona.jsonc");
  const wardrobe = await Deno.readTextFile("personas/example.wardrobe.jsonc");
  const a = await layerDigest("wardrobe", wardrobe);
  const b = await layerDigest("wardrobe", `${wardrobe} `);
  const c = await layerDigest("places", wardrobe);
  assertEquals(a === b, false, "one character is a different wardrobe");
  assertEquals(a === c, false, "the same text in another layer is another digest");
  const persona = await loadPersonaFile("personas/example.persona.jsonc");
  const sealed = await sealPack(
    await Promise.all(
      AIPN_LAYERS.map(async (layer) => ({ layer, digest: await layerDigest(layer, layer === "identity" ? persona.id : manifest) })),
    ),
  );
  assertEquals(sealed.pack?.pack.length, 64);
});
