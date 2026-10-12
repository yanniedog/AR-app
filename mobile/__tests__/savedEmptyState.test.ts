import { SAVED_EMPTY_COPY, savedEmptyState } from '../src/lib/savedEmptyState';

describe('savedEmptyState', () => {
  it('distinguishes nothing saved, unpublished saves and profile-hidden saves', () => {
    expect(savedEmptyState({ savedCount: 0, unavailableCount: 0 })).toBe('none');
    expect(savedEmptyState({ savedCount: 2, unavailableCount: 1 })).toBe('unavailable');
    // Every save excluded by the mandatory profile gate: none visible, none unavailable.
    expect(savedEmptyState({ savedCount: 2, unavailableCount: 0 })).toBe('hiddenByProfile');
  });

  it('never claims there are no saves when some are persisted', () => {
    expect(SAVED_EMPTY_COPY.hiddenByProfile.title).not.toMatch(/no saved/i);
    expect(SAVED_EMPTY_COPY.unavailable.title).not.toMatch(/no saved/i);
  });
});
