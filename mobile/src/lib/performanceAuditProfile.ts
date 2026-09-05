import type { Manifest } from '../types';
import type { AppHealthAuditMode } from './appHealth';
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

/** Only the exact pinned descriptor authenticated in this session may be warmed. */
export function canPrepareAuditSearchIndex(
  mode: AppHealthAuditMode,
  pinned: Manifest | null | undefined,
  live: Manifest | null | undefined,
): boolean {
  const file = live?.files.search_index;
  return mode === 'live-source' && Boolean(file?.sha256) &&
    live?.files.core.sha256 === pinned?.files.core.sha256 &&
    file?.sha256 === pinned?.files.search_index?.sha256 &&
    file?.url === pinned?.files.search_index?.url;
}
