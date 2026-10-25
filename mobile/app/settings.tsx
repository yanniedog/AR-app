import Ionicons from '../src/components/icons/AppIcon';
import { mandatoryEligibleRows } from '../src/data/eligibilityGate';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { useScrollToTop } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, useWindowDimensions, View } from 'react-native';

import { SegmentedControl } from '../src/components/controls';
import { Screen, ScreenScrollView } from '../src/components/Screen';
import { UndoSnackbar } from '../src/components/Snackbar';
import { SubscriptionRow } from '../src/components/SubscriptionRow';
import { AppText, Button, Chip, Row } from '../src/components/ui';
import { AccountSecurityRows } from '../src/components/settings/AccountSecurityRows';
import {
  AppUpdateSection,
  type AppUpdateSurfaceStatus,
} from '../src/components/settings/AppUpdateSection';
import {
  DisclosureGroup,
  InfoRow,
  InterestOrderRow,
  Label,
  Section,
  SettingsGap,
  ToggleRow,
} from '../src/components/settings/settingsUi';
import { SECTIONS, SECTION_ORDER } from '../src/constants';
import { uiCount, uiDate, uiJoin, uiLabel, uiSectionName, uiSubscriptionLabel } from '../src/lib/uiCopy';
import {
  coverageFailureProvenanceReported,
  coverageFailures,
  coverageObservedAt,
  coverageProvidersAttempted,
  coverageProvidersSucceeded,
} from '../src/data/coverage';
import { moveInterest, orderedInterestSections, toggleInterest } from '../src/data/interests';
import { ensurePermissions } from '../src/data/notifications';
import { useStore } from '../src/data/store';
import { CURRENT_PRIVACY_CHOICE_VERSION, type Prefs } from '../src/data/storeTypes';
import type { MortgageRateMetric, RankMetric } from '../src/data/selectors';
import type { Subscription } from '../src/data/subscriptions';
import type { ThemeMode } from '../src/theme/theme';
import { restorePerformanceAuditPreferences } from '../src/lib/performanceAudit';
import { setCrashReportsEnabled } from '../src/lib/observability';
import {
  effectiveDeepSearch,
  effectiveHistoryRibbon,
} from '../src/lib/proAccess';
import { useUndoSnackbar } from '../src/hooks/useUndoSnackbar';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';

const THRESHOLDS = [1, 5, 10, 25];

