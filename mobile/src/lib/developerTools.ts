import { useStore } from '../data/store';

/**
 * Maintainer-only surfaces (performance audit, debug log). Hidden from the
 * Settings list until the version row is tapped seven times, and the routes
 * themselves are guarded so direct navigation cannot bypass that unlock.
 *
 * The audit plan drives `/debug-log` as one of its route scenarios, but an
 * audit can only be started from `/performance-audit`, which requires the same
 * unlock — so gating both keeps the plan working.
 */
export function useDeveloperToolsEnabled(): boolean {
  const unlocked = useStore((s) => s.prefs.developerToolsUnlocked);
  return __DEV__ || unlocked;
}
