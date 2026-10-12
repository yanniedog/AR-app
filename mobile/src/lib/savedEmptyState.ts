export type SavedEmptyState = 'none' | 'unavailable' | 'hiddenByProfile';

/**
 * Why Saved has nothing to list. Visible saves and unavailable refs are both
 * filtered through the mandatory profile gate, so persisted saves that leave
 * both empty are hidden by the profile, not missing.
 */
export function savedEmptyState(input: { savedCount: number; unavailableCount: number }): SavedEmptyState {
  if (input.unavailableCount > 0) return 'unavailable';
  return input.savedCount > 0 ? 'hiddenByProfile' : 'none';
}

export const SAVED_EMPTY_COPY: Record<SavedEmptyState, { title: string; subtitle: string }> = {
  none: {
    title: 'No saved rates yet',
    subtitle: 'Tap the star on any rate to watch it here, or add the rate you have now to see how it compares. No bank login.',
  },
  unavailable: {
    title: 'Saved rate no longer published',
    subtitle: 'A rate you saved is not in the current data. Remove it, or tap the star on any rate to watch it here.',
  },
  hiddenByProfile: {
    title: 'Saved rates hidden by your profile',
    subtitle: 'Your saved rates do not meet the requirements in your profile. Edit your profile to see them again.',
  },
};
