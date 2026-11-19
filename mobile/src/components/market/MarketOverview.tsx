import { uiCount, uiDate, uiJoin, uiLabel, uiPercentage } from "../../lib/uiCopy";
import { useIsFocused } from '@react-navigation/native';
import { currentCashRate, nextMeeting, rbaCalendarCoverage, sydneyYmd } from '../../data/rbaCalendar';
import { OpaquePerformanceAuditRenderRevision } from '../../lib/performanceAuditReadiness';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { BankMovesFeed, MoversLeaderboard } from '../../components/BankInsights';
import { ScreenScrollView } from '../../components/Screen';
import { SegmentedControl } from '../../components/controls';
import { ScreenSkeleton } from '../../components/feedback';
import { AppText, Button, Disclosure, SectionHeading } from '../../components/ui';
import {
  filterBankInsightsForSuitabilityCooperatively,
  marketPulse,
  recentBankEvents,
} from '../../data/bankInsights';
import { resolveInterestSection, sectionSegmentOptions } from '../../data/interests';
import { useStore } from '../../data/store';
import { isSuitabilityFilterReady } from '../../data/suitabilityGate';
import { useNavigationContentReady } from '../../hooks/useNavigationContentReady';
import { useSuitabilityRevision } from '../../hooks/useSuitabilityRevision';
import { usePerformanceAuditSurface } from '../../hooks/usePerformanceAuditReadiness';
import { scalarRouteParam } from '../../lib/nav';
import {
  isFeedRenderEvidenceReady,
  reconcileFeedRenderEvidence,
  resolveFeedRenderProbe,
  resetFeedRenderEvidence,
  type FeedLayoutEvidence,
  type FeedRenderEvidence,
} from '../../lib/feedRenderEvidence';

const FEED_PREVIEW = 5;
const FEED_FULL = 14;

