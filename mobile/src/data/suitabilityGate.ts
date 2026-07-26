/**
 * Tiny holder for the post-ingest suitability Set so format.ts can do O(1)
 * lookups without importing the builder (avoids a circular dependency).
 */
let allowed: Set<string> | null = null;
let allowedSnapshot: Set<string> | null = null;
let revision = 0;
const listeners = new Set<() => void>();

function setsEqual(left: Set<string> | null, right: Set<string> | null): boolean {
  if (left === null || right === null) return left === right;
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

export function getSuitabilityAllowed(): Set<string> | null {
  return allowed;
}

export function getSuitabilityRevision(): number {
  return revision;
}

/**
 * Whether standard-only surfaces may paint filtered rates.
 * An empty Set is the fail-closed post-ingest rebuild window — treat as not
 * ready so Home/Trends do not flash "—" or leak core-only fallbacks.
 * `null` means the index was never installed (core-only assessAccess path) and
 * is ready to display; non-empty Sets are the warm index.
 */
export function isSuitabilityFilterReady(includeNonStandard = false): boolean {
  if (includeNonStandard) return true;
  return getSuitabilityAllowed()?.size !== 0;
}

export function subscribeSuitabilityGate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSuitabilityAllowed(next: Set<string> | null): void {
  if (setsEqual(allowedSnapshot, next)) return;
  allowed = next;
  allowedSnapshot = next === null ? null : new Set(next);
  revision += 1;
  for (const listener of listeners) listener();
}
