import { useIsFocused, useScrollToTop } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { RbaChart } from '../../src/components/charts';
import { SegmentedControl } from '../../src/components/controls';
import { ScreenSkeleton } from '../../src/components/feedback';
import { RbaCountdownCard } from '../../src/components/RbaCountdownCard';
import { RbaOutlook, type RbaOutlookAuditHandle, type RbaOutlookAuditState } from '../../src/components/RbaOutlook';
import { Ribbon } from '../../src/components/Ribbon';
import { ScreenScrollView } from '../../src/components/Screen';
import { AppText, Button, Card, Disclosure, Divider, Row, SectionHeading } from '../../src/components/ui';
import { HistoryExplorer, type HistoryViewMode } from '../../src/components/viz/HistoryExplorer';
import { SECTIONS } from '../../src/constants';
import { filterBankInsightsForSuitability } from '../../src/data/bankInsights';
import { formatRankedFraction, formatRate, formatRunDate } from '../../src/data/format';
import { selectBankHistoryChartModel, shouldEnsurePrebuiltBankHistory } from '../../src/data/historySelectors';
import { orderedInterestSections, sectionSegmentOptions } from '../../src/data/interests';
import { decisionLine, formatRbaDate, rbaTrend, recentDecisions } from '../../src/data/rbaCalendar';
import { resolveSectionRibbonStats } from '../../src/data/ribbonStats';
import { bestRow, rankFraction } from '../../src/data/selectors';
import { useStore } from '../../src/data/store';
import { getSuitabilityAllowed } from '../../src/data/suitabilityGate';
import { usePerformanceAuditProbe, usePerformanceAuditSurface } from '../../src/hooks/usePerformanceAuditReadiness';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { rateValueLabel } from '../../src/lib/a11ySummaries';
import { runStoreRetry } from '../../src/lib/degradationLog';
import { openBrowse } from '../../src/lib/nav';
import { effectiveBankInsights, effectiveHistoryRibbon } from '../../src/lib/proAccess';
import { yieldToPaintFrames } from '../../src/lib/yieldToUi';
import { useTheme } from '../../src/theme/ThemeProvider';
import type { HistoryWindow } from '../../src/types';

