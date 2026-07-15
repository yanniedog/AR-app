/**
 * Tiny holder for the post-ingest suitability Set so format.ts can do O(1)
 * lookups without importing the builder (avoids a circular dependency).
 */
let allowed: Set<string> | null = null;

export function getSuitabilityAllowed(): Set<string> | null {
  return allowed;
}

export function setSuitabilityAllowed(next: Set<string> | null): void {
  allowed = next;
}
