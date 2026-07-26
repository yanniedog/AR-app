import {
  isSuitabilityFilterReady,
  setSuitabilityAllowed,
} from '../src/data/suitabilityGate';
import {
  clearSuitabilityIndex,
  closeSuitabilityGateUntilRebuild,
} from '../src/data/suitabilityIndex';

/**
 * Home hero readiness is gated on {@link isSuitabilityFilterReady}. These
 * cases document the wait-until-ready contract so Home never paints "—" (or
 * unfiltered extremes) while the post-ingest suitability Set is empty.
 */
describe('Home hero suitability readiness', () => {
  afterEach(() => {
    clearSuitabilityIndex();
  });

  it('blocks standard-only hero paint while the gate is fail-closed', () => {
    closeSuitabilityGateUntilRebuild();
    expect(isSuitabilityFilterReady(false)).toBe(false);
  });

  it('allows hero paint once the allowlist is populated', () => {
    closeSuitabilityGateUntilRebuild();
    setSuitabilityAllowed(new Set(['lender|product']));
    expect(isSuitabilityFilterReady(false)).toBe(true);
  });

  it('allows hero paint after an empty index install clears the closed gate', () => {
    closeSuitabilityGateUntilRebuild();
    setSuitabilityAllowed(new Set());
    expect(isSuitabilityFilterReady(false)).toBe(true);
  });

  it('does not wait when the user opted into non-standard products', () => {
    closeSuitabilityGateUntilRebuild();
    expect(isSuitabilityFilterReady(true)).toBe(true);
  });
});