export default function Market() {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const core = useStore((s) => s.core);
  const calendar = useStore((s) => s.rbaCalendar);
  const calendarError = useStore((s) => s.rbaCalendarError);
  const hasCalendarAsset = useStore((s) => !!s.manifest?.files.rba_calendar);
  const bankInsights = useStore((s) => s.bankInsights);
  const bankInsightsError = useStore((s) => s.bankInsightsError);
  const historyBanks = useStore((s) => s.historyBanks);
  const historyBanksError = useStore((s) => s.historyBanksError);
  const productHistory = useStore((s) => s.productHistory);
  const productHistoryError = useStore((s) => s.productHistoryError);
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const interests = useStore((s) => s.prefs.interests);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const showHistoryRibbon = useStore((s) => effectiveHistoryRibbon(s.prefs));
  const setPref = useStore((s) => s.setPref);
  const activeSection = useStore((s) => s.activeSection);
  const setActiveSection = useStore((s) => s.setActiveSection);
  const ensureHistoryBanks = useStore((s) => s.ensureHistoryBanks);
  const retryHistoryBanks = useStore((s) => s.retryHistoryBanks);
  const ensureBankInsights = useStore((s) => s.ensureBankInsights);
  const ensureRbaCalendar = useStore((s) => s.ensureRbaCalendar);
  const ensureProductHistory = useStore((s) => s.ensureProductHistory);
  const suitabilityRevision = useSuitabilityRevision();

  const [historyOpen, setHistoryOpen] = useState(true);
  const [advancedViews, setAdvancedViews] = useState(false);
  const [rbaOpen, setRbaOpen] = useState(false);
  const [economyOpen, setEconomyOpen] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [retryingHistory, setRetryingHistory] = useState(false);
  const [explorerMode, setExplorerMode] = useState<HistoryViewMode>('edge');
  const [explorerWindow, setExplorerWindow] = useState<HistoryWindow>('90D');
  const [rewindDate, setRewindDate] = useState<string | null>(null);
  const [rbaSelectedDate, setRbaSelectedDate] = useState<string | null>(null);
  const [dashboardLayoutRevision, setDashboardLayoutRevision] = useState<string | null>(null);
  const [historyLayoutRevision, setHistoryLayoutRevision] = useState<string | null>(null);
  const [rbaGraphicCount, setRbaGraphicCount] = useState(0);
  const [economicAuditState, setEconomicAuditState] = useState<RbaOutlookAuditState | null>(null);
  const rbaOutlookRef = useRef<RbaOutlookAuditHandle>(null);

  const interestSections = useMemo(() => orderedInterestSections(interests), [interests]);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const showBankInsights = effectiveBankInsights();
  const prebuiltHistoryEnabled = shouldEnsurePrebuiltBankHistory(showHistoryRibbon, includeNonStandard);

  useEffect(() => {
    if (!isFocused || !core) return;
    void ensureRbaCalendar();
    if (showBankInsights) void ensureBankInsights();
    if (prebuiltHistoryEnabled) void ensureHistoryBanks();
  }, [core, ensureBankInsights, ensureHistoryBanks, ensureRbaCalendar, isFocused, prebuiltHistoryEnabled, showBankInsights]);

  useEffect(() => {
    if (!isFocused || !core?.run_date) return;
    let active = true;
    setHistoryReady(false);
    void (async () => {
      await yieldToPaintFrames(2);
      if (active) setHistoryReady(true);
    })();
    return () => { active = false; };
  }, [core?.run_date, isFocused]);

  useEffect(() => {
    if (isFocused && historyOpen && explorerMode === 'pulse') void ensureProductHistory();
  }, [ensureProductHistory, explorerMode, historyOpen, isFocused]);

  useEffect(() => setRewindDate(null), [activeSection]);

  const explorerInsights = useMemo(() => {
    void suitabilityRevision;
    return filterBankInsightsForSuitability(bankInsights, core, includeNonStandard, detailsProducts);
  }, [bankInsights, core, detailsProducts, includeNonStandard, suitabilityRevision]);

  const historyModel = useMemo(() => {
    void suitabilityRevision;
    if (!core || !historyReady) return null;
    return selectBankHistoryChartModel(
      { core, historyBanks, bankInsights: explorerInsights, includeNonStandard, detailsProducts },
      activeSection,
      'All',
    );
  }, [activeSection, core, detailsProducts, explorerInsights, historyBanks, historyReady, includeNonStandard, suitabilityRevision]);

  const standardFilterWarming = useMemo(() => {
    void suitabilityRevision;
    return !includeNonStandard && getSuitabilityAllowed()?.size === 0;
  }, [includeNonStandard, suitabilityRevision]);

  const marketSnapshots = useMemo(() => {
    void suitabilityRevision;
    if (!core) return [];
    return interestSections.flatMap((key) => {
      const data = core.sections[key];
      if (!data) return [];
      const stats = resolveSectionRibbonStats(
        data,
        data.rates,
        includeNonStandard,
        key,
        detailsProducts,
        depositRankMetric,
        mortgageRateMetric,
      );
      if (stats.min === null) return [];
      const best = bestRow(data.rates, key, includeNonStandard, depositRankMetric, detailsProducts, mortgageRateMetric);
      const rankedBest = best ? rankFraction(best, key, depositRankMetric, mortgageRateMetric) : null;
      return [{ key, stats, bestLabel: rateValueLabel(key, 'best'), bestRate: formatRankedFraction(rankedBest) }];
    });
  }, [core, depositRankMetric, detailsProducts, includeNonStandard, interestSections, mortgageRateMetric, suitabilityRevision]);

  const activeSnapshot = marketSnapshots.find((snapshot) => snapshot.key === activeSection) ?? null;
  const trend = useMemo(() => rbaTrend(calendar), [calendar]);
  const decisions = useMemo(() => recentDecisions(calendar, 5), [calendar]);
  const currentRba = core?.rba.at(-1) ?? null;
  const datasetRevision = core?.run_date ?? null;
  const historyDates = useMemo(
    () => explorerMode === 'pulse' || explorerMode === 'race'
      ? explorerInsights?.run_dates ?? []
      : historyModel?.dates ?? [],
    [explorerInsights?.run_dates, explorerMode, historyModel?.dates],
  );
  const renderRevision = `${datasetRevision ?? 'none'}:${activeSection}:${explorerMode}:${explorerWindow}:${rewindDate ?? 'latest'}`;

  const nextSection = useCallback(() => {
    const index = Math.max(0, interestSections.indexOf(activeSection));
    const next = interestSections[(index + 1) % Math.max(1, interestSections.length)];
    if (next) setActiveSection(next);
  }, [activeSection, interestSections, setActiveSection]);
  const previousHistoryDate = useCallback(() => {
    if (!historyDates.length) return;
    const index = rewindDate ? historyDates.indexOf(rewindDate) : historyDates.length - 1;
    setRewindDate(historyDates[Math.max(0, index - 1)] ?? null);
  }, [historyDates, rewindDate]);
  const previousRbaDate = useCallback(() => {
    const dates = core?.rba.map((entry) => entry.date) ?? [];
    if (!dates.length) return;
    const index = rbaSelectedDate ? dates.indexOf(rbaSelectedDate) : dates.length - 1;
    setRbaSelectedDate(dates[Math.max(0, index - 1)] ?? null);
  }, [core?.rba, rbaSelectedDate]);

  const surface = usePerformanceAuditSurface({
    id: 'outlook.dashboard',
    routeKey: '/trends',
    datasetRevision,
    renderRevision,
    actions: {
      'outlook.open': () => undefined,
      'outlook.section.next': nextSection,
      'outlook.history.mode.spread': () => { setHistoryOpen(true); setAdvancedViews(true); setExplorerMode('edge'); },
      'outlook.history.mode.calendar': () => { setHistoryOpen(true); setAdvancedViews(true); setExplorerMode('calendar'); },
      'outlook.history.mode.pulse': () => { setHistoryOpen(true); setAdvancedViews(true); setExplorerMode('pulse'); },
      'outlook.history.mode.leaders': () => { setHistoryOpen(true); setAdvancedViews(true); setExplorerMode('race'); },
      'outlook.history.window.30d': () => setExplorerWindow('30D'),
      'outlook.history.window.all': () => setExplorerWindow('All'),
      'outlook.history.date.previous': previousHistoryDate,
      'outlook.rba-response.decision.previous': () => { setRbaOpen(true); previousRbaDate(); },
      'outlook.economy.lens.next': () => { setEconomyOpen(true); rbaOutlookRef.current?.nextLens(); },
      'outlook.economy.window.next': () => { setEconomyOpen(true); rbaOutlookRef.current?.nextWindow(); },
      'outlook.economy.date.previous': () => { setEconomyOpen(true); rbaOutlookRef.current?.previousDate(); },
      'outlook.snapshot.browse.first': () => {
        openBrowse(activeSection);
        return { expectedPath: '/browse' };
      },
    },
  });
  usePerformanceAuditProbe(surface, {
    id: 'core-data', kind: 'data', status: core ? 'ready' : 'pending', datasetRevision, renderRevision,
    expectedCount: core ? 1 : 0, actualCount: core ? 1 : 0,
  });
  usePerformanceAuditProbe(surface, {
    id: 'market-snapshot-list', kind: 'list', status: activeSnapshot ? 'ready' : 'pending', datasetRevision, renderRevision,
    expectedCount: 1, actualCount: activeSnapshot ? 1 : 0,
  });
  usePerformanceAuditProbe(surface, {
    id: 'rba-calendar', kind: 'data', status: !hasCalendarAsset || calendar ? 'ready' : calendarError ? 'error' : 'pending',
    error: calendarError, datasetRevision, renderRevision,
  });
  usePerformanceAuditProbe(surface, {
    id: 'bank-insights', kind: 'data', required: showBankInsights,
    status: explorerInsights ? 'ready' : bankInsightsError ? 'error' : 'pending', error: bankInsightsError,
    datasetRevision, renderRevision,
  });
  usePerformanceAuditProbe(surface, {
    id: 'bank-history', kind: 'data', required: prebuiltHistoryEnabled,
    status: !prebuiltHistoryEnabled || historyModel ? 'ready' : historyBanksError ? 'error' : 'pending',
    error: historyBanksError, datasetRevision, renderRevision,
  });
  usePerformanceAuditProbe(surface, {
    id: 'product-history', kind: 'data', required: explorerMode === 'pulse',
    status: explorerMode !== 'pulse' || productHistory ? 'ready' : productHistoryError ? 'error' : 'pending',
    error: productHistoryError, datasetRevision, renderRevision,
  });
  usePerformanceAuditProbe(surface, {
    id: 'dashboard-layout', kind: 'layout',
    status: datasetRevision && dashboardLayoutRevision === datasetRevision ? 'ready' : 'pending', datasetRevision, renderRevision,
  });
  usePerformanceAuditProbe(surface, {
    id: 'history-graphic', kind: 'graphic', required: historyOpen,
    status: !historyOpen || historyLayoutRevision === renderRevision ? 'ready' : 'pending', datasetRevision, renderRevision,
  });
  usePerformanceAuditProbe(surface, {
    id: 'economic-graphics', kind: 'graphic', required: economyOpen,
    status: !economyOpen ? 'ready' : economicAuditState?.status ?? 'pending', error: economicAuditState?.error,
    datasetRevision, renderRevision,
  });

  const rbaSurface = usePerformanceAuditSurface({
    id: 'outlook.rba-response', routeKey: '/trends', datasetRevision,
    renderRevision: `${datasetRevision ?? 'none'}:${rbaSelectedDate ?? 'latest'}`,
    actions: {
      'redirect.rba.verify': () => undefined,
      'outlook.rba-response.decision.previous': previousRbaDate,
    },
  });
  usePerformanceAuditProbe(rbaSurface, {
    id: 'rba-data', kind: 'data', status: core?.rba.length ? 'ready' : 'pending',
    datasetRevision, expectedCount: core?.rba.length ?? 1, actualCount: core?.rba.length ?? 0,
  });
  usePerformanceAuditProbe(rbaSurface, {
    id: 'rba-graphic', kind: 'graphic', required: rbaOpen,
    status: !rbaOpen || rbaGraphicCount > 0 ? 'ready' : 'pending', datasetRevision,
    expectedCount: rbaOpen ? core?.rba.length ?? 1 : 0, actualCount: rbaGraphicCount,
  });

  const handleRetryHistory = async () => {
    setRetryingHistory(true);
    try {
      await runStoreRetry(
        'retryHistoryBanks',
        () => retryHistoryBanks(),
        () => !!useStore.getState().historyBanks,
        () => useStore.getState().historyBanksError,
      );
    } finally {
      setRetryingHistory(false);
    }
  };

  if (!core) return <ScreenSkeleton />;

  return (
    <ScreenScrollView
      ref={scrollRef}
      onLayout={(event) => {
        if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) {
          setDashboardLayoutRevision(core.run_date);
        }
      }}
    >
      {sectionOptions.length > 1 ? (
        <SegmentedControl options={sectionOptions} value={activeSection} onChange={setActiveSection} />
      ) : null}

      <Card variant="outlined" style={{ gap: 14 }}>
        <SectionHeading
          title="Market now"
          subtitle={`Observed ${formatRunDate(core.run_date)} · ${SECTIONS[activeSection].title}`}
        />
        {activeSnapshot ? (
          <>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <AppText variant="small" color="textMuted">{activeSnapshot.bestLabel}</AppText>
                <AppText
                  variant="rateHero"
                  style={{ color: SECTIONS[activeSection].lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit }}
                >
                  {activeSnapshot.bestRate}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText variant="small" color="textMuted">Typical advertised</AppText>
                <AppText variant="h3">{formatRate(activeSnapshot.stats.median)}</AppText>
              </View>
            </Row>
            <Ribbon stats={activeSnapshot.stats} section={activeSection} />
            <Button title="Browse these products" variant="ghost" onPress={() => openBrowse(activeSection)} />
          </>
        ) : (
          <AppText variant="small" color="textMuted">Preparing the current standard-product market…</AppText>
        )}
      </Card>

      <RbaCountdownCard expandable={false} />

      <Disclosure
        title="Rate trend"
        summary="Best advertised rate versus the typical tracked rate"
        open={historyOpen}
        onToggle={() => setHistoryOpen((open) => !open)}
      >
        {!showHistoryRibbon ? (
          <Button title="Show market history" variant="secondary" onPress={() => setPref('showHistoryRibbon', true)} />
        ) : historyReady ? (
          <View
            style={{ gap: 10 }}
            onLayout={(event) => {
              if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) {
                setHistoryLayoutRevision(renderRevision);
              }
            }}
          >
            <HistoryExplorer
              section={activeSection}
              historyModel={historyModel}
              insights={explorerInsights}
              insightsAvailable={showBankInsights}
              standardOnly={!includeNonStandard}
              standardFilterWarming={standardFilterWarming}
              rba={core.rba}
              rbaHolds={core.rba_holds}
              brands={core.brands}
              selectedDate={rewindDate}
              onDateSelect={setRewindDate}
              mode={explorerMode}
              onModeChange={setExplorerMode}
              window={explorerWindow}
              onWindowChange={setExplorerWindow}
              auditRevision={renderRevision}
              showModePicker={advancedViews}
            />
            <Button
              title={advancedViews ? 'Show only the rate trend' : 'Explore calendar, activity and leaders'}
              variant="ghost"
              onPress={() => {
                setAdvancedViews((open) => !open);
                if (advancedViews) setExplorerMode('edge');
              }}
            />
            {prebuiltHistoryEnabled && historyBanksError ? (
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText variant="small" color="textMuted" style={{ flex: 1 }}>
                  Showing available history · latest history check failed.
                </AppText>
                <Button title="Retry" variant="ghost" loading={retryingHistory} onPress={handleRetryHistory} />
              </Row>
            ) : null}
          </View>
        ) : (
          <AppText variant="small" color="textMuted">Preparing the trend after the first screen has settled…</AppText>
        )}
      </Disclosure>

      <Disclosure
        title="RBA cash rate"
        summary={currentRba ? `${formatRate(currentRba.rate)}${trend.summary ? ` · ${trend.summary}` : ''}` : 'Cash-rate history and decisions'}
        open={rbaOpen}
        onToggle={() => setRbaOpen((open) => !open)}
      >
        <View style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="small" color="textMuted">Current cash rate</AppText>
            <AppText variant="rateHero" style={{ color: theme.colors.rba }}>{currentRba ? formatRate(currentRba.rate) : '—'}</AppText>
          </Row>
          <RbaChart
            data={core.rba}
            holds={core.rba_holds}
            height={190}
            selectedDate={rbaSelectedDate}
            onDateSelect={setRbaSelectedDate}
            onGraphicReady={(state) => setRbaGraphicCount(state.pointCount)}
          />
          {decisions.length ? <Divider /> : null}
          {decisions.map((decision) => (
            <Row key={decision.date} style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
              <AppText variant="small" color="textMuted">{formatRbaDate(decision.date)}</AppText>
              <AppText variant="small" weight="700">{decisionLine(decision)}</AppText>
            </Row>
          ))}
        </View>
      </Disclosure>

      <Disclosure
        title="What is shaping rates"
        summary="Inflation, labour, housing and market expectations"
        open={economyOpen}
        onToggle={() => setEconomyOpen((open) => !open)}
      >
        <RbaOutlook
          ref={rbaOutlookRef}
          rba={core.rba}
          rbaHolds={core.rba_holds}
          onAuditStateChange={setEconomicAuditState}
        />
      </Disclosure>

      <Card variant="outlined" style={{ gap: 10 }}>
        <SectionHeading
          title="Looking for recent changes?"
          subtitle="Rate Moves has the chronological lender feed and RBA response analysis."
        />
        <Button title="Open Rate Moves" variant="secondary" onPress={() => router.navigate('/(tabs)/passthrough')} />
      </Card>

      {bankInsightsError && explorerInsights ? (
        <AppText variant="small" color="textMuted" style={{ textAlign: 'center' }}>
          Market depth is cached · the latest intelligence check was unavailable.
        </AppText>
      ) : null}
      <AppText variant="small" color="textMuted" style={{ textAlign: 'center' }}>
        Advertised CDR rates · general information only, not financial advice.
      </AppText>
    </ScreenScrollView>
  );
}
