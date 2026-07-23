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
