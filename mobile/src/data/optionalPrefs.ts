import { effectiveDeepSearch } from '../lib/proAccess';
import type { Subscription } from './subscriptions';

export interface OptionalFeaturePrefs {
  enableDeepSearch: boolean;
  showHistoryRibbon: boolean;
  notificationsEnabled: boolean;
  rateIntelligencePro: boolean;
  /** Saved profile may require details for CDR account-feature matching. */
  profileFilters?: { accountFeatures?: string[] } | null;
}

/** True when saved profile feature picks need the details payload to apply. */
export function profileAccountFeaturesNeedDetails(
  profileFilters?: { accountFeatures?: string[] } | null,
): boolean {
  return (profileFilters?.accountFeatures?.length ?? 0) > 0;
}

/** True when refresh/background should download the bulk details payload. */
export function shouldWarmDetails(prefs: OptionalFeaturePrefs, subscriptions: Subscription[]): boolean {
  if (effectiveDeepSearch(prefs)) return true;
  if (profileAccountFeaturesNeedDetails(prefs.profileFilters)) return true;

  return needsDetailsForNotifications(prefs, subscriptions);
}

/**
 * Details are only needed while diffing notifications whose saved search uses
 * product-level feature or eligibility filters. Keeping this separate from
 * `shouldWarmDetails` prevents a deep-search preference from pulling an old
 * multi-megabyte details cache into an otherwise unrelated refresh.
 */
export function needsDetailsForNotifications(
  prefs: Pick<OptionalFeaturePrefs, 'notificationsEnabled'>,
  subscriptions: Subscription[],
): boolean {
  if (!prefs.notificationsEnabled) return false;

  return subscriptions.some(
    (s) =>
      s.kind === 'search' &&
      ((s.filters?.accountFeatures?.length ?? 0) > 0 ||
        (s.filters?.eligibilityCriteria?.length ?? 0) > 0),
  );
}
