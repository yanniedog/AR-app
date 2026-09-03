import { SECTION_ORDER } from '../constants';
import type { Prefs } from '../data/storeTypes';

export const MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID = 'maximum-safe-coverage-v1' as const;

/** Read the profile result itself, even when optional assets make its check unmeasurable. */
export function maximumPerformanceAuditProfileWasEnabled(
  metrics: Readonly<Record<string, unknown>> | null | undefined,
): boolean {
  return metrics?.maximumSafeFeaturesEnabled === true;
}

/**
 * Enable every safe, local feature while an audit runs. The caller journals and
 * restores the complete store first; permission, privacy, authentication,
 * app-lock and network-policy preferences deliberately remain untouched.
 */
export function maximumPerformanceAuditPrefs(original: Prefs): Prefs {
  return {
    ...original,
    defaultSection: 'Mortgage',
    interests: [...SECTION_ORDER],
    includeNonStandard: true,
    depositRankMetric: 'max',
    mortgageRateMetric: 'comparison',
    enableDeepSearch: true,
    showHistoryRibbon: true,
    rateIntelligencePro: true,
    onboarded: true,
    dismissedUpdateBuild: null,
  };
}
