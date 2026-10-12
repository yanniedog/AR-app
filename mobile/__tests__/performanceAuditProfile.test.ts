import { auditSearchUsesBasicFallback, canPrepareAuditBankInsights, canPrepareAuditSearchIndex } from '../src/lib/performanceAuditProfile';
import type { Manifest } from '../src/types';
import { SECTION_ORDER } from '../src/constants';
import { DEFAULT_PREFS, type Prefs } from '../src/data/storeTypes';
import {
  MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID,
  maximumPerformanceAuditPrefs,
  maximumPerformanceAuditProfileWasEnabled,
} from '../src/lib/performanceAuditProfile';

describe('maximum performance audit profile', () => {
  it('accepts only an explicitly unavailable offline index as basic-search coverage', () => {
    expect(auditSearchUsesBasicFallback(true, 'unavailable', false)).toBe(true);
    expect(auditSearchUsesBasicFallback(false, 'unavailable', false)).toBe(false);
    expect(auditSearchUsesBasicFallback(true, 'unavailable', true)).toBe(false);
    for (const status of ['idle', 'loading', 'error', 'ready'] as const) {
      expect(auditSearchUsesBasicFallback(true, status, false)).toBe(false);
    }
  });
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

it('requires live authorization for the exact pinned search descriptor', () => {
  const pinned = { files: { core: { sha256: 'core' }, search_index: { sha256: 'index', url: 'https://github.com/index' } } } as Manifest;
  expect(canPrepareAuditSearchIndex('live-source', pinned, pinned)).toBe(true);
  expect(canPrepareAuditSearchIndex('local', pinned, pinned)).toBe(false);
  expect(canPrepareAuditSearchIndex('live-source', pinned, null)).toBe(false);
  expect(canPrepareAuditSearchIndex('live-source', pinned, { ...pinned, files: { ...pinned.files, core: { ...pinned.files.core, sha256: 'new-core' } } })).toBe(false);
  expect(canPrepareAuditSearchIndex('live-source', pinned, { ...pinned, files: { ...pinned.files, search_index: { ...pinned.files.search_index!, url: 'https://other.test/index' } } })).toBe(false);
});

it('requires the authenticated pinned core, date and bank-intelligence descriptor for online preparation', () => {
  const pinned = { run_date: '2026-10-12', files: {
    core: { sha256: 'core' }, bank_history: { sha256: 'bank-history', url: 'https://github.com/bank-history' },
  } } as Manifest;
  expect(canPrepareAuditBankInsights('live-source', pinned, pinned)).toBe(true);
  expect(canPrepareAuditBankInsights('local', pinned, pinned)).toBe(false);
  expect(canPrepareAuditBankInsights('live-source', null, pinned)).toBe(false);
  expect(canPrepareAuditBankInsights('live-source', pinned, null)).toBe(false);
  for (const live of [
    { ...pinned, run_date: '2026-10-13' },
    { ...pinned, files: { ...pinned.files, core: { ...pinned.files.core, sha256: 'another-core' } } },
    { ...pinned, files: { ...pinned.files, core: { ...pinned.files.core, sha256: '' } } },
    { ...pinned, files: { ...pinned.files, bank_history: undefined } },
    { ...pinned, files: { ...pinned.files, bank_history: { ...pinned.files.bank_history!, sha256: 'another-history' } } },
    { ...pinned, files: { ...pinned.files, bank_history: { ...pinned.files.bank_history!, url: 'https://other.test/history' } } },
  ]) {
    expect(canPrepareAuditBankInsights('live-source', pinned, live)).toBe(false);
  }
});