export default function Settings() {
  const { width, fontScale } = useWindowDimensions();
  const stackDataActions = width < 400 || fontScale >= 1.3;
  const suitabilityRevision = useSuitabilityRevision();
  const router = useRouter();
  const prefs = useStore((s) => s.prefs);
  const hydrated = useStore((s) => s.hydrated);
  const setPref = useStore((s) => s.setPref);
  const setPrefs = useStore((s) => s.setPrefs);
  const core = useStore((s) => s.core);
  const searchIndex = useStore((s) => s.searchIndex);
  const historyBanks = useStore((s) => s.historyBanks);
  const bankInsights = useStore((s) => s.bankInsights);
  const source = useStore((s) => s.source);
  const refresh = useStore((s) => s.refresh);
  const clearCache = useStore((s) => s.clearCache);
  const lastCheckedAt = useStore((s) => s.lastCheckedAt);
  const subscriptions = useStore((s) => s.subscriptions);
  const removeSubscription = useStore((s) => s.removeSubscription);
  const restoreSubscription = useStore((s) => s.restoreSubscription);
  const { snack, showUndo, undo } = useUndoSnackbar();
  const scrollRef = useRef<ScrollView>(null);
  const [homeSectionsOpen, setHomeSectionsOpen] = useState(false);
  const [dataDetailsOpen, setDataDetailsOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [notificationsPending, setNotificationsPending] = useState(false);
  const notificationsPendingRef = useRef(false);
  const [crashChoicePending, setCrashChoicePending] = useState(false);
  const crashChoicePendingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const [updateStatus, setUpdateStatus] = useState<AppUpdateSurfaceStatus>({
    terminal: false,
    status: 'checking',
    error: null,
  });
  const auditThemeSnapshot = useRef<ThemeMode | null>(null);
  const auditRankSnapshot = useRef<RankMetric | null>(null);
  const auditPreferenceSnapshot = useRef<Prefs | null>(null);
  useScrollToTop(scrollRef);

  const { focus, t } = useLocalSearchParams<{ focus?: string; t?: string }>();
  const updateSectionY = useRef(0);
  useEffect(() => {
    if (focus !== 'update') return;
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, updateSectionY.current - 8), animated: true });
      router.setParams({ focus: undefined, t: undefined });
    }, 350);
    return () => clearTimeout(id);
  }, [focus, t, router]);

  const onToggleDeepSearch = (value: boolean) => {
    setPref('enableDeepSearch', value);
  };

  const onToggleHistoryRibbon = (value: boolean) => {
    setPref('showHistoryRibbon', value);
  };

  const changeTheme = useCallback((value: ThemeMode) => setPref('themeMode', value), [setPref]);
  const changeDepositRank = useCallback(
    (value: RankMetric) => setPref('depositRankMetric', value),
    [setPref],
  );
  const selectNextTheme = useCallback(() => {
    auditThemeSnapshot.current ??= prefs.themeMode;
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    changeTheme(order[(order.indexOf(prefs.themeMode) + 1) % order.length]);
  }, [changeTheme, prefs.themeMode]);
  const restoreTheme = useCallback(() => {
    if (!auditThemeSnapshot.current) return;
    changeTheme(auditThemeSnapshot.current);
    auditThemeSnapshot.current = null;
  }, [changeTheme]);
  const selectNextRank = useCallback(() => {
    auditRankSnapshot.current ??= prefs.depositRankMetric;
    changeDepositRank(prefs.depositRankMetric === 'base' ? 'max' : 'base');
  }, [changeDepositRank, prefs.depositRankMetric]);
  const restoreRank = useCallback(() => {
    if (!auditRankSnapshot.current) return;
    changeDepositRank(auditRankSnapshot.current);
    auditRankSnapshot.current = null;
  }, [changeDepositRank]);
  const changeHomeSectionsOpen = useCallback((next: boolean) => setHomeSectionsOpen(next), []);
  const changeDataDetailsOpen = useCallback((next: boolean) => setDataDetailsOpen(next), []);
  const changeDiagnosticsOpen = useCallback((next: boolean) => setDiagnosticsOpen(next), []);
  const toggleHomeSections = useCallback(
    () => changeHomeSectionsOpen(!homeSectionsOpen),
    [changeHomeSectionsOpen, homeSectionsOpen],
  );
  const toggleDataDetails = useCallback(
    () => changeDataDetailsOpen(!dataDetailsOpen),
    [changeDataDetailsOpen, dataDetailsOpen],
  );
  const toggleDiagnostics = useCallback(
    () => changeDiagnosticsOpen(!diagnosticsOpen),
    [changeDiagnosticsOpen, diagnosticsOpen],
  );
  const captureAuditPreferences = useCallback(() => {
    auditPreferenceSnapshot.current ??= prefs;
  }, [prefs]);
  const toggleAuditPreference = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    captureAuditPreferences();
    setPref(key, value);
  }, [captureAuditPreferences, setPref]);
  const restoreAuditPreferences = useCallback(async () => {
    const snapshot = auditPreferenceSnapshot.current;
    if (!snapshot) return;
    auditPreferenceSnapshot.current = null;
    await restorePerformanceAuditPreferences(snapshot, {
      setPrefs,
      ensureSearchIndex: () => useStore.getState().ensureSearchIndex(),
      ensureHistoryBanks: () => useStore.getState().ensureHistoryBanks(),
      ensureBankInsights: () => useStore.getState().ensureBankInsights(),
    });
  }, [setPrefs]);
  const onUpdateStatusChange = useCallback((next: AppUpdateSurfaceStatus) => {
    setUpdateStatus(next);
  }, []);

  const removeSubscriptionWithUndo = useCallback(
    (sub: Subscription) => {
      removeSubscription(sub.id);
      showUndo('Removed', () => restoreSubscription(sub));
    },
    [removeSubscription, restoreSubscription, showUndo],
  );

  const onToggleNotifications = async (value: boolean) => {
    if (notificationsPendingRef.current) return;
    notificationsPendingRef.current = true;
    setNotificationsPending(true);
    try {
      if (value) {
        const ok = await ensurePermissions();
        if (!ok) {
          Alert.alert('Notifications disabled');
          return;
        }
      }
      await setPref('notificationsEnabled', value);
    } catch {
      Alert.alert('Rate-change alerts', 'Failed');
    } finally {
      notificationsPendingRef.current = false;
      if (mountedRef.current) setNotificationsPending(false);
    }
  };

  const confirmCrashChoice = useCallback(async (value: boolean) => {
    if (crashChoicePendingRef.current) return;
    crashChoicePendingRef.current = true;
    setCrashChoicePending(true);
    try {
      await setCrashReportsEnabled(value);
      setPrefs({ crashReportsEnabled: value, sessionReplayEnabled: false,
        privacyChoiceVersion: CURRENT_PRIVACY_CHOICE_VERSION });
    } catch {
      Alert.alert('Crash reports unchanged', 'Native state unconfirmed');
    } finally {
      crashChoicePendingRef.current = false;
      if (mountedRef.current) setCrashChoicePending(false);
    }
  }, [setPrefs]);
  const privacyChoiceCurrent = prefs.privacyChoiceVersion === CURRENT_PRIVACY_CHOICE_VERSION;
  const sourceLabel = source === 'remote' ? 'Published' : source === 'cache' ? 'Cached' : 'Sample';

  const orderedInterests = orderedInterestSections(prefs.interests);
  const hiddenSections = SECTION_ORDER.filter((key) => !prefs.interests.includes(key));
  const matchingCounts = useMemo(() => {
    if (!core || !dataDetailsOpen) return null;
    const rows = mandatoryEligibleRows(Object.values(core.sections).flatMap(item => item.rates));
    return { providers: new Set(rows.map(row => row.provider)).size,
      products: new Set(rows.map(row => row.product_key)).size, rates: rows.length };
  }, [core, dataDetailsOpen, suitabilityRevision]);

  const settingsRenderRevision = [
    hydrated ? 'hydrated' : 'loading',
    prefs.themeMode,
    prefs.depositRankMetric,
    prefs.mortgageRateMetric,
    prefs.includeNonStandard,
    prefs.enableDeepSearch,
    prefs.showHistoryRibbon,
    prefs.wifiOnly,
    prefs.apkUpdatesWifiOnly,
    prefs.rateMoveThresholdBps,
    prefs.notificationsEnabled,
    prefs.crashReportsEnabled,
    prefs.privacyChoiceVersion,
    prefs.interests.join(','),
    prefs.defaultSection,
    notificationsPending ? '1' : '0',
    crashChoicePending ? '1' : '0',
    homeSectionsOpen ? 'home-open' : 'home-closed',
    dataDetailsOpen ? 'data-open' : 'data-closed',
    diagnosticsOpen ? 'diagnostics-open' : 'diagnostics-closed',
    updateStatus.status,
  ].join(':');
  const auditActions = useMemo(() => ({
    'settings.open': () => undefined,
    'settings.home-sections.toggle': toggleHomeSections,
    'settings.data-details.toggle': toggleDataDetails,
    'settings.diagnostics.toggle': toggleDiagnostics,
    'settings.theme.next': selectNextTheme,
    'settings.theme.restore': restoreTheme,
    'settings.rank.next': selectNextRank,
    'settings.rank.restore': restoreRank,
    'settings.non-standard.toggle': () =>
      toggleAuditPreference('includeNonStandard', !prefs.includeNonStandard),
    'settings.mortgage-rank.next': () => toggleAuditPreference(
      'mortgageRateMetric',
      prefs.mortgageRateMetric === 'headline' ? 'comparison' : 'headline',
    ),
    'settings.interests.reorder': () => toggleAuditPreference(
      'interests',
      prefs.interests.length > 1
        ? [...prefs.interests.slice(1), prefs.interests[0]]
        : prefs.interests,
    ),
    'settings.default-section.next': () => {
      const current = Math.max(0, prefs.interests.indexOf(prefs.defaultSection));
      const next = prefs.interests[(current + 1) % Math.max(1, prefs.interests.length)];
      if (next) toggleAuditPreference('defaultSection', next);
    },
    'settings.deep-search.toggle': () =>
      toggleAuditPreference('enableDeepSearch', !prefs.enableDeepSearch),
    'settings.history-explorer.toggle': () =>
      toggleAuditPreference('showHistoryRibbon', !prefs.showHistoryRibbon),
    'settings.wifi-only.toggle': () => toggleAuditPreference('wifiOnly', !prefs.wifiOnly),
    'settings.apk-wifi-only.toggle': () =>
      toggleAuditPreference('apkUpdatesWifiOnly', !prefs.apkUpdatesWifiOnly),
    'settings.alert-threshold.next': () => {
      const index = Math.max(0, THRESHOLDS.indexOf(prefs.rateMoveThresholdBps));
      toggleAuditPreference(
        'rateMoveThresholdBps',
        THRESHOLDS[(index + 1) % THRESHOLDS.length] ?? THRESHOLDS[0],
      );
    },
    'settings.preferences.restore': restoreAuditPreferences,
    'settings.notifications.observe': () => ({
      enabled: prefs.notificationsEnabled,
      permissionMutationExcluded: true,
    }),
    'settings.privacy.observe': () => ({
      choiceVersion: prefs.privacyChoiceVersion,
      crashReportsEnabled: prefs.crashReportsEnabled,
      sessionReplayEnabled: prefs.sessionReplayEnabled,
      mutationExcluded: true,
    }),
    'settings.app-lock.observe': () => ({
      enabled: prefs.appLockEnabled,
      deviceCredentialMutationExcluded: true,
    }),
    'settings.feature.deep-search.observe': () => searchIndex
      ? { enabled: effectiveDeepSearch(prefs), assetAvailable: true }
      : { unavailableReason: 'The trusted deep-search index is absent' },
    'settings.feature.history-explorer.observe': () => historyBanks && bankInsights
      ? { enabled: effectiveHistoryRibbon(prefs), assetsAvailable: true }
      : { unavailableReason: 'The trusted history or bank-insights asset is absent' },
    'settings.update-status.observe': () => updateStatus.error
      ? { unavailableReason: `Update status ended with an error: ${updateStatus.error}` }
      : updateStatus,
  }), [
    prefs,
    bankInsights,
    historyBanks,
    restoreRank,
    restoreTheme,
    restoreAuditPreferences,
    selectNextRank,
    selectNextTheme,
    searchIndex,
    toggleDataDetails,
    toggleDiagnostics,
    toggleHomeSections,
    toggleAuditPreference,
    updateStatus,
  ]);
  usePerformanceAuditSurface({
    id: 'settings.sections',
    routeKey: '/settings',
    datasetRevision: core?.run_date ?? null,
    renderRevision: settingsRenderRevision,
    actions: auditActions,
    probes: [
      {
        id: 'settings.preferences',
        kind: 'data',
        status: hydrated ? 'ready' : 'pending',
        expectedCount: 1,
        actualCount: hydrated ? 1 : 0,
      },
      {
        id: 'settings.update-status',
        kind: 'data',
        required: !updateStatus.terminal || updateStatus.error == null,
        status: !updateStatus.terminal
          ? 'pending'
          : updateStatus.error
            ? 'error'
            : 'ready',
        error: updateStatus.error,
      },
      {
        id: 'settings.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
        renderRevision: settingsRenderRevision,
      },
    ],
  });

  return (
    <Screen>
    <ScreenScrollView
      ref={scrollRef}
      showDataHealthBanner={false}
      contentContainerStyle={{ padding: 16, paddingBottom: snack ? 96 : 40 }}
      onContentSizeChange={() => setLayoutReady(true)}
    >
      <View onLayout={(e) => { updateSectionY.current = e.nativeEvent.layout.y; }}>
        <AppUpdateSection onStatusChange={onUpdateStatusChange} />
      </View>

      <Section title="Appearance">
        <Label text="Theme" />
        <SegmentedControl<ThemeMode>
          options={[
            { value: 'system', label: uiLabel("System") },
            { value: 'light', label: uiLabel("Light") },
            { value: 'dark', label: uiLabel("Dark") },
          ]}
          value={prefs.themeMode}
          onChange={changeTheme}
        />
      </Section>

      <Section title="Rate display">
        <ToggleRow
          icon="people-outline"
          label="Widely available products"
          value={!prefs.includeNonStandard}
          onChange={(v) => setPref('includeNonStandard', !v)}
        />
        <SettingsGap size={14} />
        <Label text="Deposit ranking" />
        <SegmentedControl<RankMetric>
          options={[
            { value: 'base', label: uiLabel("Base rate") },
            { value: 'max', label: uiLabel("Headline rate") },
          ]}
          value={prefs.depositRankMetric}
          onChange={changeDepositRank}
        />
        <SettingsGap size={14} />
        <Label text="Mortgage ranking" />
        <SegmentedControl<MortgageRateMetric>
          options={[
            { value: 'headline', label: uiLabel("Headline rate") },
            { value: 'comparison', label: uiLabel("Comparison rate") },
          ]}
          value={prefs.mortgageRateMetric}
          onChange={(v) => setPref('mortgageRateMetric', v)}
        />
      </Section>

      <Section title="Personalise">
        <Button
          title="Your product profile"
          icon="person-circle-outline"
          variant="secondary"
          onPress={() => router.push('/profile' as Href)}
        />
        <SettingsGap size={12} />
        <DisclosureGroup
          title="Preferred types"
          open={homeSectionsOpen}
          onOpenChange={changeHomeSectionsOpen}
        >
          {orderedInterests.map((key, idx, ordered) => (
            <InterestOrderRow
              key={key}
              title={uiSectionName(key)}
              canMoveUp={idx > 0}
              canMoveDown={idx < ordered.length - 1}
              canRemove={ordered.length > 1}
              onMoveUp={() => setPref('interests', moveInterest(prefs.interests, key, 'up'))}
              onMoveDown={() => setPref('interests', moveInterest(prefs.interests, key, 'down'))}
              onRemove={() => setPref('interests', toggleInterest(prefs.interests, key))}
            />
          ))}
          {hiddenSections.length ? (
            <>
              <SettingsGap size={8} />
              <Label text="Add section" />
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {hiddenSections.map((key) => (
                  <Chip
                    key={key}
                    label={uiSectionName(key)}
                    icon={SECTIONS[key].icon as keyof typeof Ionicons.glyphMap}
                    onPress={() => setPref('interests', toggleInterest(prefs.interests, key))}
                  />
                ))}
              </Row>
            </>
          ) : null}
        </DisclosureGroup>
        <SettingsGap size={12} />
        <Label text="Default type" />
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {orderedInterests.map((key) => (
            <Chip
              key={key}
              label={uiSectionName(key)}
              selected={prefs.defaultSection === key}
              onPress={() => setPref('defaultSection', key)}
            />
          ))}
        </Row>
      </Section>

      <Section title="Features">
        <ToggleRow
          icon="search-outline"
          label="Deep product search"
          value={effectiveDeepSearch(prefs)}
          onChange={onToggleDeepSearch}
        />
        <SettingsGap size={10} />
        <ToggleRow
          icon="analytics-outline"
          label="History explorer"
          value={effectiveHistoryRibbon(prefs)}
          onChange={onToggleHistoryRibbon}
        />
      </Section>

      <Section title="Alerts">
        <ToggleRow
          icon="notifications-outline"
          label="Rate-change alerts"
          value={prefs.notificationsEnabled}
          disabled={notificationsPending}
          onChange={onToggleNotifications}
        />
        {prefs.notificationsEnabled ? (
          <>
            <SettingsGap size={12} />
            <Label text="Alert threshold" />
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {THRESHOLDS.map((bps) => (
                <Chip
                  key={bps}
                  label={uiJoin(uiCount(bps), ' ', 'bps')}
                  selected={prefs.rateMoveThresholdBps === bps}
                  onPress={() => setPref('rateMoveThresholdBps', bps)}
                />
              ))}
            </Row>
            <SettingsGap size={12} />
            <Label text={uiJoin('Subscriptions', ' ', '(', uiCount(subscriptions.length), ')')} />
            {subscriptions.length ? (
              subscriptions.map((sub: Subscription) => (
                <SubscriptionRow
                  key={sub.id}
                  kind={sub.kind === 'product' ? 'Product' : 'Search'}
                  label={uiSubscriptionLabel(sub, core)}
                  onSwipeRemove={() => removeSubscriptionWithUndo(sub)}
                  onConfirmRemove={() => removeSubscription(sub.id)}
                />
              ))
            ) : (
              <AppText variant="tiny" color="textFaint">{uiLabel("None")}</AppText>
            )}
          </>
        ) : null}
      </Section>

      <Section title="Data">
        <ToggleRow
          icon="wifi-outline"
          label="Refresh on Wi-Fi only"
          value={prefs.wifiOnly}
          onChange={(v) => setPref('wifiOnly', v)}
        />
        <SettingsGap size={10} />
        <Row gap={12} style={{ flexDirection: stackDataActions ? 'column' : 'row', alignItems: 'stretch' }}>
          <Button
            title="Refresh now"
            icon="refresh"
            variant="secondary"
            style={{ flex: stackDataActions ? undefined : 1 }}
            onPress={() => void refresh({ manual: true })}
          />
          <Button
            title="Clear cache"
            icon="trash-outline"
            variant="ghost"
            style={{ flex: stackDataActions ? undefined : 1 }}
            onPress={() =>
              Alert.alert('Clear cached data?', 'Offline data removed', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: () => void clearCache() },
              ])
            }
          />
        </Row>
        <SettingsGap size={8} />
        <DisclosureGroup
          title="Data details"
          open={dataDetailsOpen}
          onOpenChange={changeDataDetailsOpen}

        >
          <InfoRow label="Data set" value={uiDate(core?.run_date)} />
          <InfoRow label="Source" value={sourceLabel} />
          <InfoRow label="Last checked" value={uiDate(lastCheckedAt)} />
          <InfoRow label="Matching banks" value={uiCount(matchingCounts?.providers)} />
          <InfoRow
            label="Matching products"
            value={uiCount(matchingCounts?.products)}
          />
          <InfoRow
            label="Matching rates"
            value={uiCount(matchingCounts?.rates)}
          />
          <InfoRow
            label="Coverage observed"
            value={uiDate(coverageObservedAt(core?.coverage))}
          />
          <InfoRow
            label="Providers reached"
            value={uiCount(coverageProvidersAttempted(core?.coverage))}
          />
          <InfoRow
            label="Providers observed"
            value={uiCount(coverageProvidersSucceeded(core?.coverage))}
          />
          <InfoRow
            label="Provider failure groups"
            value={coverageFailureProvenanceReported(core?.coverage)
              ? uiCount(coverageFailures(core?.coverage).length)
              : 'Unknown'}
          />
          {source === 'sample' ? (
            <InfoRow label="Market basis" value="Sample" />
          ) : null}
          <InfoRow label="Coverage basis" value="Observed publications" />
          <InfoRow label="Fees / eligibility / conditions" value="Partial / Unknown" />
        </DisclosureGroup>
      </Section>

      <Section title="Account & privacy">
        <AccountSecurityRows
          appLockEnabled={prefs.appLockEnabled}
          onAppLockChange={(v) => setPref('appLockEnabled', v)}
        />
        <SettingsGap size={8} />
        <DisclosureGroup
          title="Optional reporting"
          open={diagnosticsOpen}
          onOpenChange={changeDiagnosticsOpen}

        >
          <ToggleRow
            icon="pulse-outline"
            label="Crash reports"
            value={privacyChoiceCurrent && prefs.crashReportsEnabled}
            disabled={crashChoicePending}
            onChange={confirmCrashChoice}
          />
          <SettingsGap size={8} />
          <InfoRow label="Sent" value="Crash traces · Fixed error categories" />
          <InfoRow label="Excluded" value="Financial inputs · Saved rates · Searches · Logs · Audit reports · Notification content" />
          <InfoRow label="Destination" value="Firebase Crashlytics" />
          <InfoRow label="Access" value="Maintainers" />
          <InfoRow label="Session replay" value="Not collected" />
          {!privacyChoiceCurrent ? <>
            <InfoRow label="Consent" value="Undecided" />
            <Row gap={8}>
              <Button title="Allow" onPress={() => confirmCrashChoice(true)} disabled={crashChoicePending} style={{ flex: 1 }} />
              <Button title="Decline" variant="secondary" onPress={() => confirmCrashChoice(false)} disabled={crashChoicePending} style={{ flex: 1 }} />
            </Row>
          </> : null}
          <AppText variant="small" weight="700">{uiLabel("Audit sharing")}</AppText>
          <InfoRow label="Audit log upload" value="Optional" />
          <InfoRow label="Paste visibility" value="Public" />
          <InfoRow label="Full evidence" value="This device" />
        </DisclosureGroup>
      </Section>

    </ScreenScrollView>
    <UndoSnackbar snack={snack} onUndo={undo} />
    </Screen>
  );
}
