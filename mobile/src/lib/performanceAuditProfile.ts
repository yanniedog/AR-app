import { SECTION_ORDER } from '../constants';
import type { Prefs } from '../data/storeTypes';

export const MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID = 'maximum-safe-coverage-v1' as const;

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
