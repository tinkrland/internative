// ffmpeg is a real dependency of two tests here, and neither the binary nor the
// --allow-run permission is guaranteed on the machine running the suite. a missing
// tool is a skipped test, not a failing one: reporting "broken audio" because a
// sandbox lacks a permission is how a suite loses its authority.
export function toolsAvailable(...bins: string[]): boolean {
  for (const bin of bins) {
    try {
      const out = new Deno.Command(bin, { args: ["-version"] }).outputSync();
      if (!out.success) return false;
    } catch {
      return false;
    }
  }
  return true;
}
