import { uiLabel } from "../src/lib/uiCopy";
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { RbaChart } from '../src/components/charts';
import { useTrustedExternalUrl } from '../src/components/ExternalLinkConfirmation';
import { useAuditExternalLinks } from '../src/hooks/useAuditExternalLinks';
import { LedgerAction, LedgerSection, LedgerText } from '../src/components/ledger';
import { RateOutlookChart } from '../src/components/rba/RateOutlookChart';
import { ScreenScrollView } from '../src/components/Screen';
import { Disclosure } from '../src/components/ui';
import { InfoRow } from '../src/components/settings/settingsUi';
import { uiDate, uiJoin, uiNumber, type UiCopy } from '../src/lib/uiCopy';
import { currentCashRate, nextMeeting, rbaCalendarCoverage, sydneyYmd } from '../src/data/rbaCalendar';
import { loadRbaMarketOutlook, RBA_F17_FORWARD_URL, RBA_J1_FORECAST_URL, subscribeRbaMarketOutlookCacheReset, type RbaMarketOutlook } from '../src/data/rbaMarketOutlook';
import { useStore } from '../src/data/store';
import { usePerformanceAuditProbe, usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { yieldToPaintFrames } from '../src/lib/yieldToUi';
import { hasPositiveChartLayout, type ChartRenderEvidence } from '../src/lib/chartRenderEvidence';
import type { PerformanceAuditProbeDefinition } from '../src/lib/performanceAuditReadiness';

const ASX_TRACKER_URL = 'https://www.asx.com.au/markets/trade-our-derivatives-market/futures-market/rba-rate-tracker';
const DAY_MS = 86_400_000;
type OutlookChart = 'forecast' | 'bonds';
type MeasuredOutlookChart = ChartRenderEvidence & { renderToken: object };

export default function RbaRates() {
  const focused = useIsFocused();
  const core = useStore((state) => state.core);
  const calendar = useStore((state) => state.rbaCalendar);
  const calendarAsset = useStore((state) => state.manifest?.files.rba_calendar?.sha256);
  const ensureRbaCalendar = useStore((state) => state.ensureRbaCalendar);
  const { requestExternalUrl } = useTrustedExternalUrl();
  useAuditExternalLinks([
    { url: ASX_TRACKER_URL, purpose: 'official_market_source', label: 'ASX RBA Rate Tracker' },
    { url: RBA_J1_FORECAST_URL, purpose: 'official_economic_source', label: 'RBA economist survey' },
    { url: RBA_F17_FORWARD_URL, purpose: 'official_economic_source', label: 'RBA bond forward rates' },
  ]);
  const [now, setNow] = useState(Date.now);
  const [outlook, setOutlook] = useState<RbaMarketOutlook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [forecastIndex, setForecastIndex] = useState(0);
  const [bondIndex, setBondIndex] = useState(1);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [graphReady, setGraphReady] = useState<Record<OutlookChart, MeasuredOutlookChart | null>>({ forecast: null, bonds: null });
  const [activeAuditChart, setActiveAuditChart] = useState<'forecast' | 'bonds' | null>(null);
  const epoch = useRef(0);
  const today = sydneyYmd(now);
  const history = useMemo(() => core?.rba.filter((point) => point.date <= today) ?? [], [core?.rba, today]);
  const calendarCashRate=currentCashRate(calendar,now);
  const cashRate = calendarCashRate ?? history.at(-1)?.rate ?? null;
  const lastEffectiveDecision=calendar?.decisions.filter(decision=>(decision.effective??decision.date)<=today).at(-1);
  const cashRateDate=calendarCashRate!=null ? lastEffectiveDecision?.date:history.at(-1)?.date;
  const meeting = nextMeeting(calendar, now);
  const coverage = rbaCalendarCoverage(calendar, now);
  const forecasts = useMemo(() => outlook?.economists?.points.filter((point) => point.date.slice(0, 7) >= today.slice(0, 7)) ?? [], [outlook?.economists, today]);
  const bonds = outlook?.bondForwards?.points;
  const forecastRevision = forecasts.map((point) => `${point.date}:${point.value}`).join('|');
  const bondRevision = bonds?.map((point) => `${point.date}:${point.value}`).join('|') ?? '';

  const refresh = useCallback(async (force = false) => {
    const request = ++epoch.current;
    setLoading(true);
    setError(false);
    await yieldToPaintFrames(2);
    if (request !== epoch.current) return;
    try {
      const next = await loadRbaMarketOutlook(force);
      if (request === epoch.current) setOutlook(next);
    } catch {
      if (request === epoch.current) setError(true);
    } finally {
      if (request === epoch.current) setLoading(false);
    }
  }, []);

  useEffect(() => subscribeRbaMarketOutlookCacheReset(() => {
    epoch.current += 1;
    setOutlook(null);
    setLoading(false);
    setError(false);
    setGraphReady({ forecast: null, bonds: null });
    setActiveAuditChart(null);
    setForecastIndex(0);
    setBondIndex(1);
  }), []);

  useEffect(() => {
    if (!focused) return;
    void refresh();
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(Date.now());
        void ensureRbaCalendar();
        void refresh();
      }
    });
    return () => {
      epoch.current += 1;
      clearInterval(timer);
      subscription.remove();
    };
  }, [ensureRbaCalendar, focused, refresh]);

  // A direct /rba launch can mount before the catalogue manifest has hydrated.
  useEffect(() => {
    if (focused && core?.run_date && calendarAsset) void ensureRbaCalendar();
  }, [calendarAsset, core?.run_date, ensureRbaCalendar, focused]);

  const forecastGraphicKey = `${forecastRevision}:${cashRate}:${forecasts.length ? Math.max(0, Math.min(forecastIndex, forecasts.length - 1)) : `${epoch.current}:${loading}`}`;
  const bondGraphicKey = `${bondRevision}:${cashRate}:${bonds?.length ? Math.max(0, Math.min(bondIndex, bonds.length - 1)) : `${epoch.current}:${loading}`}`;
  const forecastGraphicToken = useMemo(() => ({ key: forecastGraphicKey }), [forecastGraphicKey]);
  const bondGraphicToken = useMemo(() => ({ key: bondGraphicKey }), [bondGraphicKey]);
  const currentGraphicTokens = useRef({ forecast: forecastGraphicToken, bonds: bondGraphicToken });
  currentGraphicTokens.current = { forecast: forecastGraphicToken, bonds: bondGraphicToken };
  const recordGraphic = useCallback((chart: OutlookChart, renderToken: object, evidence: ChartRenderEvidence) => {
    // Late native layout from an older selection or removed chart cannot prove
    // the currently displayed chart, or erase its newer measured evidence.
    if (currentGraphicTokens.current[chart] !== renderToken) return;
    setGraphReady((previous) => currentGraphicTokens.current[chart] === renderToken
      ? { ...previous, [chart]: { ...evidence, renderToken } } : previous);
  }, []);
  const forecastReady = useCallback((evidence: ChartRenderEvidence) => recordGraphic('forecast', forecastGraphicToken, evidence), [forecastGraphicToken, recordGraphic]);
  const bondsReady = useCallback((evidence: ChartRenderEvidence) => recordGraphic('bonds', bondGraphicToken, evidence), [bondGraphicToken, recordGraphic]);
  const datasetRevision = outlook?.checkedAt ?? core?.run_date ?? null;
  const renderRevision = `${datasetRevision}:${forecastIndex}:${bondIndex}:${activeAuditChart ?? 'open'}`;
  const auditSurface = usePerformanceAuditSurface({
    id: 'rba.dashboard', routeKey: '/rba', datasetRevision, renderRevision,
    actions: {
      'rba.open': () => setActiveAuditChart(null),
      'rba.forecast.next': () => {
        if (forecasts.length < 2) return { unavailableReason: 'At least two cached economist forecasts are required' };
        setActiveAuditChart('forecast');
        setGraphReady((previous) => ({ ...previous, forecast: null }));
        setForecastIndex((index) => (index + 1) % forecasts.length);
      },
      'rba.bonds.next': () => {
        if (!bonds || bonds.length < 2) return { unavailableReason: 'At least two cached bond forwards are required' };
        setActiveAuditChart('bonds');
        setGraphReady((previous) => ({ ...previous, bonds: null }));
        setBondIndex((index) => (index + 1) % bonds.length);
      },
    },
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'rba.data', kind: 'data', datasetRevision, renderRevision,
    status: loading ? 'pending' : 'ready',
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'rba.layout', kind: 'layout', datasetRevision, renderRevision,
    status: layoutReady ? 'ready' : 'pending', layoutMeasured: layoutReady,
  });
  const chartProbe = (chart: OutlookChart, revision: string, pointCount: number): PerformanceAuditProbeDefinition => {
    const evidence = graphReady[chart];
    const measured = !!evidence && evidence.renderToken === currentGraphicTokens.current[chart]
      && evidence.revision === revision && evidence.layoutMeasured;
    const complete = measured && evidence.expectedCount === pointCount && evidence.pointCount === pointCount
      && (pointCount > 0 ? evidence.accessibleSummary && !evidence.emptyStateRendered : evidence.emptyStateRendered);
    return {
      id: `rba.${chart}.chart`, kind: 'graphic', required: true, datasetRevision, renderRevision,
      status: complete ? 'ready' : 'pending', expectedCount: pointCount,
      actualCount: measured ? evidence.pointCount : 0,
      accessibleSummary: measured && evidence.accessibleSummary,
      layoutMeasured: measured, emptyStateRendered: measured && evidence.emptyStateRendered,
    };
  };
  usePerformanceAuditProbe(auditSurface, chartProbe('forecast', forecastRevision, forecasts.length));
  usePerformanceAuditProbe(auditSurface, chartProbe('bonds', bondRevision, bonds?.length ?? 0));

  const sourceLink = (url: string, label: UiCopy) => requestExternalUrl({ url, label, purpose: 'official_economic_source' });
  const bondStale = outlook?.bondForwards && now - Date.parse(outlook.bondForwards.observationDate) > 45 * DAY_MS;
  const surveyStale = outlook?.economists && now - Date.parse(outlook.economists.surveyDate) > 120 * DAY_MS;

  return (
    <ScreenScrollView>
      <View style={{ gap: 28 }} onLayout={(event) => setLayoutReady(event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0)}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
          <View style={{ flexGrow: 1, gap: 4 }}>
            <LedgerText variant="label" tone="mutedInk">{uiLabel('Last confirmed cash rate')}</LedgerText>
            <LedgerText variant="rateLarge">{cashRate == null ? uiLabel("—") : uiJoin(uiNumber(cashRate, 2), '%')}</LedgerText>
            <LedgerText variant="caption" tone="mutedInk">{core?.run_date ? uiJoin('Checked', ' ', uiDate(core.run_date)) : uiLabel("Official RBA decisions")}</LedgerText>
          </View>
          <View style={{ flexGrow: 1, justifyContent: 'center', gap: 4 }}>
            <LedgerText variant="label" tone="mutedInk">{coverage.unresolvedMeeting ? uiLabel("Awaiting decision result") : uiLabel("Next RBA decision")}</LedgerText>
            <LedgerText variant="heading">{coverage.unresolvedMeeting ? uiDate(coverage.unresolvedMeeting.date) : meeting ? uiDate(meeting.date) : uiLabel("Schedule unavailable")}</LedgerText>
          </View>
        </View>
        <InfoRow label={uiLabel(calendarCashRate!=null?'Decision':'Observed')} value={uiDate(cashRateDate)} />
        <InfoRow label="Source" value={calendarCashRate!=null?'Decisions':'History'} />

        <LedgerSection title="Market expectations">
          <LedgerAction label="View ASX market expectations" onPress={() => requestExternalUrl({ url: ASX_TRACKER_URL, label: 'ASX RBA Rate Tracker', purpose: 'official_market_source' })} />

        </LedgerSection>

        <LedgerSection title="Outlook">
          <LedgerAction label={uiLabel(loading ? 'Refreshing outlook' : 'Refresh outlook')} variant="quiet" loading={loading} onPress={() => { void refresh(true); }} style={{ alignSelf: 'flex-start' }} />
          {error ? <LedgerText tone="danger" accessibilityRole="alert">{uiLabel("Refresh failed")}</LedgerText> : null}
          {outlook?.refreshStatus === 'offline' ? <LedgerText tone="mutedInk">{uiJoin('Cached',' · ','Offline')}</LedgerText> : null}
          {outlook?.refreshStatus === 'partial' ? <LedgerText tone="mutedInk">{uiJoin('Refresh',' · ','Partial')}</LedgerText> : null}
        </LedgerSection>

        <LedgerSection title="Economists’ cash-rate forecast">
          {forecasts.length ? <RateOutlookChart key={`forecast:${cashRate}`} label="Economists’ cash-rate forecast" points={forecasts} cashRate={cashRate} selectedIndex={forecastIndex} onSelect={setForecastIndex} onGraphicReady={forecastReady} /> : <LedgerText key={forecastGraphicKey} tone="mutedInk" onLayout={(event) => {
            if (!loading) forecastReady({ revision: forecastRevision, expectedCount: 0, pointCount: 0,
              accessibleSummary: false, layoutMeasured: hasPositiveChartLayout(event), emptyStateRendered: true });
          }}>{loading ? uiLabel("Loading") : uiLabel("Forecast unavailable")}</LedgerText>}
          {outlook?.economists ? <LedgerText variant="caption" tone="mutedInk">{uiJoin('RBA J1', ' ', '·', ' ', 'Survey', ' ', uiDate(outlook.economists.surveyDate), ' ', '·', ' ', 'Published', ' ', uiDate(outlook.economists.publicationDate), surveyStale ? uiJoin(' ', '·', ' ', 'Older survey') : '')}</LedgerText> : null}
        </LedgerSection>

        <LedgerSection title="Bond-market forward rates">
          {bonds?.length ? <RateOutlookChart key={`bonds:${cashRate}`} label="Bond-market forward rates" points={bonds} cashRate={cashRate} tone="info" selectedIndex={bondIndex} onSelect={setBondIndex} onGraphicReady={bondsReady} /> : <LedgerText key={bondGraphicKey} tone="mutedInk" onLayout={(event) => {
            if (!loading) bondsReady({ revision: bondRevision, expectedCount: 0, pointCount: 0,
              accessibleSummary: false, layoutMeasured: hasPositiveChartLayout(event), emptyStateRendered: true });
          }}>{loading ? uiLabel("Loading") : uiLabel("Bond data unavailable")}</LedgerText>}
          {outlook?.bondForwards ? <LedgerText variant="caption" tone="mutedInk">{uiJoin('RBA F17', ' ', '·', ' ', 'Observed', ' ', uiDate(outlook.bondForwards.observationDate), ' ', '·', ' ', 'Published', ' ', uiDate(outlook.bondForwards.publicationDate), bondStale ? uiJoin(' ', '·', ' ', 'Older observation') : '')}</LedgerText> : null}
        </LedgerSection>

        <Disclosure title="Sources" open={sourcesOpen} onToggle={() => setSourcesOpen((open) => !open)}>
          <View style={{ gap: 12 }}>
            <InfoRow label="Economist forecast" value="Median" />
            <InfoRow label="Survey" value="Independent · Quarterly" />
            <InfoRow label="Bond forwards" value="Government bond prices" />
            <InfoRow label="Risk premiums" value="Included" />
            <InfoRow label="Cash-futures probabilities" value="Excluded" />
            <LedgerAction label="RBA economist survey source" variant="quiet" onPress={() => sourceLink(RBA_J1_FORECAST_URL, 'RBA economist survey source')} />
            <LedgerAction label="RBA bond-forward source" variant="quiet" onPress={() => sourceLink(RBA_F17_FORWARD_URL, 'RBA bond-forward source')} />
          </View>
        </Disclosure>
        <Disclosure title="Cash-rate history" open={historyOpen} onToggle={() => setHistoryOpen((open) => !open)}>
          {history.length ? <RbaChart data={history} holds={core?.rba_holds} height={220} /> : <LedgerText tone="mutedInk">{uiLabel("History unavailable")}</LedgerText>}
        </Disclosure>
        <LedgerAction label="See bank responses" variant="secondary" onPress={() => router.push('/rba-response')} />
      </View>
    </ScreenScrollView>
  );
}
