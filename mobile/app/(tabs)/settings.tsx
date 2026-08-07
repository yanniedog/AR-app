import Ionicons from '@expo/vector-icons/Ionicons';
import * as Application from 'expo-application';
import { useScrollToTop } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { SegmentedControl } from '../../src/components/controls';
import { Screen, ScreenScrollView } from '../../src/components/Screen';
import { UndoSnackbar } from '../../src/components/Snackbar';
import { SubscriptionRow } from '../../src/components/SubscriptionRow';
import { AppText, Button, Chip, Row } from '../../src/components/ui';
import { AccountSecurityRows } from '../../src/components/settings/AccountSecurityRows';
import {
  AppUpdateSection,
  type AppUpdateSurfaceStatus,
} from '../../src/components/settings/AppUpdateSection';
import {
  DisclosureGroup,
  InfoRow,
  InterestOrderRow,
  Label,
  NavRow,
  Section,
  SettingsGap,
  ToggleRow,
} from '../../src/components/settings/settingsUi';
import { SECTIONS, SECTION_ORDER } from '../../src/constants';
import { formatRunDate, relativeDate } from '../../src/data/format';
import {
  coverageFailureProvenanceReported,
  coverageFailures,
  coverageObservedAt,
  coverageProvidersAttempted,
  coverageProvidersSucceeded,
} from '../../src/data/coverage';
import { moveInterest, orderedInterestSections, toggleInterest } from '../../src/data/interests';
import { ensurePermissions } from '../../src/data/notifications';
import { useStore } from '../../src/data/store';
import { CURRENT_PRIVACY_CHOICE_VERSION } from '../../src/data/storeTypes';
import type { MortgageRateMetric, RankMetric } from '../../src/data/selectors';
import type { Subscription } from '../../src/data/subscriptions';
import type { ThemeMode } from '../../src/theme/theme';
import { dataSourceLabel } from '../../src/lib/nextIngest';
import {
  effectiveDeepSearch,
  effectiveHistoryRibbon,
} from '../../src/lib/proAccess';
import { useUndoSnackbar } from '../../src/hooks/useUndoSnackbar';
import { usePerformanceAuditSurface } from '../../src/hooks/usePerformanceAuditReadiness';

const THRESHOLDS = [1, 5, 10, 25];

