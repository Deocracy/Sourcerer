/**
 * relativeTime.ts — hand-written relative timestamp formatter (05-RESEARCH.md
 * "Don't Hand-Roll": the full bucket set Notes needs is small enough that a
 * date library is disproportionate; matches Wiki.tsx's existing "2h ago" /
 * "3d ago" vocabulary, now computed instead of hardcoded demo literals).
 */
export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = 60_000;
  const hr = 3_600_000;
  const day = 86_400_000;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}
