import { useIsFocused, useScrollToTop } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { RbaChart } from '../src/components/charts';
import { SegmentedControl } from '../src/components/controls';
import { ScreenSkeleton } from '../src/components/feedback';
import { RbaCountdownCard } from '../src/components/RbaCountdownCard';
import { RbaOutlook, type RbaOutlookAuditHandle, type RbaOutlookAuditState } from '../src/components/RbaOutlook';
import { Ribbon } from '../src/components/Ribbon';
import { ScreenScrollView } from '../src/components/Screen';
import { AppText, Button, Card, Disclosure, Divider, Row, SectionHeading } from '../src/components/ui';
import { HistoryExplorer, type HistoryViewMode } from '../src/components/viz/HistoryExplorer';
import { SECTION_ORDER, SECTIONS } from '../src/constants';
import { filterBankInsightsForSuitability } from '../src/data/bankInsights';
import { formatRate, formatRunDate } from '../src/data/format';
import { rbaSeriesThroughDate, rbaTimelineDates } from '../src/data/bankHistoryTransform';
import { selectBankHistoryChartModel, shouldEnsurePrebuiltBankHistory } from '../src/data/historySelectors';
import { orderedInterestSections, resolveInterestSection, sectionSegmentOptions } from '../src/data/interests';
import { decisionLine, formatRbaDate, rbaTrend, recentDecisions } from '../src/data/rbaCalendar';
import { resolveSectionRibbonStats } from '../src/data/ribbonStats';
import { useStore } from '../src/data/store';
import { getSuitabilityAllowed } from '../src/data/suitabilityGate';
import { usePerformanceAuditProbe, usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { runStoreRetry } from '../src/lib/degradationLog';
import { openBrowse, scalarRouteParam } from '../src/lib/nav';
import { auditActionString } from '../src/lib/performanceAuditActionParams';
import { effectiveBankInsights, effectiveHistoryRibbon } from '../src/lib/proAccess';
import { yieldToPaintFrames } from '../src/lib/yieldToUi';
import { useTheme } from '../src/theme/ThemeProvider';
import type { HistoryWindow } from '../src/types';

export default function Market() {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);
  const { focus: focusRaw } = useLocalSearchParams<{ focus?: string | string[] }>();
  const focus = scalarRouteParam(focusRaw);
  useScrollToTop(scrollRef);

  const core = useStore((s) => s.core);
  const coreIntegrity = useStore((s) => s.coreIntegrity);
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
  const defaultSection = useStore((s) => s.prefs.defaultSection);
  const ensureHistoryBanks = useStore((s) => s.ensureHistoryBanks);
  const retryHistoryBanks = useStore((s) => s.retryHistoryBanks);
  const ensureBankInsights = useStore((s) => s.ensureBankInsights);
  const ensureRbaCalendar = useStore((s) => s.ensureRbaCalendar);
  const ensureProductHistory = useStore((s) => s.ensureProductHistory);
  const suitabilityRevision = useSuitabilityRevision();

  const [activeSection, setActiveSection] = useState(() => resolveInterestSection(interests, defaultSection));
  const [historyOpen, setHistoryOpen] = useState(true);
  const [advancedViews, setAdvancedViews] = useState(false);
  const [rbaOpen, setRbaOpen] = useState(focus === 'rba');
  const [economyOpen, setEconomyOpen] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [retryingHistory, setRetryingHistory] = useState(false);
  const [explorerMode, setExplorerMode] = useState<HistoryViewMode>('edge');
  const [explorerWindow, setExplorerWindow] = useState<HistoryWindow>('90D');
  const [rewindDate, setRewindDate] = useState<string | null>(null);
  const [rbaSelectedDate, setRbaSelectedDate] = useState<string | null>(null);
  const [dashboardLayoutRevision, setDashboardLayoutRevision] = useState<string | null>(null);
  const [historyGraphicState, setHistoryGraphicState] = useState<{
    revision: string;
    accessibleSummary: boolean;
  } | null>(null);
  const [rbaGraphicState, setRbaGraphicState] = useState<{
    revision: string;
    pointCount: number;
    accessibleSummary: boolean;
  } | null>(null);
  const [leaderLogoState, setLeaderLogoState] = useState<{
    revision: string;
    expectedCount: number;
    terminalCount: number;
  } | null>(null);
  const [economicAuditState, setEconomicAuditState] = useState<RbaOutlookAuditState | null>(null);
  const [pendingEconomyAuditAction, setPendingEconomyAuditAction] = useState<'lens' | 'window' | 'date' | null>(null);
  const [rbaLayoutY, setRbaLayoutY] = useState<number | null>(null);
  const [rbaLayoutReady, setRbaLayoutReady] = useState(false);
  const rbaOutlookRef = useRef<RbaOutlookAuditHandle>(null);
  const legacyRbaHandled = useRef(false);

  const interestSections = useMemo(() => orderedInterestSections(interests), [interests]);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const showBankInsights = effectiveBankInsights();
  const prebuiltHistoryEnabled = shouldEnsurePrebuiltBankHistory(showHistoryRibbon, includeNonStandard);

  useEffect(() => {
    setActiveSection((current) => resolveInterestSection(interests, current));
  }, [interests]);

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

  useEffect(() => {
    if (!isFocused || focus !== 'rba') {
      legacyRbaHandled.current = false;
      return;
    }
    setRbaGraphicState(null);
    setRbaOpen(true);
  }, [focus, core?.run_date, isFocused]);

  useEffect(() => {
    if (!isFocused || focus !== 'rba' || !rbaOpen || rbaLayoutY == null || legacyRbaHandled.current) return;
    legacyRbaHandled.current = true;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, rbaLayoutY - 12), animated: false }));
  }, [focus, isFocused, rbaLayoutY, rbaOpen]);

  useEffect(() => {
    if (!economyOpen || !pendingEconomyAuditAction) return;
    const audit = rbaOutlookRef.current;
    if (!audit) return;
    if (pendingEconomyAuditAction === 'lens') audit.nextLens();
    else if (pendingEconomyAuditAction === 'window') audit.nextWindow();
    else audit.previousDate();
    setPendingEconomyAuditAction(null);
  }, [economyOpen, pendingEconomyAuditAction]);

  const explorerInsights = useMemo(() => {
    void suitabilityRevision;
    return filterBankInsightsForSuitability(bankInsights, core, includeNonStandard, detailsProducts, suitabilityRevision, coreIntegrity);
  }, [bankInsights, core, coreIntegrity, detailsProducts, includeNonStandard, suitabilityRevision]);

  const historyModel = useMemo(() => {
    void suitabilityRevision;
    if (!core || !historyReady) return null;
    return selectBankHistoryChartModel(
      { core, coreIntegrity, historyBanks, bankInsights: explorerInsights, includeNonStandard, detailsProducts },
      activeSection,
      'All',
    );
  }, [activeSection, core, coreIntegrity, detailsProducts, explorerInsights, historyBanks, historyReady, includeNonStandard, suitabilityRevision]);

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
      return [{ key, stats }];
    });
  }, [core, depositRankMetric, detailsProducts, includeNonStandard, interestSections, mortgageRateMetric, suitabilityRevision]);

  const activeSnapshot = marketSnapshots.find((snapshot) => snapshot.key === activeSection) ?? null;
  const trend = useMemo(() => rbaTrend(calendar), [calendar]);
  const decisions = useMemo(() => recentDecisions(calendar, 5), [calendar]);
  const currentRba = core?.rba.at(-1) ?? null;
  const datasetRevision = core?.run_date ?? null;
  const rbaGraphicRevisionPrefix = `${core?.rba.at(-1)?.date ?? 'none'}:${core?.rba_holds?.length ?? 0}:`;
  const rbaGraphicReady = !!rbaGraphicState &&
    rbaGraphicState.pointCount > 0 &&
    rbaGraphicState.revision.startsWith(rbaGraphicRevisionPrefix);
  const rbaChartPointCount = useMemo(() => {
    if (!core?.rba.length) return 0;
    const timeline = rbaTimelineDates(core.rba, core.rba_holds);
    const endDate = timeline.at(-1) ?? core.rba.at(-1)?.date ?? '';
    return rbaSeriesThroughDate(core.rba, endDate).length;
  }, [core?.rba, core?.rba_holds]);
  const openRba = useCallback(() => {
    setRbaGraphicState(null);
    setRbaOpen(true);
  }, []);
  const queueEconomyAuditAction = useCallback((action: 'lens' | 'window' | 'date') => {
    setEconomyOpen(true);
    setPendingEconomyAuditAction(action);
  }, []);
  useEffect(() => setRbaGraphicState(null), [datasetRevision]);
  const historyDates = useMemo(
    () => explorerMode === 'pulse' || explorerMode === 'race'
      ? explorerInsights?.run_dates ?? []
      : historyModel?.dates ?? [],
    [explorerInsights?.run_dates, explorerMode, historyModel?.dates],
  );
  const renderRevision = `${datasetRevision ?? 'none'}:${activeSection}:${explorerMode}:${explorerWindow}:${rewindDate ?? 'latest'}`;
  const historyChartAvailable = !standardFilterWarming && (
    explorerMode === 'race' || explorerMode === 'pulse'
      ? showBankInsights && Boolean(explorerInsights)
      : Boolean(historyModel)
  );

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
    routeKey: '/research',
    datasetRevision,
    renderRevision,
    actions: {
      'outlook.open': () => setHistoryOpen(true),
      'outlook.section.next': nextSection,
      'outlook.history.mode.spread': () => { setHistoryOpen(true); setAdvancedViews(true); setExplorerMode('edge'); },
      'outlook.history.mode.calendar': () => { setHistoryOpen(true); setAdvancedViews(true); setExplorerMode('calendar'); },
      'outlook.history.mode.pulse': () => { setHistoryOpen(true); setAdvancedViews(true); setExplorerMode('pulse'); },
      'outlook.history.mode.leaders': () => { setHistoryOpen(true); setAdvancedViews(true); setExplorerMode('race'); },
      'outlook.history.window.30d': () => setExplorerWindow('30D'),
      'outlook.history.window.all': () => setExplorerWindow('All'),
      'outlook.history.date.previous': previousHistoryDate,
      'outlook.rba-response.decision.previous': () => { openRba(); previousRbaDate(); },
      'outlook.economy.lens.next': () => queueEconomyAuditAction('lens'),
      'outlook.economy.window.next': () => queueEconomyAuditAction('window'),
      'outlook.economy.date.previous': () => queueEconomyAuditAction('date'),
      'outlook.snapshot.browse.first': (...args: unknown[]) => {
        const planned = auditActionString(args, 'section');
        const target = planned && SECTION_ORDER.includes(planned as typeof activeSection)
          ? planned as typeof activeSection
          : activeSection;
        openBrowse(target);
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
    status: !prebuiltHistoryEnabled || historyBanks ? 'ready' : historyBanksError ? 'error' : 'pending',
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
    layoutMeasured: dashboardLayoutRevision === datasetRevision,
  });
  usePerformanceAuditProbe(surface, {
    id: 'history-graphic', kind: 'graphic', required: historyOpen,
    status: !historyOpen || (
      historyChartAvailable && historyGraphicState?.revision === renderRevision
    ) ? 'ready' : 'pending', datasetRevision, renderRevision,
    accessibleSummary: historyOpen && historyChartAvailable &&
      historyGraphicState?.revision === renderRevision && historyGraphicState.accessibleSummary,
  });
  usePerformanceAuditProbe(surface, {
    id: 'economic-graphics', kind: 'graphic', required: economyOpen,
    status: !economyOpen ? 'ready' : economicAuditState?.status ?? 'pending', error: economicAuditState?.error,
    accessibleSummary: economyOpen ? economicAuditState?.accessibleSummary ?? false : false,
    datasetRevision, renderRevision,
  });
  usePerformanceAuditProbe(surface, {
    id: 'leader-logos', kind: 'logo', required: explorerMode === 'race',
    status: explorerMode !== 'race' || (
      leaderLogoState?.revision === renderRevision &&
      leaderLogoState.terminalCount === leaderLogoState.expectedCount
    ) ? 'ready' : 'pending',
    expectedCount: explorerMode === 'race' ? leaderLogoState?.expectedCount ?? 0 : 0,
    actualCount: explorerMode === 'race' ? leaderLogoState?.terminalCount ?? 0 : 0,
    datasetRevision, renderRevision,
  });

  const rbaSurface = usePerformanceAuditSurface({
    id: 'outlook.rba-response', routeKey: '/research', datasetRevision,
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
    status: !rbaOpen || rbaGraphicReady ? 'ready' : 'pending', datasetRevision,
    expectedCount: rbaOpen ? rbaChartPointCount : 0,
    actualCount: rbaOpen ? rbaGraphicState?.pointCount ?? 0 : 0,
    accessibleSummary: rbaOpen ? rbaGraphicState?.accessibleSummary ?? false : false,
  });
  usePerformanceAuditProbe(rbaSurface, {
    id: 'rba-layout', kind: 'layout',
    status: rbaLayoutReady ? 'ready' : 'pending',
    layoutMeasured: rbaLayoutReady,
    datasetRevision,
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

      <RbaCountdownCard expandable={false} />

      <Card variant="outlined" style={{ gap: 14 }}>
        <SectionHeading
          title="Market research"
          subtitle={`Observed ${formatRunDate(core.run_date)} · ${SECTIONS[activeSection].title}`}
        />
        {activeSnapshot ? (
          <>
            <Ribbon stats={activeSnapshot.stats} section={activeSection} />
            <Button title="Browse these products" variant="ghost" onPress={() => openBrowse(activeSection)} />
          </>
        ) : (
          <AppText variant="small" color="textMuted">Preparing the current standard-product market…</AppText>
        )}
      </Card>

      <Disclosure
        title={`How have ${SECTIONS[activeSection].title.toLowerCase()} rates moved?`}
        summary="Leading advertised rate versus the median"
        open={historyOpen}
        onToggle={() => setHistoryOpen((open) => !open)}
      >
        {!showHistoryRibbon ? (
          <Button title="Show market history" variant="secondary" onPress={() => setPref('showHistoryRibbon', true)} />
        ) : historyReady ? (
          <View style={{ gap: 10 }}>
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
              onGraphicReadiness={setHistoryGraphicState}
              onLeaderLogoReadiness={setLeaderLogoState}
              showModePicker={advancedViews}
            />
            <Button
              title={advancedViews ? 'Show the simple trend' : 'Research views'}
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

      <View
        onLayout={(event) => {
          const { width, height, y } = event.nativeEvent.layout;
          setRbaLayoutY(y);
          if (width > 0 && height > 0) setRbaLayoutReady(true);
        }}
      >
        <Disclosure
          title="RBA cash rate"
          summary={currentRba ? `${formatRate(currentRba.rate)}${trend.summary ? ` · ${trend.summary}` : ''}` : 'Cash-rate history and decisions'}
          open={rbaOpen}
          onToggle={() => {
            setRbaGraphicState(null);
            setRbaOpen((open) => !open);
          }}
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
            onGraphicReady={setRbaGraphicState}
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
      </View>

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

      {bankInsightsError && explorerInsights ? (
        <AppText variant="small" color="textMuted" style={{ textAlign: 'center' }}>
          Showing saved market history · the latest update was unavailable.
        </AppText>
      ) : null}
    </ScreenScrollView>
  );
}
