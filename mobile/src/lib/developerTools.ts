import { useStore } from '../data/store';

/**
 * Maintainer-only surfaces (performance audit, debug log). Hidden from the
 * Settings list until the version row is tapped seven times, and the routes
 * themselves are guarded so direct navigation cannot bypass that unlock.
 *
 * The audit plan drives `/debug-log` as one of its route scenarios, but an
 * audit can only be started from `/performance-audit`, which requires the same
 * unlock — so gating both keeps the plan working.
 *
 * Returns `null` while persisted prefs are still rehydrating. Callers must
 * wait rather than treating that as "locked": AsyncStorage loads async, so an
 * unlocked user cold-launching a deep link would otherwise be bounced to
 * Settings a moment before the real value arrives.
 */
export function useDeveloperToolsEnabled(): boolean | null {
  const hydrated = useStore((s) => s.hydrated);
  const unlocked = useStore((s) => s.prefs.developerToolsUnlocked);
  if (__DEV__) return true;
  if (!hydrated) return null;
  return unlocked;
}
