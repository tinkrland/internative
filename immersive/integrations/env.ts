// one place for destination credentials: read the clawbuzz name first, then
// the older unprefixed name a previous deploy may still carry. never a
// committed key, never a hardcoded ingest url.
export function env(primary: string, legacy?: string): string | undefined {
  const value = Deno.env.get(primary);
  if (value) return value;
  if (legacy) {
    const older = Deno.env.get(legacy);
    if (older) return older;
  }
  return undefined;
}
