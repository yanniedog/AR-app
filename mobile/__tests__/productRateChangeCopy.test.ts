import { productRateChangeText } from '../src/components/product/ProductRateChangeLine';

describe('product rate-change copy', () => {
  it('does not narrate routine tracking or unchanged history on every card', () => {
    expect(productRateChangeText({
      kind: 'tracking',
      trackedSince: '2026-08-01',
      observations: 1,
    }, true)).toBeNull();
    expect(productRateChangeText({
      kind: 'unchanged',
      trackedSince: '2026-08-01',
      observations: 3,
    }, true)).toBeNull();
  });

  it('keeps a real move compact and dated', () => {
    expect(productRateChangeText({
      kind: 'changed',
      trackedSince: '2026-07-01',
      observations: 4,
      observedOn: '2026-08-01',
      fromRate: 0.06,
      toRate: 0.0595,
      bps: -5,
    }, true)).toBe('↓ 5 bps · 1 Aug 2026');
  });
});
