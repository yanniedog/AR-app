import type { ObservabilityDeps } from './observability';

/** Web has no native crash collection bridge. Keep its dependency graph empty. */
export function loadNativeDeps(): ObservabilityDeps | null { return null; }
