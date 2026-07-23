import { useSyncExternalStore } from 'react';

import {
  getSuitabilityRevision,
  subscribeSuitabilityGate,
} from '../data/suitabilityGate';

/**
 * Re-render derived product surfaces when the post-ingest suitability gate is
 * closed or rebuilt. The gate lives outside Zustand for fast O(1) row checks,
 * so consumers must subscribe explicitly instead of waiting for navigation to
 * incidentally change component state.
 */
export function useSuitabilityRevision(): number {
  return useSyncExternalStore(
    subscribeSuitabilityGate,
    getSuitabilityRevision,
    getSuitabilityRevision,
  );
}
