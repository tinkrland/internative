// the number that means "this person", and the pack that means "this version of her".
//
// a personality is not one file. it is an identity, a brand, a set of registers, a
// crew, a voice, a wardrobe, a set of places and an appearance, and those do not
// live in one place: most are on the head, appearance is its own branch, voice is
// carried by audio, music and streaming. so the aipn seals a set of layer digests
// rather than a folder.
//
// the number is immutable. the person underneath it is not: the pack is versioned,
// the appearance is retuned, the wardrobe gains a coat. an aipn is allocated once,
// never reused and never edited, and a persona that is retired keeps its number
// forever, because the number is the person and not the current version of her.

export const AIPN_LAYERS = [
  "identity",
  "brand",
  "registers",
  "crew",
  "voice",
  "wardrobe",
  "places",
  "appearance",
] as const;

export type AipnLayer = (typeof AIPN_LAYERS)[number];

// who owns each layer, because a pack assembled from the wrong branch is a persona
// with a face nobody tuned.
export const LAYER_OWNER: Record<AipnLayer, { module: string; branch: string }> = {
  identity: { module: "personas/<id>.persona.jsonc#identity", branch: "main" },
  brand: { module: "personas/<id>.persona.jsonc#brand", branch: "main" },
  registers: { module: "personas/<id>.persona.jsonc#registers", branch: "main" },
  crew: { module: "personas/<id>.persona.jsonc#crew", branch: "main" },
  voice: { module: "persona/voice_adapter.ts", branch: "main" },
  wardrobe: { module: "personas/<id>.wardrobe.jsonc", branch: "main" },
  places: { module: "personas/<id>.places.jsonc", branch: "main" },
  appearance: { module: "appearance/tuning.ts", branch: "appearance" },
};

export interface LayerDigest {
  layer: AipnLayer;
  digest: string;
}

export interface Pack {
  layers: LayerDigest[];
  pack: string;
}

export interface AipnRecord {
  aipn: number;
  persona: string;
  sealed_at: string;
  packs: Pack[];
  retired_at?: string;
}

const HEX64 = /^[0-9a-f]{64}$/;

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// the digest of one layer. a head layer is the file that holds it; the appearance
// branch hands over its own digest, which is why this takes text and not a path.
export function layerDigest(layer: AipnLayer, text: string): Promise<string> {
  return sha256Hex(`${layer}\n${text}`);
}

