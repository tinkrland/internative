// load a persona's wardrobe and places, the way a surface would.
import { outfitForDay, parseWardrobe, type Wardrobe } from "../persona/wardrobe.ts";
import { parsePlaces, type Places } from "../persona/places.ts";

export function librariesDir(): string {
  return Deno.env.get("CLAWBUZZ_PERSONA_DIR") ?? new URL("../personas/", import.meta.url).pathname;
}

export async function loadWardrobe(personaId: string): Promise<Wardrobe> {
  const path = `${librariesDir().replace(/\/+$/, "")}/${personaId}.wardrobe.jsonc`;
  return parseWardrobe(await Deno.readTextFile(path));
}

export async function loadPlaces(personaId: string): Promise<Places> {
  const path = `${librariesDir().replace(/\/+$/, "")}/${personaId}.places.jsonc`;
  return parsePlaces(await Deno.readTextFile(path));
}

if (import.meta.main) {
  const id = Deno.args[0] ?? Deno.env.get("CLAWBUZZ_PERSONA") ?? "example";
  const [wardrobe, places] = await Promise.all([loadWardrobe(id), loadPlaces(id)]);
  const today = new Date().toISOString().slice(0, 10);
  console.log(`wardrobe: ${wardrobe.outfits.map((o) => o.id).join(", ")}`);
  console.log(`today (${today}): ${outfitForDay(wardrobe, today).name}`);
  console.log(`places: ${places.places.map((p) => `${p.id} (${p.plates.length} plates)`).join(", ")}`);
}
