import { useSyncExternalStore } from 'react';
import { getMandatoryEligibilityRevision, subscribeMandatoryEligibility } from '../data/eligibilityGate';

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
const revision = () => getSuitabilityRevision() + getMandatoryEligibilityRevision();
const subscribe = (listener: () => void) => {
  const suitability = subscribeSuitabilityGate(listener), mandatory = subscribeMandatoryEligibility(listener);
  return () => { suitability(); mandatory(); };
};
export function useSuitabilityRevision(): number {
  return useSyncExternalStore(
    subscribe,
    revision,
    revision,
  );
}