export function packProblems(layers: LayerDigest[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, number>();
  for (const entry of layers) {
    if (!AIPN_LAYERS.includes(entry.layer)) problems.push(`"${entry.layer}" is not a layer of a personality`);
    if (!HEX64.test(entry.digest ?? "")) problems.push(`${entry.layer}: digest is not a sha256 hex string`);
    seen.set(entry.layer, (seen.get(entry.layer) ?? 0) + 1);
  }
  for (const [layer, count] of seen) {
    if (count > 1) problems.push(`${layer}: sealed twice, and a layer has one digest`);
  }
  for (const layer of AIPN_LAYERS) {
    if (!seen.has(layer)) problems.push(`${layer}: missing, and a pack without it is a persona with a hole in her`);
  }
  return problems;
}

// canonical form: layer order is the order of AIPN_LAYERS, never the order a caller
// happened to collect them in, so two identical packs always hash the same.
export function canonicalPack(layers: LayerDigest[]): string {
  return AIPN_LAYERS.map((layer) => {
    const entry = layers.find((l) => l.layer === layer);
    return `${layer}:${entry?.digest ?? ""}`;
  }).join("\n");
}

export async function sealPack(layers: LayerDigest[]): Promise<{ pack?: Pack; problems: string[] }> {
  const problems = packProblems(layers);
  if (problems.length) return { problems };
  const ordered = AIPN_LAYERS.map((layer) => layers.find((l) => l.layer === layer)!);
  return { problems: [], pack: { layers: ordered, pack: await sha256Hex(canonicalPack(ordered)) } };
}

export function formatAipn(n: number): string {
  return `AIPN-${String(n).padStart(6, "0")}`;
}

export function parseAipn(value: string): number | undefined {
  const match = /^AIPN-(\d{1,9})$/.exec(value.trim());
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

export interface AipnStore {
  allocate(persona: string, pack: Pack, at: string): Promise<{ record?: AipnRecord; problems: string[] }>;
  pin(aipn: number, pack: Pack, at: string): Promise<{ record?: AipnRecord; problems: string[] }>;
  retire(aipn: number, at: string): Promise<{ record?: AipnRecord; problems: string[] }>;
  get(aipn: number): Promise<AipnRecord | undefined>;
  byPersona(persona: string): Promise<AipnRecord | undefined>;
}

const SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

// the rules a real store has to keep, kept in one place so a postgres table and an
// in-memory fake cannot drift apart: one number per person, forever, and no edits.
export function aipnRules(record: AipnRecord, persona: string, pack: Pack): string[] {
  const problems: string[] = [];
  if (!SLUG.test(persona)) problems.push(`"${persona}" is not a persona slug`);
  if (record.persona !== persona) problems.push(`aipn ${formatAipn(record.aipn)} already belongs to ${record.persona}`);
  if (record.retired_at) problems.push(`aipn ${formatAipn(record.aipn)} is retired and a retired number is never reissued`);
  const problemsInPack = packProblems(pack.layers);
  if (problemsInPack.length) problems.push(...problemsInPack);
  if (problemsInPack.length === 0) {
    const latest = record.packs[record.packs.length - 1];
    if (latest && latest.pack === pack.pack) problems.push(`aipn ${formatAipn(record.aipn)} is already sealed at this pack`);
  }
  return problems;
}

export function memoryAipnStore(): AipnStore {
  const records = new Map<number, AipnRecord>();
  // the counter only ever goes up: a retired number is spent, not recycled.
  let next = 1;
  const clone = (r: AipnRecord) => structuredClone(r);
  return {
    async allocate(persona, pack, at) {
      if (!SLUG.test(persona)) return { problems: [`"${persona}" is not a persona slug`] };
      for (const record of records.values()) {
        if (record.persona === persona) {
          return { problems: [`${persona} already holds aipn ${formatAipn(record.aipn)}; a person is not renumbered`] };
        }
      }
      const problems = packProblems(pack.layers);
      if (problems.length) return { problems };
      const record: AipnRecord = { aipn: next++, persona, sealed_at: at, packs: [pack] };
      records.set(record.aipn, record);
      return { problems: [], record: clone(record) };
    },
    async pin(aipn, pack, at) {
      const record = records.get(aipn);
      if (!record) return { problems: [`aipn ${formatAipn(aipn)} is not allocated`] };
      const problems = aipnRules(record, record.persona, pack).filter((p) => !p.includes("already belongs"));
      if (problems.length) return { problems };
      record.packs.push(pack);
      record.sealed_at = at;
      return { problems: [], record: clone(record) };
    },
    async retire(aipn, at) {
      const record = records.get(aipn);
      if (!record) return { problems: [`aipn ${formatAipn(aipn)} is not allocated`] };
      if (record.retired_at) return { problems: [`aipn ${formatAipn(aipn)} is already retired`] };
      record.retired_at = at;
      return { problems: [], record: clone(record) };
    },
    async get(aipn) {
      const record = records.get(aipn);
      return record ? clone(record) : undefined;
    },
    async byPersona(persona) {
      for (const record of records.values()) if (record.persona === persona) return clone(record);
      return undefined;
    },
  };
}

// the same rules, as a table, for the day this is a live database. written here so
// the invariants are reviewable next to the code that assumes them.
export const POSTGRES_SCHEMA = `
create sequence if not exists aipn_seq as bigint start 1;

create table if not exists aipn (
  aipn       bigint primary key,
  persona    text not null unique,
  sealed_at  timestamptz not null default now(),
  retired_at timestamptz
);

create table if not exists aipn_pack (
  aipn      bigint not null references aipn (aipn),
  pack      char(64) not null,
  layers    jsonb not null,
  sealed_at timestamptz not null default now(),
  primary key (aipn, pack)
);

-- the number and the person never change. only retired_at may be written.
create or replace function aipn_refuse_edit() returns trigger as $$
begin
  raise exception 'aipn is immutable: number % belongs to %', old.aipn, old.persona;
end;
$$ language plpgsql;

drop trigger if exists aipn_no_edit on aipn;
create trigger aipn_no_edit
  before update on aipn
  for each row
  when (new.aipn <> old.aipn or new.persona <> old.persona or new.sealed_at <> old.sealed_at)
  execute function aipn_refuse_edit();

drop trigger if exists aipn_no_delete on aipn;
create trigger aipn_no_delete
  before delete on aipn
  for each row execute function aipn_refuse_edit();
`.trim();