export default function MarketOverview() {
  const focused = useIsFocused();
  // Latch so blur does not clear payload / unmount feeds and clamp scroll offset.
  const contentReady = useNavigationContentReady(focused, { latchAfterReady: true });
  const [now, setNow] = useState(Date.now);
  const [calendarAttempted, setCalendarAttempted] = useState(false);
  const [factsLayout, setFactsLayout] = useState<string | null>(null);
  const revisionTracker = useRef(new OpaquePerformanceAuditRenderRevision());
  const core = useStore((state) => state.core);
  const coreIntegrity = useStore((state) => state.coreIntegrity);
  const coreSha = useStore((state) => state.manifest?.files.core.sha256 ?? null);
  const bankInsightsSha = useStore((state) => state.manifest?.files.bank_history?.sha256 ?? null);
  const rawPayload = useStore((state) => state.bankInsights);
  const calendar = useStore((state) => state.rbaCalendar);
  const calendarSha = useStore(state => state.manifest?.files.rba_calendar?.sha256 ?? null);
  const calendarError = useStore(state => state.rbaCalendarError);
  const source = useStore(state => state.source);
  const offline = useStore(state => state.offline);
  const error = useStore((state) => state.bankInsightsError);
  const ensureBankInsights = useStore((state) => state.ensureBankInsights);
  const retryBankInsights = useStore((state) => state.retryBankInsights);
  const ensureDetails = useStore((state) => state.ensureDetails);
  const ensureRbaCalendar = useStore((state) => state.ensureRbaCalendar);
  const detailsProducts = useStore((state) => state.details?.products ?? null);
  const includeNonStandard = useStore((state) => state.prefs.includeNonStandard);
  const interests = useStore((state) => state.prefs.interests);
  const defaultSection = useStore((state) => state.prefs.defaultSection);
  const [activeSection, setActiveSection] = useState(() => resolveInterestSection(interests, defaultSection));
  const [retrying, setRetrying] = useState(false);
  const [moversOpen, setMoversOpen] = useState(false);
  const [feedLimit, setFeedLimit] = useState(FEED_PREVIEW);
  const [layoutReady, setLayoutReady] = useState(false);
  const [feedEvidence, setFeedEvidence] = useState<FeedRenderEvidence>(() =>
    resetFeedRenderEvidence('uninitialised', 0));
  const suitabilityRevision = useSuitabilityRevision();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const requestedSection = scalarRouteParam(params.section);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const feedSections = useMemo(() => [activeSection], [activeSection]);

  useEffect(() => {
    setActiveSection((current) => resolveInterestSection(interests, current));
  }, [interests]);

  useEffect(() => {
    if (!core || !focused || !contentReady) return;
    void ensureBankInsights();
    let current = true;
    setCalendarAttempted(false);
    void ensureRbaCalendar().catch(() => undefined).finally(() => { if (current) setCalendarAttempted(true); });
    return () => { current = false; };
  }, [contentReady, core, focused, calendarSha, ensureBankInsights, ensureRbaCalendar]);
  useEffect(() => {
    if (!focused) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') {
      setNow(Date.now()); void ensureRbaCalendar();
    } });
    return () => { clearInterval(timer); listener.remove(); };
  }, [ensureRbaCalendar, focused]);
  useEffect(() => {
    if (requestedSection === 'Mortgage' || requestedSection === 'Savings' || requestedSection === 'TD') setActiveSection(requestedSection);
  }, [requestedSection]);

  const suitabilityReady = useMemo(() => {
    void suitabilityRevision;
    return isSuitabilityFilterReady(includeNonStandard);
  }, [includeNonStandard, suitabilityRevision]);

  useEffect(() => {
    if (!core || includeNonStandard || isSuitabilityFilterReady(includeNonStandard)) return;
    void ensureDetails({ force: true });
  }, [core, ensureDetails, includeNonStandard]);

  const [filteredInsights, setFilteredInsights] = useState<{
    rawPayload: typeof rawPayload;
    core: typeof core;
    coreIntegrity: typeof coreIntegrity;
    detailsProducts: typeof detailsProducts;
    includeNonStandard: boolean;
    suitabilityRevision: number;
    payload: Awaited<ReturnType<typeof filterBankInsightsForSuitabilityCooperatively>>;
  } | null>(null);

  useEffect(() => {
    if (!contentReady || !rawPayload || !core) {
      setFilteredInsights(null);
      return;
    }
    let cancelled = false;
    void filterBankInsightsForSuitabilityCooperatively(
      rawPayload,
      core,
      includeNonStandard,
      detailsProducts,
      suitabilityRevision,
      coreIntegrity,
      { cancelled: () => cancelled },
    ).then((nextPayload) => {
      if (cancelled) return;
      setFilteredInsights({
        rawPayload,
        core,
        coreIntegrity,
        detailsProducts,
        includeNonStandard,
        suitabilityRevision,
        payload: nextPayload,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [contentReady, core, coreIntegrity, detailsProducts, includeNonStandard, rawPayload, suitabilityRevision]);

  const filterMatchesCurrent =
    contentReady &&
    rawPayload !== null &&
    core !== null &&
    filteredInsights !== null &&
    filteredInsights.rawPayload === rawPayload &&
    filteredInsights.core === core &&
    filteredInsights.coreIntegrity === coreIntegrity &&
    filteredInsights.detailsProducts === detailsProducts &&
    filteredInsights.includeNonStandard === includeNonStandard &&
    filteredInsights.suitabilityRevision === suitabilityRevision;
  const payload = filterMatchesCurrent ? filteredInsights.payload : null;
  const filteringPending = contentReady && rawPayload !== null && core !== null && !filterMatchesCurrent;
  const pulse = useMemo(() => marketPulse(payload, 7, feedSections), [feedSections, payload]);
  const suitabilityWarming = rawPayload !== null && payload === null && !error && (!suitabilityReady || !contentReady);
  const filteredEmpty = rawPayload !== null && payload === null && !error && suitabilityReady && contentReady && !filteringPending;
  const feedExpectedCount = useMemo(
    () => payload ? recentBankEvents(payload, { sections: feedSections, limit: feedLimit }).length : 0,
    [feedLimit, feedSections, payload],
  );
  const feedRenderRevision = `${payload?.run_date ?? core?.run_date ?? 'none'}:${bankInsightsSha ?? 'no-bank-history'}:${activeSection}:${suitabilityRevision}:${feedLimit}`;
  const feedHasMore = useMemo(
    () => payload ? recentBankEvents(payload, { sections: feedSections, limit: FEED_PREVIEW + 1 }).length > FEED_PREVIEW : false,
    [feedSections, payload],
  );

  const activeFeedIdentity = useRef({ revision: feedRenderRevision, count: feedExpectedCount });
  activeFeedIdentity.current = { revision: feedRenderRevision, count: feedExpectedCount };
  const recordFeedEvidence = useCallback((observed: FeedLayoutEvidence) => {
    // Reconcile the first layout for a new revision atomically. Resetting in an
    // effect can run after the replacement rows have already reported layout,
    // erasing valid evidence and leaving the audit at 0 of N rendered rows.
    setFeedEvidence((current) => activeFeedIdentity.current.revision !== feedRenderRevision || activeFeedIdentity.current.count !== feedExpectedCount ? current : reconcileFeedRenderEvidence(
      current,
      feedRenderRevision,
      feedExpectedCount,
      observed,
    ));
  }, [feedExpectedCount, feedRenderRevision]);
  const feedReady = isFeedRenderEvidenceReady(
    feedEvidence,
    feedRenderRevision,
    feedExpectedCount,
  );
  const currentFeedEvidence = feedEvidence.revision === feedRenderRevision &&
    feedEvidence.expectedCount === feedExpectedCount
    ? feedEvidence
    : resetFeedRenderEvidence(feedRenderRevision, feedExpectedCount);
  const feedProbe = resolveFeedRenderProbe({
    hasPayload: Boolean(payload),
    settledEmpty: filteredEmpty,
    dataError: Boolean(error),
    renderReady: feedReady,
  });

  const changeSection = useCallback(() => {
    const index = sectionOptions.findIndex((option) => option.value === activeSection);
    const next = sectionOptions[(Math.max(0, index) + 1) % Math.max(1, sectionOptions.length)];
    if (next) setActiveSection(next.value);
  }, [activeSection, sectionOptions]);
  const openHistory = useCallback(() => router.push({ pathname: '/bank-rates', params: { section: activeSection } }), [activeSection]);
  const openTrends = useCallback(() => router.push({ pathname: '/research', params: { section: activeSection } }), [activeSection]);
  const openRba = useCallback(() => router.push('/rba'), []);
  // The destination loads and measures its own observations. Overview filtering
  // can still be pending after returning from another screen.
  const openResponse = useCallback(() => {
    router.push({ pathname: '/rba-response', params: { section: activeSection } });
  }, [activeSection]);
  const toggleMovers = useCallback(() => {
    if (!payload) return { unavailableReason: 'Bank observations unavailable' };
    setMoversOpen(open => !open);
  }, [payload]);
  const auditActions = useMemo(() => ({
    'market.open': () => undefined,
    'changes.section.next': changeSection,
    'changes.movers.toggle': toggleMovers,
    'market.history.open': openHistory,
    'market.outlook.open': openTrends,
    'market.rba.open': openRba,
    'market.response.open': openResponse,
  }), [changeSection, openHistory, openRba, openResponse, openTrends, toggleMovers]);
  const asOfDate = sydneyYmd(now);
  const history = core?.rba.filter(point => point.date <= asOfDate) ?? [];
  const verifiedCalendarRate = currentCashRate(calendar, now);
  const cashRate = verifiedCalendarRate ?? history.at(-1)?.rate ?? null;
  const confirmedDecision = calendar?.decisions.filter(decision => (decision.effective ?? decision.date) <= asOfDate).at(-1);
  const cashRateDate = verifiedCalendarRate != null ? confirmedDecision?.effective ?? confirmedDecision?.date : history.at(-1)?.date;
  const coverage = rbaCalendarCoverage(calendar, now);
  const meeting = coverage.unresolvedMeeting ?? nextMeeting(calendar, now);
  const factsRevision = [coreSha, calendarSha, cashRate, cashRateDate, source, offline, meeting?.date, coverage.status].join(':');
  const activeFactsRevision = useRef(factsRevision); activeFactsRevision.current = factsRevision;
  const renderRevision = revisionTracker.current.update([feedRenderRevision, moversOpen, factsRevision]);
  usePerformanceAuditSurface({
    id: 'market.overview',
    routeKey: '/market',
    datasetRevision: coreSha ?? core?.run_date ?? null,
    renderRevision,
    actions: auditActions,
    probes: [
      { id: 'market.core', kind: 'data', status: core ? 'ready' : 'pending', datasetRevision: coreSha,
        expectedCount: 1, actualCount: core ? 1 : 0 },
      { id: 'market.calendar', kind: 'data', required: false,
        status: calendar ? 'ready' : calendarAttempted || calendarError ? 'error' : 'pending',
        error: !calendar && (calendarAttempted || calendarError) ? 'Calendar unavailable' : null,
        expectedCount: calendar ? calendar.decisions.length + calendar.schedule.length : 0,
        actualCount: calendar ? calendar.decisions.length + calendar.schedule.length : 0,
        // Dataset identity is the publication, not this asset's distinct SHA.
        // calendarSha still invalidates factsRevision and its measured layout.
        datasetRevision: coreSha ?? core?.run_date ?? null },
      { id: 'market.facts.layout', kind: 'layout', status: factsLayout === factsRevision ? 'ready' : 'pending',
        layoutMeasured: factsLayout === factsRevision, renderRevision },
      {
        id: 'market.movements.data',
        kind: 'data',
        status: payload || filteredEmpty ? 'ready' : error ? 'error' : 'pending',
        error: error && !payload ? 'Observed rate changes could not be prepared' : null,
        datasetRevision: coreSha ?? core?.run_date ?? null,
        expectedCount: feedExpectedCount,
        actualCount: payload || filteredEmpty ? feedExpectedCount : 0,
      },
      {
        id: 'market.movements.list',
        kind: 'list',
        status: feedProbe.status,
        error: feedProbe.error,
        expectedCount: feedExpectedCount,
        actualCount: currentFeedEvidence.actualCount,
        emptyStateRendered: currentFeedEvidence.emptyStateRendered,
      },
      {
        id: 'market.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
        renderRevision,
      },
    ],
  }, focused);

  if (!core) return <ScreenSkeleton />;

  return (
    <ScreenScrollView onLayout={event => { if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) setLayoutReady(true); }} contentContainerStyle={{ gap: 24 }}>
      <View key={factsRevision} onLayout={event => {
        if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) setFactsLayout(current => activeFactsRevision.current === factsRevision ? factsRevision : current);
      }} style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <View style={{ flexGrow: 1, gap: 2 }}>
            <AppText variant="small" color="textMuted">{uiLabel(verifiedCalendarRate == null || coverage.unresolvedMeeting ? 'Last confirmed cash rate' : 'Cash rate')}</AppText>
            <AppText variant="h1">{cashRate == null ? uiLabel("Unavailable") : uiPercentage(cashRate)}</AppText>
            {cashRate != null ? <AppText variant="tiny" color="textMuted">
              {uiJoin(uiDate(cashRateDate),source==='cache'||offline?uiJoin(' · ','Cached'):null,coverage.unresolvedMeeting?uiJoin(' · ','Awaiting decision'):null)}
            </AppText> : null}
          </View>
          <View style={{ flexGrow: 1, gap: 2 }}>
            <AppText variant="small" color="textMuted">{uiLabel(coverage.unresolvedMeeting ? 'Awaiting decision' : 'Next decision')}</AppText>
            <AppText variant="body" weight="600">{meeting ? uiDate(meeting.date) : calendarAttempted ? uiLabel("Unavailable") : uiLabel("Loading")}</AppText>
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button auditControlId="market-bank-response" title="Bank response" variant="secondary" style={{ flex: 1 }} onPress={openResponse} />
            <Button auditControlId="market-history" title="Bank rates" variant="secondary" style={{ flex: 1 }} onPress={openHistory} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button auditControlId="market-rba" title="RBA" variant="secondary" style={{ flex: 1 }} onPress={openRba} />
            <Button auditControlId="market-outlook" title="Trends" variant="secondary" style={{ flex: 1 }} onPress={openTrends} />
          </View>
        </View>
      </View>
      <SegmentedControl options={sectionOptions} value={activeSection} onChange={setActiveSection} />
      <View style={{ gap: 12 }}>
        <SectionHeading title="Recent movements" action={<AppText variant="small" color="textMuted">{payload ? uiDate(payload.run_date) : uiLabel("Unavailable")}</AppText>} />
        {pulse ? <AppText variant="small" color="textMuted" testID="market-pulse">
          {uiJoin('Last 7 days', ' · ', uiCount(pulse.banksMoved), ' ', 'banks', ' · ', '↑', ' ', uiCount(pulse.banksUp), ' · ', '↓', ' ', uiCount(pulse.banksDown), pulse.banksMixed ? uiJoin(' · ', 'Mixed', ' ', uiCount(pulse.banksMixed)) : null)}
        </AppText> : null}
        {payload ? <BankMovesFeed payload={payload} error={error} sections={feedSections} limit={feedLimit}
          contentRevision={feedRenderRevision} onRenderEvidence={recordFeedEvidence} /> : suitabilityWarming ? (
          <View style={{ gap: 8 }}><AppText variant="small">{uiLabel("Loading")}</AppText><Button title="Retry" variant="secondary" onPress={() => void ensureDetails({ force: true, abandonInFlight: true })} /></View>
        ) : filteredEmpty ? (
          <View key={'empty:' + feedRenderRevision} onLayout={event => {
            if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) recordFeedEvidence({ expectedCount: 0, actualCount: 0, emptyStateRendered: true });
          }}><AppText variant="body">{uiLabel("No movements")}</AppText></View>
        ) : error ? <View style={{ gap: 8 }}><AppText variant="small">{uiLabel("Movements unavailable")}</AppText>
          <Button title="Retry" loading={retrying} onPress={() => { setRetrying(true); void retryBankInsights().finally(() => setRetrying(false)); }} />
        </View> : <AppText variant="small">{uiLabel("Loading")}</AppText>}
        {payload && feedHasMore ? <Button title={feedLimit > FEED_PREVIEW ? 'Show fewer' : 'Show more'} variant="ghost"
          onPress={() => setFeedLimit(limit => limit > FEED_PREVIEW ? FEED_PREVIEW : FEED_FULL)} /> : null}
        {payload && error ? <AppText variant="small" color="textMuted">{uiLabel("Cached observations")}</AppText> : null}
      </View>
      {payload ? <Disclosure title="30-day movers" open={moversOpen} onToggle={toggleMovers}>
        <MoversLeaderboard payload={payload} section={activeSection} />
      </Disclosure> : null}
    </ScreenScrollView>
  );
}
