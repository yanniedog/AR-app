import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { RbaChart } from '../src/components/charts';
import { useTrustedExternalUrl } from '../src/components/ExternalLinkConfirmation';
import { LedgerAction, LedgerSection, LedgerText } from '../src/components/ledger';
import { RateOutlookChart } from '../src/components/rba/RateOutlookChart';
import { ScreenScrollView } from '../src/components/Screen';
import { Disclosure } from '../src/components/ui';
import { formatRunDate } from '../src/data/format';
import { currentCashRate, formatRbaDate, nextMeeting, rbaCalendarCoverage, sydneyYmd } from '../src/data/rbaCalendar';
import { loadRbaMarketOutlook, RBA_F17_FORWARD_URL, RBA_J1_FORECAST_URL, subscribeRbaMarketOutlookCacheReset, type RbaMarketOutlook } from '../src/data/rbaMarketOutlook';
import { useStore } from '../src/data/store';
import { usePerformanceAuditProbe, usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { yieldToPaintFrames } from '../src/lib/yieldToUi';

const ASX_TRACKER_URL = 'https://www.asx.com.au/markets/trade-our-derivatives-market/futures-market/rba-rate-tracker';
const DAY_MS = 86_400_000;

export default function RbaRates() {
  const focused = useIsFocused();
  const core = useStore((state) => state.core);
  const calendar = useStore((state) => state.rbaCalendar);
  const calendarAsset = useStore((state) => state.manifest?.files.rba_calendar?.sha256);
  const ensureRbaCalendar = useStore((state) => state.ensureRbaCalendar);
  const { requestExternalUrl } = useTrustedExternalUrl();
  const [now, setNow] = useState(Date.now);
  const [outlook, setOutlook] = useState<RbaMarketOutlook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [forecastIndex, setForecastIndex] = useState(0);
  const [bondIndex, setBondIndex] = useState(1);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [graphReady, setGraphReady] = useState({ forecast: '', bonds: '' });
  const [activeAuditChart, setActiveAuditChart] = useState<'forecast' | 'bonds' | null>(null);
  const epoch = useRef(0);
  const today = sydneyYmd(now);
  const history = useMemo(() => core?.rba.filter((point) => point.date <= today) ?? [], [core?.rba, today]);
  const cashRate = currentCashRate(calendar, now) ?? history.at(-1)?.rate ?? null;
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
    setGraphReady({ forecast: '', bonds: '' });
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

  const forecastReady = useCallback((revision: string) => setGraphReady((previous) => previous.forecast === revision ? previous : { ...previous, forecast: revision }), []);
  const bondsReady = useCallback((revision: string) => setGraphReady((previous) => previous.bonds === revision ? previous : { ...previous, bonds: revision }), []);
  const datasetRevision = outlook?.checkedAt ?? core?.run_date ?? null;
  const renderRevision = `${datasetRevision}:${forecastIndex}:${bondIndex}:${activeAuditChart ?? 'open'}`;
  const auditSurface = usePerformanceAuditSurface({
    id: 'rba.dashboard', routeKey: '/rba', datasetRevision, renderRevision,
    actions: {
      'rba.open': () => setActiveAuditChart(null),
      'rba.forecast.next': () => {
        if (forecasts.length < 2) return { unavailableReason: 'At least two cached economist forecasts are required' };
        setActiveAuditChart('forecast');
        setForecastIndex((index) => (index + 1) % forecasts.length);
      },
      'rba.bonds.next': () => {
        if (!bonds || bonds.length < 2) return { unavailableReason: 'At least two cached bond forwards are required' };
        setActiveAuditChart('bonds');
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
  const chartRevision = activeAuditChart === 'forecast' ? forecastRevision : bondRevision;
  const chartRendered = !!activeAuditChart && !!chartRevision && graphReady[activeAuditChart] === chartRevision;
  const pointCount = activeAuditChart === 'forecast' ? forecasts.length : bonds?.length ?? 0;
  usePerformanceAuditProbe(auditSurface, {
    id: 'rba.chart', kind: 'graphic', required: activeAuditChart != null, datasetRevision, renderRevision,
    status: chartRendered ? 'ready' : 'pending', expectedCount: pointCount,
    actualCount: chartRendered ? pointCount : 0, accessibleSummary: chartRendered,
  });

  const sourceLink = (url: string, label: string) => requestExternalUrl({ url, label, purpose: 'official_economic_source' });
  const bondStale = outlook?.bondForwards && now - Date.parse(outlook.bondForwards.observationDate) > 45 * DAY_MS;
  const surveyStale = outlook?.economists && now - Date.parse(outlook.economists.surveyDate) > 120 * DAY_MS;

  return (
    <ScreenScrollView>
      <View style={{ gap: 28 }} onLayout={(event) => setLayoutReady(event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0)}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
          <View style={{ flexGrow: 1, gap: 4 }}>
            <LedgerText variant="label" tone="mutedInk">{coverage.status === 'awaiting-result' ? 'Last confirmed cash rate' : 'Cash rate target'}</LedgerText>
            <LedgerText variant="rateLarge">{cashRate == null ? '—' : `${cashRate.toFixed(2)}%`}</LedgerText>
            <LedgerText variant="caption" tone="mutedInk">{core?.run_date ? `Data checked ${formatRunDate(core.run_date)}` : 'Official RBA decisions'}</LedgerText>
          </View>
          <View style={{ flexGrow: 1, justifyContent: 'center', gap: 4 }}>
            <LedgerText variant="label" tone="mutedInk">{coverage.unresolvedMeeting ? 'Awaiting decision result' : 'Next RBA decision'}</LedgerText>
            <LedgerText variant="heading">{coverage.unresolvedMeeting ? formatRbaDate(coverage.unresolvedMeeting.date) : meeting ? formatRbaDate(meeting.date) : 'Schedule unavailable'}</LedgerText>
          </View>
        </View>

        <LedgerSection title="What markets expect" deck="See the market’s odds for the next RBA decision, and the rate path priced into cash futures.">
          <LedgerAction label="View ASX market expectations" onPress={() => requestExternalUrl({ url: ASX_TRACKER_URL, label: 'ASX RBA Rate Tracker', purpose: 'official_market_source' })} />
          <LedgerText variant="caption" tone="mutedInk">Opens ASX’s daily tracker. Market pricing changes as new information arrives.</LedgerText>
        </LedgerSection>

        <LedgerSection title="Where rates may go" deck="Two longer-term views, with the cash rate shown for comparison.">
          <LedgerAction label={loading ? 'Refreshing outlook' : 'Refresh outlook'} variant="quiet" loading={loading} onPress={() => { void refresh(true); }} style={{ alignSelf: 'flex-start' }} />
          {error ? <LedgerText tone="danger" accessibilityRole="alert">Official forecast data could not be refreshed. Try again when connected.</LedgerText> : null}
          {outlook?.refreshStatus === 'offline' ? <LedgerText tone="mutedInk">Saved data shown. Source dates appear below.</LedgerText> : null}
          {outlook?.refreshStatus === 'partial' ? <LedgerText tone="mutedInk">Some sources could not be refreshed. Check each graph’s date.</LedgerText> : null}
        </LedgerSection>

        <LedgerSection title="Economists’ cash-rate forecast" deck="Quarterly median from the RBA’s survey. This is separate from market pricing.">
          {forecasts.length ? <RateOutlookChart label="Economists’ cash-rate forecast" points={forecasts} cashRate={cashRate} selectedIndex={forecastIndex} onSelect={setForecastIndex} onReady={forecastReady} /> : <LedgerText tone="mutedInk">{loading ? 'Loading economist forecasts…' : 'No upcoming economist forecasts available.'}</LedgerText>}
          {outlook?.economists ? <LedgerText variant="caption" tone="mutedInk">RBA J1 · Survey {formatRunDate(outlook.economists.surveyDate)} · Published {formatRunDate(outlook.economists.publicationDate)}{surveyStale ? ' · Older survey' : ''}</LedgerText> : null}
        </LedgerSection>

        <LedgerSection title="Bond-market forward rates" deck="A market view over the next year. Bond forwards include risk premiums and do not predict individual RBA decisions.">
          {bonds?.length ? <RateOutlookChart label="Bond-market forward rates" points={bonds} cashRate={cashRate} tone="info" selectedIndex={bondIndex} onSelect={setBondIndex} onReady={bondsReady} /> : <LedgerText tone="mutedInk">{loading ? 'Loading bond forwards…' : 'Bond-market data is unavailable.'}</LedgerText>}
          {outlook?.bondForwards ? <LedgerText variant="caption" tone="mutedInk">RBA F17 · Observed {formatRunDate(outlook.bondForwards.observationDate)} · Published {formatRunDate(outlook.bondForwards.publicationDate)}{bondStale ? ' · Older observation' : ''}</LedgerText> : null}
        </LedgerSection>

        <Disclosure title="How to read these graphs" open={sourcesOpen} onToggle={() => setSourcesOpen((open) => !open)}>
          <View style={{ gap: 12 }}>
            <LedgerText>Tap a date to see its rate and the difference from the cash rate. The dashed line is the last confirmed RBA cash rate, not another forecast.</LedgerText>
            <LedgerText>Economists’ forecasts show their median cash-rate expectation for each quarter. They are not the RBA’s own prediction.</LedgerText>
            <LedgerText>Bond forwards are derived by the RBA from Australian government bond prices. They include compensation for risk and are not cash-futures probabilities. Their dates start from the observation date, not today.</LedgerText>
            <LedgerAction label="RBA economist survey source" variant="quiet" onPress={() => sourceLink(RBA_J1_FORECAST_URL, 'RBA economist survey')} />
            <LedgerAction label="RBA bond-forward source" variant="quiet" onPress={() => sourceLink(RBA_F17_FORWARD_URL, 'RBA bond forward rates')} />
          </View>
        </Disclosure>
        <Disclosure title="Cash-rate history" open={historyOpen} onToggle={() => setHistoryOpen((open) => !open)}>
          {history.length ? <RbaChart data={history} holds={core?.rba_holds} height={220} /> : <LedgerText tone="mutedInk">Cash-rate history is unavailable.</LedgerText>}
        </Disclosure>
        <LedgerAction label="See bank responses" variant="secondary" onPress={() => router.push('/rba-response')} />
      </View>
    </ScreenScrollView>
  );
}