export default function Settings() {
  const router = useRouter();
  const prefs = useStore((s) => s.prefs);
  const hydrated = useStore((s) => s.hydrated);
  const setPref = useStore((s) => s.setPref);
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
  const [updateStatus, setUpdateStatus] = useState<AppUpdateSurfaceStatus>({
    terminal: false,
    status: 'checking',
    error: null,
  });
  const auditThemeSnapshot = useRef<ThemeMode | null>(null);
  const auditRankSnapshot = useRef<RankMetric | null>(null);
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
  const onUpdateStatusChange = useCallback((next: AppUpdateSurfaceStatus) => {
    setUpdateStatus(next);
  }, []);

  const removeSubscriptionWithUndo = useCallback(
    (sub: Subscription) => {
      removeSubscription(sub.id);
      showUndo(`Removed ${sub.label}`, () => restoreSubscription(sub));
    },
    [removeSubscription, restoreSubscription, showUndo],
  );

  const onToggleNotifications = async (value: boolean) => {
    if (value) {
      const ok = await ensurePermissions();
      if (!ok) {
        Alert.alert('Notifications disabled', 'Enable notifications for Australian Rates in system settings.');
        return;
      }
      setPref('notificationsEnabled', true);
    } else {
      setPref('notificationsEnabled', false);
    }
  };

  const orderedInterests = orderedInterestSections(prefs.interests);
  const hiddenSections = SECTION_ORDER.filter((key) => !prefs.interests.includes(key));
  const sectionsSummary = orderedInterests.map((key) => SECTIONS[key].title).join(' · ');

  const settingsRenderRevision = [
    hydrated ? 'hydrated' : 'loading',
    prefs.themeMode,
    prefs.depositRankMetric,
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
    'settings.feature.deep-search.observe': () => searchIndex
      ? effectiveDeepSearch(prefs)
      : { unavailableReason: 'The trusted deep-search index is absent' },
    'settings.feature.history-explorer.observe': () => historyBanks && bankInsights
      ? effectiveHistoryRibbon(prefs)
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
    selectNextRank,
    selectNextTheme,
    searchIndex,
    toggleDataDetails,
    toggleDiagnostics,
    toggleHomeSections,
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
        renderRevision: settingsRenderRevision,
      },
    ],
  });

  return (
    <Screen>
    <ScreenScrollView
      ref={scrollRef}
      contentContainerStyle={{ padding: 16, paddingBottom: snack ? 96 : 40 }}
      onContentSizeChange={() => setLayoutReady(true)}
    >
      <Section title="Rate insights (free beta)">
        <InfoRow label="Access" value="Included" />
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 4, lineHeight: 16 }}>
          Alerts, deep search, lender behaviour, and history are included while these features are in beta.
          No purchase or subscription is required.
        </AppText>
      </Section>

      <View onLayout={(e) => { updateSectionY.current = e.nativeEvent.layout.y; }}>
        <AppUpdateSection onStatusChange={onUpdateStatusChange} />
      </View>

      <Section title="Appearance">
        <Label text="Theme" />
        <SegmentedControl<ThemeMode>
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={prefs.themeMode}
          onChange={changeTheme}
        />
        <SettingsGap size={14} />
        <ToggleRow
          icon="people-outline"
          label="Broadly applicable products"
          sub="Hide youth, region, staff-only, and other restricted products by default"
          value={!prefs.includeNonStandard}
          onChange={(v) => setPref('includeNonStandard', !v)}
        />
        <SettingsGap size={14} />
        <Label text="Rank savings & term deposits by" />
        <SegmentedControl<RankMetric>
          options={[
            { value: 'base', label: 'Base rate' },
            { value: 'max', label: 'Headline rate' },
          ]}
          value={prefs.depositRankMetric}
          onChange={changeDepositRank}
        />
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 6, lineHeight: 16 }}>
          Base uses the ongoing rate; Headline includes bonus and introductory rates.
        </AppText>
        <SettingsGap size={14} />
        <Label text="Sort home loans by" />
        <SegmentedControl<MortgageRateMetric>
          options={[
            { value: 'headline', label: 'Headline rate' },
            { value: 'comparison', label: 'Comparison rate' },
          ]}
          value={prefs.mortgageRateMetric}
          onChange={(v) => setPref('mortgageRateMetric', v)}
        />
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 6, lineHeight: 16 }}>
          Headline is the advertised interest rate on cards; Comparison includes fees.
        </AppText>
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
          title="Home sections"
          summary={sectionsSummary || 'None'}
          open={homeSectionsOpen}
          onOpenChange={changeHomeSectionsOpen}
        >
          {orderedInterests.map((key, idx, ordered) => (
            <InterestOrderRow
              key={key}
              title={SECTIONS[key].title}
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
                    label={SECTIONS[key].title}
                    icon={SECTIONS[key].icon as keyof typeof Ionicons.glyphMap}
                    onPress={() => setPref('interests', toggleInterest(prefs.interests, key))}
                  />
                ))}
              </Row>
            </>
          ) : null}
        </DisclosureGroup>
        <SettingsGap size={12} />
        <Label text="Default category" />
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {orderedInterests.map((key) => (
            <Chip
              key={key}
              label={SECTIONS[key].title}
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
          sub="Search fees, features, and eligibility · free beta"
          value={effectiveDeepSearch(prefs)}
          onChange={onToggleDeepSearch}
        />
        <SettingsGap size={10} />
        <ToggleRow
          icon="analytics-outline"
          label="History explorer"
          sub="Charts, market history, and lender trends · free beta"
          value={effectiveHistoryRibbon(prefs)}
          onChange={onToggleHistoryRibbon}
        />
      </Section>

      <Section title="Alerts">
        <ToggleRow
          icon="notifications-outline"
          label="Rate-change alerts"
          sub="Best-rate, RBA, watchlist, and subscriptions"
          value={prefs.notificationsEnabled}
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
                  label={`${bps} bps`}
                  selected={prefs.rateMoveThresholdBps === bps}
                  onPress={() => setPref('rateMoveThresholdBps', bps)}
                />
              ))}
            </Row>
            <SettingsGap size={12} />
            <Label text={`Subscriptions (${subscriptions.length})`} />
            {subscriptions.length ? (
              subscriptions.map((sub: Subscription) => (
                <SubscriptionRow
                  key={sub.id}
                  kind={sub.kind === 'product' ? 'Product' : 'Search'}
                  label={sub.label}
                  onSwipeRemove={() => removeSubscriptionWithUndo(sub)}
                  onConfirmRemove={() => removeSubscription(sub.id)}
                />
              ))
            ) : (
              <AppText variant="tiny" color="textFaint">
                None — add from a product or search screen.
              </AppText>
            )}
          </>
        ) : null}
      </Section>

      <Section title="Data">
        <ToggleRow
          icon="wifi-outline"
          label="Refresh on Wi-Fi only"
          sub="Skip background updates on cellular"
          value={prefs.wifiOnly}
          onChange={(v) => setPref('wifiOnly', v)}
        />
        <SettingsGap size={10} />
        <Row gap={12}>
          <Button
            title="Refresh now"
            icon="refresh"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => void refresh({ manual: true })}
          />
          <Button
            title="Clear cache"
            icon="trash-outline"
            variant="ghost"
            style={{ flex: 1 }}
            onPress={() =>
              Alert.alert('Clear cached data?', 'The app will re-download on next refresh.', [
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
          summary={
            core
              ? `${formatRunDate(core.run_date)} · ${dataSourceLabel(source)}`
              : 'No data loaded'
          }
        >
          <InfoRow label="Data set" value={core ? formatRunDate(core.run_date) : '—'} />
          <InfoRow label="Source" value={dataSourceLabel(source)} />
          <InfoRow label="Last checked" value={lastCheckedAt ? relativeDate(lastCheckedAt) : 'never'} />
          <InfoRow label="Brands observed" value={core ? String(Object.keys(core.brands ?? {}).length) : '—'} />
          <InfoRow
            label="Products observed"
            value={core ? String(Object.values(core.sections).reduce((sum, item) => sum + (item.ribbon?.counts?.products ?? 0), 0)) : '—'}
          />
          <InfoRow
            label="Rates observed"
            value={core ? String(Object.values(core.sections).reduce((sum, item) => sum + item.rates.length, 0)) : '—'}
          />
          <InfoRow
            label="Coverage observed"
            value={coverageObservedAt(core?.coverage) ? formatRunDate(coverageObservedAt(core?.coverage)!) : 'Not reported by this data set'}
          />
          <InfoRow
            label="Providers reached"
            value={coverageProvidersAttempted(core?.coverage) != null ? String(coverageProvidersAttempted(core?.coverage)) : 'Not reported by this data set'}
          />
          <InfoRow
            label="Providers observed"
            value={coverageProvidersSucceeded(core?.coverage) != null ? String(coverageProvidersSucceeded(core?.coverage)) : 'Not reported by this data set'}
          />
          <InfoRow
            label="Provider failure groups"
            value={coverageFailureProvenanceReported(core?.coverage)
              ? String(coverageFailures(core?.coverage).length)
              : 'Not reported by this data set'}
          />
          {source === 'sample' ? (
            <AppText variant="tiny" color="warning" style={{ marginTop: 6, lineHeight: 16 }}>
              Bundled sample only — not today’s market. Connect and refresh before relying on a rate.
            </AppText>
          ) : null}
          <AppText variant="tiny" color="textFaint" style={{ marginTop: 6, lineHeight: 16 }}>
            Coverage reflects successfully observed CDR publications, not every product in the Australian market.
            Lenders may publish incomplete fees, eligibility, or conditional-rate details.
          </AppText>
        </DisclosureGroup>
      </Section>

      <Section title="Account & privacy">
        <AccountSecurityRows
          appLockEnabled={prefs.appLockEnabled}
          onAppLockChange={(v) => setPref('appLockEnabled', v)}
        />
        <SettingsGap size={8} />
        <DisclosureGroup
          title="Diagnostics & debug"
          open={diagnosticsOpen}
          onOpenChange={changeDiagnosticsOpen}
          summary={
            prefs.crashReportsEnabled || prefs.sessionReplayEnabled
              ? 'Optional reporting on'
              : 'Reporting off'
          }
        >
          <ToggleRow
            icon="pulse-outline"
            label="Crash reports"
            sub="Send technical crashes and non-debug error logs through Crashlytics"
            value={prefs.crashReportsEnabled}
            onChange={(value) => {
              setPref('crashReportsEnabled', value);
              setPref('privacyChoiceVersion', CURRENT_PRIVACY_CHOICE_VERSION);
            }}
          />
          <SettingsGap size={8} />
          <ToggleRow
            icon="eye-outline"
            label="Session replay"
            sub="Share interaction replays through Clarity; financial-input screens stay excluded"
            value={prefs.sessionReplayEnabled}
            onChange={(value) => {
              setPref('sessionReplayEnabled', value);
              setPref('privacyChoiceVersion', CURRENT_PRIVACY_CHOICE_VERSION);
            }}
          />
          <SettingsGap size={8} />
          <NavRow
            icon="speedometer-outline"
            label="Performance audit"
            sub="Test every screen, navigation, responsiveness, storage, and network"
            onPress={() => router.push('/performance-audit' as Href)}
          />
          <SettingsGap size={8} />
          <NavRow
            icon="document-text-outline"
            label="Debug log"
            sub="View, share, or upload logs"
            onPress={() => router.push('/debug-log' as Href)}
          />
        </DisclosureGroup>
      </Section>

      <Section title="About">
        <InfoRow
          label="Version"
          value={`${Application.nativeApplicationVersion ?? '1.0.0'} (${Application.nativeBuildVersion ?? '0'})`}
        />
        <SettingsGap size={4} />
        <NavRow
          icon="document-text-outline"
          label="Terms"
          sub="Data sources and legal notices"
          onPress={() => router.push('/terms' as Href)}
        />
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 8, lineHeight: 16 }}>
          General information only — not financial advice. Confirm rates with the lender before applying.
        </AppText>
      </Section>

    </ScreenScrollView>
    <UndoSnackbar snack={snack} onUndo={undo} />
    </Screen>
  );
}
