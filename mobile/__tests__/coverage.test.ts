import {
  coverageFailures,
  coverageObservedAt,
  coverageProvidersAttempted,
  coverageProvidersSucceeded,
} from '../src/data/coverage';

describe('coverage compatibility', () => {
  it('prefers canonical producer fields and derives attempted coverage', () => {
    const coverage = {
      observed_on: '2026-08-04',
      provider_failures: [{ provider: 'Failed Bank', phase: 'rates', count: 2 }],
      failures: [{ provider: 'stale alias' }],
      counts: { brands_observed: 60, providers_failed: 2 },
    };
    expect(coverageObservedAt(coverage)).toBe('2026-08-04');
    expect(coverageFailures(coverage)).toEqual(coverage.provider_failures);
    expect(coverageProvidersSucceeded(coverage)).toBe(60);
    expect(coverageProvidersAttempted(coverage)).toBe(62);
  });

  it('keeps older payload aliases readable', () => {
    const coverage = {
      observed_at: '2026-08-04T01:00:00Z',
      providers_attempted: 62,
      providers_succeeded: 60,
      failures: [{ provider: 'Failed Bank', reason: 'timeout' }],
    };
    expect(coverageObservedAt(coverage)).toBe('2026-08-04');
    expect(coverageFailures(coverage)).toEqual(coverage.failures);
    expect(coverageProvidersAttempted(coverage)).toBe(62);
    expect(coverageProvidersSucceeded(coverage)).toBe(60);
  });
});
