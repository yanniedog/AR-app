import { shouldRefreshOnResume } from '../src/data/resumeRefresh';

describe('shouldRefreshOnResume', () => {
  const now = Date.parse('2026-08-12T02:00:00Z');

  test('refreshes when no trustworthy recent check exists', () => {
    expect(shouldRefreshOnResume(null, now)).toBe(true);
    expect(shouldRefreshOnResume('bad-date', now)).toBe(true);
    expect(shouldRefreshOnResume('2026-08-12T02:01:00Z', now)).toBe(true);
  });

  test('uses a short freshness window for decision-day updates', () => {
    expect(shouldRefreshOnResume('2026-08-12T01:50:00Z', now)).toBe(false);
    expect(shouldRefreshOnResume('2026-08-12T01:44:59Z', now)).toBe(true);
  });
});
