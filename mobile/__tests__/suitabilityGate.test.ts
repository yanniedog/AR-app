import {
  getSuitabilityRevision,
  setSuitabilityAllowed,
  subscribeSuitabilityGate,
} from '../src/data/suitabilityGate';

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
