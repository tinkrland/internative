// what the closet can actually do today: what is wearable, what is still a
// caption waiting to be written, and which outfits have a real photograph to
// anchor them.

import { anchorsFor, composeOutfit, mixMatch, inventoryProblems, isWearable, parseInventory } from "../media/inventory.ts";

const path = Deno.args[0] ?? "personas/example.inventory.jsonc";
const inv = parseInventory(await Deno.readTextFile(path));
const problems = inventoryProblems(inv);
const wearable = inv.items.filter(isWearable);
const pending = inv.items.filter((i) => i.state === "candidate");

console.log(`${inv.persona}: ${inv.items.length} items, ${wearable.length} wearable, ${pending.length} waiting on a name`);
for (const item of inv.items) {
  const mark = isWearable(item) ? "wearable" : item.state === "candidate" ? "needs confirming" : "incomplete";
  console.log(`  ${item.source.padEnd(9)} ${item.id.padEnd(18)} ${item.layer.padEnd(9)} ${mark}`);
}
for (const item of pending) {
  console.log(`\n${item.id} came from ${item.source} as ${item.ref ?? "no reference"}. it becomes wearable when someone writes the kind, the detail and the colours.`);
}

const outfits = [
  composeOutfit("monday", "monday", [wearable.find((i) => i.id === "oxblood-slip")!, wearable.find((i) => i.id === "black-boots")!]),
].filter((o) => o.outfit);

console.log("\ncomposed:");
for (const { outfit } of outfits) {
  const items = outfit!.garments.map((g) => g.detail);
  const anchor = anchorsFor(inv, [...inv.items.filter((i) => outfit!.garments.some((g) => g.detail === i.detail))]);
  console.log(`  ${outfit!.id}: ${items.join(" + ")}`);
  console.log(`    anchor: ${anchor.ref ? `${anchor.ref.id} covers ${Math.round(anchor.coverage * 100)}%` : "none, so this is a new invention wearing her name"}`);
  if (anchor.missing.length) console.log(`    unanchored: ${anchor.missing.join(", ")}`);
}

const combos = mixMatch(inv, { fills: ["base", "outer", "footwear"], season: "cold", cap: 6 });
console.log(`\nmix and match, cold, base + outer + footwear: ${combos.length} combinations`);
for (const combo of combos) console.log(`  ${combo.map((i) => i.id).join(" + ")}`);

if (problems.length) {
  console.log("\nproblems:");
  for (const problem of problems) console.log(`  ${problem}`);
  Deno.exit(1);
}
console.log("\ninventory is in shape");
