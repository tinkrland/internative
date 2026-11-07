import { assertEquals } from "jsr:@std/assert@1";
import { loadPersonaFile } from "../persona/loader.ts";
import { loadPlaces, loadWardrobe } from "../tools/libraries.ts";
import { planShot } from "../persona/shot.ts";
import { stripJsonc, validatePersona } from "../persona/loader.ts";
import {
  checkMediaContract,
  checkSeries,
  MEDIA_SURFACES,
  mediaPathFor,
  SURFACE_MEDIA,
  type AssetSeries,
} from "../media/paths.ts";

const persona = await loadPersonaFile("personas/example.persona.jsonc");
const libs = { wardrobe: await loadWardrobe("example"), places: await loadPlaces("example") };
const shot = (composition: string, magnification = "medium, one person, the room readable behind her") =>
  planShot(persona, libs, { place_id: "bathroom-mirror", outfit_id: "plain-tee", day: "2026-11-07", composition, magnification });

Deno.test("every surface the head has says how it gets pictures", () => {
  assertEquals(MEDIA_SURFACES.length, 8);
  for (const surface of MEDIA_SURFACES) {
    assertEquals(Boolean(SURFACE_MEDIA[surface]?.why), true, `${surface} needs a reason, not just a label`);
  }
  assertEquals(mediaPathFor("proskena"), "rendered");
  assertEquals(mediaPathFor("static"), "generated");
  assertEquals(mediaPathFor("meetings"), "captured");
  assertEquals(mediaPathFor("audio"), "none");
  assertEquals(mediaPathFor("nonsense"), undefined);
});

Deno.test("a photoshoot series holds character, location and wardrobe, and varies composition", () => {
  const series: AssetSeries = {
    surface: "proskena",
    source: "rendered",
    subject: "example",
    items: [
      { id: "hero", blocks: shot("waist up, facing the mirror").blocks, wardrobe: "plain-tee" },
      { id: "detail", blocks: shot("close on the hands, same counter").blocks, wardrobe: "plain-tee" },
    ],
  };
  assertEquals(checkSeries(series), []);
});

Deno.test("a series that mixes a render with a sample is refused", () => {
  const mixed: AssetSeries = { surface: "static", source: "rendered", subject: "example", items: [] };
  const problems = checkSeries(mixed);
  assertEquals(problems.some((p) => p.problem.includes("how one face becomes two")), true);
});

Deno.test("a series whose subject changes her clothes mid-shoot is refused", () => {
  const series: AssetSeries = {
    surface: "proskena",
    source: "rendered",
    subject: "example",
    items: [
      { id: "hero", blocks: shot("waist up, facing the mirror").blocks, wardrobe: "plain-tee" },
      { id: "portrait", blocks: shot("close, three quarter").blocks, wardrobe: "denim-jacket" },
    ],
  };
  assertEquals(checkSeries(series).some((p) => p.problem.includes("wardrobe is locked")), true);
});

Deno.test("a series that moves the room is refused, and one that only moves the frame is not", () => {
  const otherRoom = planShot(persona, libs, {
    place_id: "car-interior",
    outfit_id: "plain-tee",
    day: "2026-11-07",
    composition: "waist up, facing the mirror",
    magnification: "medium, one person, the room readable behind her",
  });
  const moved = checkSeries({
    surface: "proskena",
    source: "rendered",
    subject: "example",
    items: [
      { id: "hero", blocks: shot("waist up, facing the mirror").blocks, wardrobe: "plain-tee" },
      { id: "elsewhere", blocks: otherRoom.blocks, wardrobe: "plain-tee" },
    ],
  });
  assertEquals(moved.some((p) => p.problem.includes("moved location")), true);
});

Deno.test("a surface that draws nothing cannot carry a series", () => {
  const audio: AssetSeries = { surface: "audio", source: "rendered", subject: "example", items: [] };
  assertEquals(checkSeries(audio).some((p) => p.problem.includes("produces no pictures")), true);
});

Deno.test("a persona only claims surfaces with a media path, and generation needs her look", () => {
  assertEquals(checkMediaContract(["static", "audio", "text"], persona.brand.look ?? "authored look"), []);
  assertEquals(checkMediaContract(["tiktok"]).some((p) => p.includes("no media path")), true);
  const blind = checkMediaContract(["static"], undefined);
  assertEquals(blind.some((p) => p.includes("no look")), true);
  assertEquals(checkMediaContract(["proskena", "static"], undefined).some((p) => p.includes("both a render path")), true);
});

const exampleSrc = await Deno.readTextFile("personas/example.persona.jsonc");

Deno.test("the loader refuses a persona that generates stills with no look to hold them", () => {
  const src = exampleSrc;
  const parsed = JSON.parse(stripJsonc(src));
  delete parsed.brand.look;
  const result = validatePersona(parsed);
  assertEquals(result.ok, false);
  assertEquals(result.errors.some((e: string) => e.includes("no look")), true);
});

Deno.test("the loader refuses a surface that is neither a surface nor fed by a path", () => {
  const parsed = JSON.parse(stripJsonc(exampleSrc));
  parsed.surfaces = [...parsed.surfaces, "tiktok"];
  const result = validatePersona(parsed);
  assertEquals(result.ok, false);
  // the schema catches it first, which is the right order: a surface the head
  // does not have never reaches the media contract at all
  assertEquals(result.errors.some((e: string) => e.includes("unknown surface")), true);
});
