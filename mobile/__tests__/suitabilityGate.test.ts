import {
  getSuitabilityRevision,
  isSuitabilityFilterReady,
  setSuitabilityAllowed,
  subscribeSuitabilityGate,
} from '../src/data/suitabilityGate';
import {
  clearSuitabilityIndex,
  closeSuitabilityGateUntilRebuild,
  installSuitabilityIndex,
} from '../src/data/suitabilityIndex';

describe('suitability gate revision', () => {
  it('notifies product surfaces when the allowed set changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSuitabilityGate(listener);
    const before = getSuitabilityRevision();
    const next = new Set(['standard-product']);

    setSuitabilityAllowed(next);

    expect(getSuitabilityRevision()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);

    setSuitabilityAllowed(next);
    expect(getSuitabilityRevision()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);

    next.add('another-standard-product');
    setSuitabilityAllowed(next);
    expect(getSuitabilityRevision()).toBe(before + 2);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setSuitabilityAllowed(null);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('isSuitabilityFilterReady', () => {
  afterEach(() => {
    clearSuitabilityIndex();
  });

  it('is not ready under standard-only while the fail-closed gate is empty', () => {
    closeSuitabilityGateUntilRebuild();
    expect(isSuitabilityFilterReady(false)).toBe(false);
  });

  it('stays ready when non-standard products are included during rebuild', () => {
    closeSuitabilityGateUntilRebuild();
    expect(isSuitabilityFilterReady(true)).toBe(true);
  });

  it('is ready on the core-only path before an index is installed', () => {
    clearSuitabilityIndex();
    expect(isSuitabilityFilterReady(false)).toBe(true);
  });

  it('is ready after a non-empty suitability index is installed', () => {
    closeSuitabilityGateUntilRebuild();
    expect(isSuitabilityFilterReady(false)).toBe(false);
    installSuitabilityIndex({
      runDate: '2026-07-26',
      coreSha: 'core',
      detailsSha: 'details',
      allowed: new Set(['product-a']),
    });
    expect(isSuitabilityFilterReady(false)).toBe(true);
  });

  it('is ready after a successfully installed empty index (not stuck closed)', () => {
    closeSuitabilityGateUntilRebuild();
    expect(isSuitabilityFilterReady(false)).toBe(false);
    const before = getSuitabilityRevision();
    installSuitabilityIndex({
      runDate: '2026-07-26',
      coreSha: 'core',
      detailsSha: 'details',
      allowed: new Set(),
    });
    expect(isSuitabilityFilterReady(false)).toBe(true);
    expect(getSuitabilityRevision()).toBe(before + 1);
  });
});
