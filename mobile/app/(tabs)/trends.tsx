import Ionicons from '@expo/vector-icons/Ionicons';
import { useScrollToTop } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  BankMovesFeed,
  InsightsLockedCard,
  MarketPulseStrip,
  MoversLeaderboard,
} from '../../src/components/BankInsights';
import { HistoryExplorer } from '../../src/components/viz/HistoryExplorer';
import type { HistoryViewMode } from '../../src/components/viz/HistoryExplorer';
import { PulseDayMovers } from '../../src/components/PulseDayMovers';
import { MarketSnapshotList } from '../../src/components/MarketSnapshot';
import { ProPaywall } from '../../src/components/ProPaywall';
import { RbaCountdownCard } from '../../src/components/RbaCountdownCard';
import { RbaOutlook } from '../../src/components/RbaOutlook';
import { RbaChart } from '../../src/components/charts';
import { Ribbon } from '../../src/components/Ribbon';
import { ScreenScrollView } from '../../src/components/Screen';
import { SegmentedControl } from '../../src/components/controls';
import { AppText, Button, Card, Chip, Divider, Row } from '../../src/components/ui';
import { SECTIONS } from '../../src/constants';
import { formatRankedFraction, formatRate, formatRunDate } from '../../src/data/format';
import { filterBankInsightsForSuitability } from '../../src/data/bankInsights';
import { selectBankHistoryChartModel } from '../../src/data/historySelectors';
import { orderedInterestSections, sectionSegmentOptions } from '../../src/data/interests';
import { resolveSectionRibbonStats } from '../../src/data/ribbonStats';
import { getSuitabilityAllowed } from '../../src/data/suitabilityGate';
import { rbaRateAsOf } from '../../src/data/bankHistoryTransform';
import { decisionLine, formatRbaDate, rbaTrend, recentDecisions } from '../../src/data/rbaCalendar';
import { bestRow, rankFraction } from '../../src/data/selectors';
import { useStore } from '../../src/data/store';
import { useProPaywall } from '../../src/hooks/useProPaywall';
import { rateValueLabel, rbaDecisionA11yLabel } from '../../src/lib/a11ySummaries';
import { runStoreRetry } from '../../src/lib/degradationLog';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { openBrowse } from '../../src/lib/nav';
import { effectiveBankInsights, effectiveHistoryRibbon } from '../../src/lib/proAccess';
import { yieldToUiFrames } from '../../src/lib/yieldToUi';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function Trends() {
  const theme = useTheme();
  const core = useStore((s) => s.core);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? '');
  const calendar = useStore((s) => s.rbaCalendar);
  const interests = useStore((s) => s.prefs.interests);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const showHistoryRibbon = useStore((s) => effectiveHistoryRibbon(s.prefs));
  const showBankInsights = useStore((s) => effectiveBankInsights(s.prefs));
  const historyBanks = useStore((s) => s.historyBanks);
  const historyBanksError = useStore((s) => s.historyBanksError);
  const ensureHistoryBanks = useStore((s) => s.ensureHistoryBanks);
  const retryHistoryBanks = useStore((s) => s.retryHistoryBanks);
  const bankInsights = useStore((s) => s.bankInsights);
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const bankInsightsError = useStore((s) => s.bankInsightsError);
  const ensureBankInsights = useStore((s) => s.ensureBankInsights);
  const retryBankInsights = useStore((s) => s.retryBankInsights);
  const ensureRbaCalendar = useStore((s) => s.ensureRbaCalendar);
  const setPref = useStore((s) => s.setPref);
  const activeSection = useStore((s) => s.activeSection);
  const setActiveSection = useStore((s) => s.setActiveSection);
  const suitabilityRevision = useSuitabilityRevision();
  const { paywallVisible, paywallIntent, requestPro, closePaywall } = useProPaywall();
  const historyRequestKey = useRef<string | null>(null);
  const insightsRequestKey = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const [retryingInsights, setRetryingInsights] = useState(false);
  const [retryingHistory, setRetryingHistory] = useState(false);
  const [deferredChartRevision, setDeferredChartRevision] = useState<string | null>(null);
  const deferredChartsReady = !!core?.run_date && deferredChartRevision === core.run_date;
  // Scrubbed/pinned history date — rewinds the lender list below the chart.
  const [rewindDate, setRewindDate] = useState<string | null>(null);
  const [explorerMode, setExplorerMode] = useState<HistoryViewMode>('edge');
  const ensureProductHistory = useStore((s) => s.ensureProductHistory);
  const productHistory = useStore((s) => s.productHistory);
  const productHistoryError = useStore((s) => s.productHistoryError);

  useEffect(() => {
    setRewindDate(null);
  }, [activeSection]);

  useEffect(() => {
    if (showHistoryRibbon && explorerMode === 'pulse') void ensureProductHistory();
  }, [core?.run_date, coreSha, ensureProductHistory, explorerMode, showHistoryRibbon]);

  useEffect(() => {
    const revision = core?.run_date;
    if (!revision) return;
    let active = true;
    // Let the tab transition and its first touch/paint complete before
    // constructing the large SVG and historical derived models below.
    void yieldToUiFrames(2).then(() => {
      if (active) setDeferredChartRevision(revision);
    });
    return () => {
      active = false;
    };
  }, [core?.run_date]);

  const handleRetryInsights = async () => {
    setRetryingInsights(true);
    try {
      await runStoreRetry(
        'retryBankInsights',
        () => retryBankInsights(),
        () => !!useStore.getState().bankInsights,
        () => useStore.getState().bankInsightsError,
      );
    } finally {
      setRetryingInsights(false);
    }
  };

  const handleRetryHistory = async () => {
    setRetryingHistory(true);
    try {
      await runStoreRetry(
        'retryHistoryBanks',
        () => retryHistoryBanks(),
        () => !!useStore.getState().historyBanks && !useStore.getState().historyBanksError,
        () => useStore.getState().historyBanksError,
      );
    } finally {
      setRetryingHistory(false);
    }
  };

  const interestSections = useMemo(() => orderedInterestSections(interests), [interests]);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const explorerInsights = useMemo(() => {
    void suitabilityRevision;
    if (!deferredChartsReady) return null;
    return filterBankInsightsForSuitability(
      bankInsights,
      core,
      includeNonStandard,
      detailsProducts,
    );
  }, [bankInsights, core, deferredChartsReady, detailsProducts, includeNonStandard, suitabilityRevision]);
  const historyModel = useMemo(() => {
    void suitabilityRevision;
    return core && deferredChartsReady
      ? selectBankHistoryChartModel(
          {
            core,
            historyBanks,
            bankInsights: explorerInsights,
            includeNonStandard,
            detailsProducts,
          },
          activeSection,
          'All',
        )
      : null;
  }, [
    activeSection,
    core,
    deferredChartsReady,
    detailsProducts,
    explorerInsights,
    historyBanks,
    includeNonStandard,
    suitabilityRevision,
  ]);
  const standardFilterWarming = useMemo(() => {
    void suitabilityRevision;
    return !includeNonStandard && getSuitabilityAllowed()?.size === 0;
  }, [includeNonStandard, suitabilityRevision]);

  useEffect(() => {
    if (!showHistoryRibbon) {
      historyRequestKey.current = null;
      return;
    }
    const key = core?.run_date ?? null;
    if (!key || historyRequestKey.current === key) return;
    historyRequestKey.current = key;
    void ensureHistoryBanks();
  }, [core?.run_date, ensureHistoryBanks, showHistoryRibbon]);

  useEffect(() => {
    if (!showBankInsights) {
      insightsRequestKey.current = null;
      return;
    }
    const key = core?.run_date ?? null;
    if (!key || insightsRequestKey.current === key) return;
    insightsRequestKey.current = key;
    void ensureBankInsights();
  }, [core?.run_date, ensureBankInsights, showBankInsights]);

  useEffect(() => {
    void ensureRbaCalendar();
  }, [core?.run_date, ensureRbaCalendar]);

  const payloadDecisions = useMemo(() => {
    if (!core?.rba) return [];
    const out: { date: string; rate: number; prior: number; held?: boolean }[] = [];
    for (let i = 1; i < core.rba.length; i++) {
      if (core.rba[i].rate !== core.rba[i - 1].rate) {
        out.push({ date: core.rba[i].date, rate: core.rba[i].rate, prior: core.rba[i - 1].rate });
      }
    }
    for (const raw of core.rba_holds ?? []) {
      const date = String(raw || '').slice(0, 10);
      if (!date || out.some((decision) => decision.date === date)) continue;
      const rate = rbaRateAsOf(core.rba, date);
      if (rate != null) out.push({ date, rate, prior: rate, held: true });
    }
    out.sort((left, right) => right.date.localeCompare(left.date));
    return out.slice(0, 12);
  }, [core]);

  const trend = useMemo(() => rbaTrend(calendar), [calendar]);
  const calendarDecisions = useMemo(() => recentDecisions(calendar, 12), [calendar]);
  const useCalendarDecisions = calendarDecisions.length > 0;

  if (!core) return null;
  const currentRba = core.rba.at(-1);

  return (
    <ScreenScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {showBankInsights ? (
        <>
          {bankInsights ? (
            <View style={{ marginBottom: 12 }}>
              <MarketPulseStrip payload={bankInsights} />
            </View>
          ) : null}
          <Card style={{ marginBottom: 16 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <AppText variant="h3">Bank moves</AppText>
              <Chip label="PRO" selected />
            </Row>
            <AppText variant="tiny" color="textFaint" style={{ marginBottom: 4 }}>
              Detected from tracked lenders&apos; advertised {SECTIONS[activeSection].title.toLowerCase()}{' '}
              rates for each available observation. Tap a row for the products involved and each rate change.
            </AppText>
            {sectionOptions.length > 1 ? (
              <View style={{ marginBottom: 8 }}>
                <SegmentedControl options={sectionOptions} value={activeSection} onChange={setActiveSection} />
              </View>
            ) : null}
            <BankMovesFeed
              payload={bankInsights}
              error={bankInsightsError}
              sections={[activeSection]}
              limit={8}
            />
            {bankInsightsError && !bankInsights ? (
              <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <AppText variant="tiny" color="danger" style={{ flex: 1 }}>
                  {bankInsightsError}
                </AppText>
                <Button
                  title="Retry"
                  variant="ghost"
                  onPress={handleRetryInsights}
                  loading={retryingInsights}
                  disabled={retryingInsights}
                />
              </Row>
            ) : null}
          </Card>
          {bankInsights ? (
            <Card style={{ marginBottom: 16 }}>
              <AppText variant="h3" style={{ marginBottom: 10 }}>
                Movers
              </AppText>
              <MoversLeaderboard payload={bankInsights} section={activeSection} />
            </Card>
          ) : null}
        </>
      ) : (
        <Card style={{ marginBottom: 16 }}>
          <InsightsLockedCard onUnlock={() => requestPro('bank_insights')} />
        </Card>
      )}

      {deferredChartsReady ? (
        <RbaOutlook rba={core.rba} rbaHolds={core.rba_holds} />
      ) : (
        <DeferredChartPlaceholder label="Preparing economic outlook" />
      )}

      <Card style={{ marginBottom: 16 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <AppText variant="h3">RBA cash rate</AppText>
          <AppText variant="rateHero" style={{ color: theme.colors.rba }}>
            {currentRba ? formatRate(currentRba.rate) : '—'}
          </AppText>
        </Row>
        {trend.summary ? (
          <AppText variant="small" color="textMuted" style={{ marginBottom: 8 }}>
            {trend.summary}
          </AppText>
        ) : null}
        {deferredChartsReady ? (
          <RbaChart data={core.rba} holds={core.rba_holds} height={190} />
        ) : (
          <DeferredChartPlaceholder label="Preparing cash-rate chart" height={190} />
        )}
        <View style={{ marginTop: 12 }}>
          <RbaCountdownCard expandable={false} />
        </View>
        {(useCalendarDecisions || payloadDecisions.length > 0) ? (
          <>
            <Divider style={{ marginVertical: 12 }} />
            <AppText variant="small" weight="700" style={{ marginBottom: 8 }}>
              Recent decisions
            </AppText>
            {useCalendarDecisions
              ? calendarDecisions.map((decision, index) => (
                  <View key={decision.date}>
                    {index > 0 ? <Divider style={{ marginVertical: 8 }} /> : null}
                    <Row
                      style={{ justifyContent: 'space-between', paddingVertical: 4 }}
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={`${formatRbaDate(decision.date)}, ${decisionLine(decision)}`}
                    >
                      <AppText variant="small" color="textMuted">
                        {formatRbaDate(decision.date)}
                      </AppText>
                      <AppText variant="small" weight="600">
                        {decisionLine(decision)}
                      </AppText>
                    </Row>
                  </View>
                ))
              : payloadDecisions.map((d) => {
                  const up = !d.held && d.rate > d.prior;
                  const down = !d.held && d.rate < d.prior;
                  const direction = d.held ? 'Held' : up ? 'Increased' : down ? 'Decreased' : 'Unchanged';
                  return (
                    <Row
                      key={d.date}
                      style={{ justifyContent: 'space-between', paddingVertical: 6 }}
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={rbaDecisionA11yLabel(d.prior, d.rate, formatRunDate(d.date))}
                    >
                      <AppText variant="small" color="textMuted">
                        {formatRunDate(d.date)}
                      </AppText>
                      <Row gap={6}>
                        <AppText variant="tiny" color="textFaint">
                          {direction}
                        </AppText>
                        {up || down ? (
                          <Ionicons
                            name={up ? 'arrow-up' : 'arrow-down'}
                            size={14}
                            color={up ? theme.colors.danger : theme.colors.success}
                          />
                        ) : null}
                        <AppText variant="small" weight="700">
                          {d.held ? `${formatRate(d.rate)} · on hold` : `${formatRate(d.prior)} → ${formatRate(d.rate)}`}
                        </AppText>
                      </Row>
                    </Row>
                  );
                })}
          </>
        ) : null}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <View>
            <AppText variant="h3">Market explorer</AppText>
            <AppText variant="tiny" color="textFaint">
              Four useful lenses on daily rate movement
            </AppText>
          </View>
          <Chip label="PRO" selected={showHistoryRibbon} />
        </Row>
        {showHistoryRibbon && deferredChartsReady ? (
          <>
            {sectionOptions.length > 1 ? (
              <SegmentedControl
                options={sectionOptions}
                value={activeSection}
                onChange={setActiveSection}
              />
            ) : null}
            <View style={{ marginTop: sectionOptions.length > 1 ? 8 : 0 }}>
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
              />
            </View>
            {rewindDate && explorerMode === 'pulse' ? (
              <View style={{ marginTop: 12 }}>
                <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <AppText variant="small" weight="700">Moves on {formatRunDate(rewindDate)}</AppText>
                  <Button title="Clear" variant="ghost" onPress={() => setRewindDate(null)} />
                </Row>
                <PulseDayMovers
                  payload={explorerInsights}
                  section={activeSection}
                  date={rewindDate}
                  productHistory={productHistory}
                  productHistoryError={productHistoryError}
                  onRetryProductHistory={() => void ensureProductHistory({ force: true })}
                  core={core}
                />
              </View>
            ) : null}
            {rewindDate && explorerMode !== 'pulse' ? (
              <View style={{ marginTop: 12 }}>
                <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <AppText variant="small" weight="700">
                    Market on {formatRunDate(rewindDate)}
                  </AppText>
                  <Button title="Back to today" variant="ghost" onPress={() => setRewindDate(null)} />
                </Row>
                <MarketSnapshotList
                  payload={explorerInsights}
                  section={activeSection}
                  date={rewindDate}
                />
              </View>
            ) : null}
            {historyBanksError ? (
              <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <AppText variant="tiny" color="danger" style={{ flex: 1 }}>
                  {historyBanksError}
                </AppText>
                <Button
                  title="Retry"
                  variant="ghost"
                  onPress={handleRetryHistory}
                  loading={retryingHistory}
                  disabled={retryingHistory}
                />
              </Row>
            ) : null}
          </>
        ) : showHistoryRibbon ? (
          <DeferredChartPlaceholder label="Preparing market history" height={220} />
        ) : (
          <Button
            title="Enable Market explorer"
            icon="sparkles"
            variant="secondary"
            onPress={() => {
              if (!requestPro('history_ribbon')) return;
              setPref('showHistoryRibbon', true);
            }}
          />
        )}
      </Card>

      <AppText variant="h3" style={{ marginBottom: 10 }}>
        Market snapshot
      </AppText>
      {interestSections.map((key) => {
        const data = core.sections[key];
        if (!data) return null;
        const stats = resolveSectionRibbonStats(
          data,
          data.rates,
          false,
          key,
          null,
          depositRankMetric,
          mortgageRateMetric,
        );
        if (stats.min === null) return null;
        const best = bestRow(data.rates, key, false, depositRankMetric, null, mortgageRateMetric);
        const bestLabel = rateValueLabel(key, 'best');
        const rankedBest = best
          ? rankFraction(best, key, depositRankMetric, mortgageRateMetric)
          : null;
        const bestRate = formatRankedFraction(rankedBest);
        return (
          <Pressable
            key={key}
            onPress={() => openBrowse(key)}
            accessibilityRole="button"
            accessibilityLabel={`${SECTIONS[key].title}, ${bestLabel} ${bestRate}`}
          >
            <Card style={{ marginBottom: 12 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <Row gap={8}>
                  <Ionicons
                    name={SECTIONS[key].icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={SECTIONS[key].accentColor}
                  />
                  <AppText variant="body" weight="700">
                    {SECTIONS[key].title}
                  </AppText>
                </Row>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText variant="tiny" color="textFaint">
                    {bestLabel}
                  </AppText>
                  <AppText
                    variant="body"
                    weight="800"
                    style={{
                      color: SECTIONS[key].lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit,
                    }}
                  >
                    {bestRate}
                  </AppText>
                </View>
              </Row>
              <Ribbon stats={stats} section={key} />
            </Card>
          </Pressable>
        );
      })}
      <AppText variant="tiny" color="textFaint" style={{ textAlign: 'center', marginTop: 8 }}>
        Snapshot from {formatRunDate(core.run_date)}
      </AppText>
      <ProPaywall
        visible={paywallVisible}
        intent={paywallIntent}
        onClose={closePaywall}
        onUpgraded={() => {
          if (paywallIntent === 'history_ribbon') setPref('showHistoryRibbon', true);
        }}
      />
    </ScreenScrollView>
  );
}

function DeferredChartPlaceholder({ label, height = 96 }: { label: string; height?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        minHeight: height,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: theme.colors.surfaceAlt,
      }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <AppText variant="tiny" color="textFaint">
        {label}
      </AppText>
    </View>
  );
}
