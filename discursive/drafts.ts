// drafts: the only place written presence is allowed to exist before it is
// approved.
//
// a jsonl file, append only, one record per artifact. a human can read it,
// git can ignore it, and nothing in this repo can post it without going
// through the publishing gate in core/publishing.ts.
//
// the fields are deliberately dull: what was written, for which network,
// what it was written from, and what state it is in. a draft is not a
// pending post, it is a file.

import type { TextChannel } from "./channels.ts";

export type DraftStatus = "draft" | "approved" | "sent" | "refused";

export interface Draft {
  id: string;
  channel: TextChannel;
  parts: string[];
  status: DraftStatus;
  createdAt: string;
  // where the idea came from, so a post can be traced back to the stream,
  // meeting or episode it came out of
  source?: { kind: "stream" | "meeting" | "written" | "episode" | "still"; uri?: string; note?: string };
  // what the composer changed to make it fit, so a receipt can say it
  dropped?: { emoji: number; hashtags: string[] };
  warnings?: string[];
  inReplyTo?: string;
  // set when a send was refused, with the reason, never silently
  refusal?: string;
}

function newId(): string {
  return `draft_${crypto.randomUUID()}`;
}

export class DraftStore {
  #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  get path(): string {
    return this.#path;
  }

  async append(draft: Omit<Draft, "id" | "createdAt" | "status"> & Partial<Pick<Draft, "status">>): Promise<Draft> {
    const record: Draft = {
      ...draft,
      id: newId(),
      createdAt: new Date().toISOString(),
      status: draft.status ?? "draft",
    };
    await Deno.writeTextFile(this.#path, `${JSON.stringify(record)}\n`, { append: true, create: true });
    return record;
  }

  async all(): Promise<Draft[]> {
    let raw: string;
    try {
      raw = await Deno.readTextFile(this.#path);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) return [];
      throw err;
    }
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as Draft);
  }

  async byId(id: string): Promise<Draft | null> {
    return (await this.all()).find((d) => d.id === id) ?? null;
  }

  // the only status change a human makes by hand. anything past approval is
  // written by the send path, and only when the gate allowed it.
  async approve(id: string): Promise<Draft> {
    const drafts = await this.all();
    const found = drafts.find((d) => d.id === id);
    if (!found) throw new Error(`drafts: no draft ${id}`);
    if (found.status !== "draft") throw new Error(`drafts: ${id} is ${found.status}, not a draft`);
    return await this.#rewrite(drafts.map((d) => (d.id === id ? { ...d, status: "approved" as const } : d)), id);
  }

  async setStatus(id: string, status: DraftStatus, refusal?: string): Promise<Draft> {
    const drafts = await this.all();
    if (!drafts.some((d) => d.id === id)) throw new Error(`drafts: no draft ${id}`);
    return await this.#rewrite(
      drafts.map((d) => (d.id === id ? { ...d, status, refusal } : d)),
      id,
    );
  }

  async #rewrite(drafts: Draft[], id: string): Promise<Draft> {
    const body = drafts.map((d) => JSON.stringify(d)).join("\n") + "\n";
    await Deno.writeTextFile(this.#path, body);
    const updated = drafts.find((d) => d.id === id)!;
    return updated;
  }
}
