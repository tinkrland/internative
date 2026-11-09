// the memory client: the mouth asking the head.
//
// the persona's memory server is retelldb (the pinned dependency in
// requirements.txt): persona graphs, voice profiles, connections,
// platform scope. this client carries the scope on every call so the
// head knows which surface is asking and who is in front of it.
//
// honest contract: CLAWBUZZ_RETELLDB_URL unset means memory calls are a
// no-op with a warn, never a crash. a failed query returns null and the
// caller says so. memory is never fabricated to fill a hole, and a drop
// the head decided on is returned, not swallowed.

import { scopePayload, type MemoryScope } from "./scope.ts";

export interface MemoryNode {
  id: string;
  title: string;
  type: string;
  content: string;
  namespace: string;
  tags: string[];
}

export interface MemoryDrop {
  node_id: string;
  reason: string;
}

export interface MemoryResult {
  nodes: MemoryNode[];
  // every node the scope rules held back, with the reason. silent
  // dropping is the one thing this must never do.
  dropped: MemoryDrop[];
}

function baseUrl(): string | null {
  const url = Deno.env.get("CLAWBUZZ_RETELLDB_URL");
  return url ? url.replace(/\/+$/, "") : null;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  const key = Deno.env.get("CLAWBUZZ_RETELLDB_KEY");
  if (key) h.authorization = `Bearer ${key}`;
  return h;
}

export function memoryConfigured(): boolean {
  return baseUrl() !== null;
}

// ask the head. null = not configured or the head refused; the caller
// reports honestly instead of guessing.
export async function queryMemory(
  query: string,
  scope: MemoryScope,
  opts: { topK?: number } = {},
): Promise<MemoryResult | null> {
  const base = baseUrl();
  if (!base) {
    console.warn("clawbuzz: memory query skipped, CLAWBUZZ_RETELLDB_URL unset");
    return null;
  }
  try {
    const res = await fetch(`${base}/v1/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        query,
        top_k: opts.topK ?? 5,
        ...scopePayload(scope),
      }),
    });
    if (!res.ok) {
      console.warn(`clawbuzz: memory query failed: ${res.status} ${await res.text()}`);
      return null;
    }
    const body = await res.json();
    const result = body?.result ?? {};
    return {
      nodes: (result.nodes ?? []).map((sn: any) => ({
        id: sn.node.id,
        title: sn.node.title,
        type: sn.node.type,
        content: sn.node.content,
        namespace: sn.node.namespace,
        tags: sn.node.tags ?? [],
      })),
      dropped: result.dropped ?? [],
    };
  } catch (err: any) {
    console.warn(`clawbuzz: memory query errored: ${err.message}`);
    return null;
  }
}

// teach the head, with provenance. true when the write landed; false
// (with a warn) when retelldb is unset or refused. a failed memory write
// never takes the calling flow down.
export async function ingestMemory(
  content: string,
  scope: MemoryScope,
  opts: { title?: string; sourceUri?: string } = {},
): Promise<boolean> {
  const base = baseUrl();
  if (!base) {
    console.warn("clawbuzz: memory ingest skipped, CLAWBUZZ_RETELLDB_URL unset");
    return false;
  }
  try {
    const res = await fetch(`${base}/v1/ingest`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        content,
        format: "markdown",
        title: opts.title,
        source_uri: opts.sourceUri,
        ...scopePayload(scope),
      }),
    });
    if (!res.ok) {
      console.warn(`clawbuzz: memory ingest failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`clawbuzz: memory ingest errored: ${err.message}`);
    return false;
  }
}

// the read shape a surface actually wants: the kept nodes plus an
// honest note about what the scope withheld. the note is prose a
// receipt or a log can show, not a raw error.
export async function recallForSurface(
  query: string,
  scope: MemoryScope,
  opts: { topK?: number } = {},
): Promise<{ nodes: MemoryNode[]; withheld: number; enabled: boolean }> {
  const result = await queryMemory(query, scope, opts);
  if (!result) return { nodes: [], withheld: 0, enabled: memoryConfigured() };
  return {
    nodes: result.nodes,
    withheld: result.dropped.length,
    enabled: true,
  };
}
