import type { Prefs } from '../data/store';

/**
 * Feature availability. Every feature ships free; these read the user's own
 * preference toggles, nothing else. There is no entitlement or purchase tier.
 */

export function effectiveDeepSearch(prefs: Pick<Prefs, 'enableDeepSearch'>): boolean {
  return prefs.enableDeepSearch;
}

export function effectiveHistoryRibbon(prefs: Pick<Prefs, 'showHistoryRibbon'>): boolean {
  return prefs.showHistoryRibbon;
}

/** Bank intelligence (per-bank history + rate-move events) has no separate pref. */
export function effectiveBankInsights(): boolean {
  return true;
}
