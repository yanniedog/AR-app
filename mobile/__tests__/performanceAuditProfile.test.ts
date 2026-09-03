import { SECTION_ORDER } from '../src/constants';
import { DEFAULT_PREFS, type Prefs } from '../src/data/storeTypes';
import {
  MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID,
  maximumPerformanceAuditPrefs,
  maximumPerformanceAuditProfileWasEnabled,
} from '../src/lib/performanceAuditProfile';

describe('maximum performance audit profile', () => {
  it('enables every safe local feature and section', () => {
    const profile = maximumPerformanceAuditPrefs(DEFAULT_PREFS);
    expect(MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID).toBe('maximum-safe-coverage-v1');
    expect(profile).toMatchObject({
      defaultSection: 'Mortgage',
      includeNonStandard: true,
      depositRankMetric: 'max',
      mortgageRateMetric: 'comparison',
      enableDeepSearch: true,
      showHistoryRibbon: true,
      rateIntelligencePro: true,
      onboarded: true,
      dismissedUpdateBuild: null,
    });
    expect(profile.interests).toEqual(SECTION_ORDER);
  });

  it('does not change consent, permissions, authentication or device policy', () => {
    const original = {
      ...DEFAULT_PREFS,
      notificationsEnabled: true,
      crashReportsEnabled: false,
      sessionReplayEnabled: false,
      privacyChoiceVersion: 2,
      appLockEnabled: true,
      wifiOnly: true,
      apkUpdatesWifiOnly: false,
    };
    const profile = maximumPerformanceAuditPrefs(original);
    expect(profile).toMatchObject({
      notificationsEnabled: original.notificationsEnabled,
      crashReportsEnabled: original.crashReportsEnabled,
      sessionReplayEnabled: original.sessionReplayEnabled,
      privacyChoiceVersion: original.privacyChoiceVersion,
      appLockEnabled: original.appLockEnabled,
      wifiOnly: original.wifiOnly,
      apkUpdatesWifiOnly: original.apkUpdatesWifiOnly,
    });
  });

  it('returns fresh interests without mutating the user snapshot', () => {
    const original = { ...DEFAULT_PREFS, interests: ['Savings'] as Prefs['interests'] };
    const profile = maximumPerformanceAuditPrefs(original);
    expect(original.interests).toEqual(['Savings']);
    expect(profile.interests).not.toBe(original.interests);
  });

  it('reports enabled profile state independently of optional-asset availability', () => {
    expect(maximumPerformanceAuditProfileWasEnabled({ maximumSafeFeaturesEnabled: true })).toBe(true);
    expect(maximumPerformanceAuditProfileWasEnabled({ maximumSafeFeaturesEnabled: false })).toBe(false);
    expect(maximumPerformanceAuditProfileWasEnabled(undefined)).toBe(false);
  });
});
