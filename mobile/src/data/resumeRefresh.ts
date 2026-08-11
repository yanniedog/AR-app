const DEFAULT_RESUME_REFRESH_MS = 15 * 60 * 1000;

/** A foreground resume should re-check the rolling manifest when the previous
 * check is absent, malformed, in the future, or older than the bounded TTL. */
export function shouldRefreshOnResume(
  lastCheckedAt: string | null | undefined,
  now: number = Date.now(),
  ttlMs: number = DEFAULT_RESUME_REFRESH_MS,
): boolean {
  if (!lastCheckedAt) return true;
  const checkedAt = Date.parse(lastCheckedAt);
  if (!Number.isFinite(checkedAt) || checkedAt > now) return true;
  return now - checkedAt >= Math.max(0, ttlMs);
}
