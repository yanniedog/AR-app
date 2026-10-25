import { uiCount, uiDate, uiJoin, uiLabel, uiNumber } from "../../lib/uiCopy";
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
  filterBankInsightsForSuitability,
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
  const [layoutReady, setLayoutReady] = useState(false);
  const [feedEvidence, setFeedEvidence] = useState<FeedRenderEvidence>(() =>
    resetFeedRenderEvidence('uninitialised', 0));
  const suitabilityRevision = useSuitabilityRevision();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const requestedSection = scalarRouteParam(params.section);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);

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

  const payload = useMemo(() => {
    if (!contentReady) return null;
    void suitabilityRevision;
    return filterBankInsightsForSuitability(
      rawPayload,
      core,
      includeNonStandard,
      detailsProducts,
      suitabilityRevision,
      coreIntegrity,
    );
  }, [contentReady, core, coreIntegrity, detailsProducts, includeNonStandard, rawPayload, suitabilityRevision]);
  const pulse = useMemo(() => marketPulse(payload, 7, [activeSection]), [activeSection, payload]);
  const suitabilityWarming = rawPayload !== null && payload === null && !error && (!suitabilityReady || !contentReady);
  const filteredEmpty = rawPayload !== null && payload === null && !error && suitabilityReady && contentReady;
  const feedExpectedCount = useMemo(
    () => payload ? recentBankEvents(payload, { sections: [activeSection], limit: 14 }).length : 0,
    [activeSection, payload],
  );
  const feedRenderRevision = `${payload?.run_date ?? core?.run_date ?? 'none'}:${bankInsightsSha ?? 'no-bank-history'}:${activeSection}`;

  const recordFeedEvidence = useCallback((observed: FeedLayoutEvidence) => {
    // Reconcile the first layout for a new revision atomically. Resetting in an
    // effect can run after the replacement rows have already reported layout,
    // erasing valid evidence and leaving the audit at 0 of N rendered rows.
    setFeedEvidence((current) => reconcileFeedRenderEvidence(
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
  const openOutlook = useCallback(() => router.push({ pathname: '/research', params: { section: activeSection } }), [activeSection]);
  const openRba = useCallback(() => router.push('/rba'), []);
  const openResponse = useCallback(() => {
    if (!payload) return { unavailableReason: 'Bank observations unavailable' };
    router.push({ pathname: '/rba-response', params: { section: activeSection } });
  }, [activeSection, payload]);
  const toggleMovers = useCallback(() => {
    if (!payload) return { unavailableReason: 'Bank observations unavailable' };
    setMoversOpen(open => !open);
  }, [payload]);
  const auditActions = useMemo(() => ({
    'market.open': () => undefined,
    'changes.section.next': changeSection,
    'changes.movers.toggle': toggleMovers,
    'market.history.open': openHistory,
    'market.outlook.open': openOutlook,
    'market.rba.open': openRba,
    'market.response.open': openResponse,
  }), [changeSection, openHistory, openOutlook, openRba, openResponse, toggleMovers]);
  const history = core?.rba.filter(point => point.date <= sydneyYmd(now)) ?? [];
  const verifiedCalendarRate = currentCashRate(calendar, now);
  const cashRate = verifiedCalendarRate ?? history.at(-1)?.rate ?? null;
  const confirmedDecision = calendar?.decisions.filter(decision => (decision.effective ?? decision.date) <= sydneyYmd(now)).at(-1);
  const cashRateDate = verifiedCalendarRate != null ? confirmedDecision?.effective ?? confirmedDecision?.date : history.at(-1)?.date;
  const coverage = rbaCalendarCoverage(calendar, now);
  const meeting = coverage.unresolvedMeeting ?? nextMeeting(calendar, now);
  const factsRevision = [coreSha, calendarSha, cashRate, cashRateDate, source, offline, meeting?.date, coverage.status].join(':');
  const renderRevision = revisionTracker.current.update([feedRenderRevision, moversOpen, factsRevision]);
  usePerformanceAuditSurface({
    id: 'market.overview',
    routeKey: '/market',
    datasetRevision: coreSha ?? core?.run_date ?? null,
    renderRevision,
    actions: auditActions,
    probes: [
      { id: 'market.core', kind: 'data', status: core ? 'ready' : 'pending', datasetRevision: coreSha },
      { id: 'market.calendar', kind: 'data', required: false,
        status: calendar ? 'ready' : calendarAttempted || calendarError ? 'error' : 'pending',
        error: !calendar && (calendarAttempted || calendarError) ? 'Calendar unavailable' : null,
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
        if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) setFactsLayout(factsRevision);
      }} style={{ gap: 16 }}>
        <AppText variant="small" color="textMuted">{uiLabel(verifiedCalendarRate == null || coverage.unresolvedMeeting ? 'Last confirmed cash rate' : 'Cash rate')}</AppText>
        <AppText variant="rateHero">{cashRate == null ? uiLabel("Unavailable") : uiJoin(uiNumber(cashRate,2),'%')}</AppText>
        {cashRate != null ? <AppText variant="small" color="textMuted">
          {uiJoin(uiDate(cashRateDate),source==='cache'||offline?uiJoin(' · ','Cached'):null,coverage.unresolvedMeeting?uiJoin(' · ','Awaiting decision'):null)}
        </AppText> : null}
        <View style={{ gap: 4 }}>
          <AppText variant="small" color="textMuted">{uiLabel(coverage.unresolvedMeeting ? 'Awaiting decision' : 'Next decision')}</AppText>
          <AppText variant="body" weight="600">{meeting ? uiDate(meeting.date) : calendarAttempted ? uiLabel("Unavailable") : uiLabel("Loading")}</AppText>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button title="History" variant="secondary" onPress={openHistory} />
          <Button title="Outlook" variant="secondary" onPress={openOutlook} />
          <Button title="RBA" variant="ghost" onPress={openRba} />
        </View>
      </View>
      <SegmentedControl options={sectionOptions} value={activeSection} onChange={setActiveSection} />
      <View style={{ gap: 12 }}>
        <SectionHeading title="Last 7 days" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
          {([{label:uiLabel("Banks"),value:pulse?.banksMoved},{label:uiLabel("Increases"),value:pulse?.hikes},{label:uiLabel("Cuts"),value:pulse?.cuts}] as const).map(({label,value}) =>
            <View key={String(label)} style={{ gap: 4 }}><AppText variant="h2">{uiCount(value)}</AppText><AppText variant="small" color="textMuted">{label}</AppText></View>)}
        </View>
      </View>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
          <SectionHeading title="Recent movements" />
          <AppText variant="small" color="textMuted">{payload ? uiDate(payload.run_date) : uiLabel("Unavailable")}</AppText>
        </View>
        {payload ? <BankMovesFeed payload={payload} error={error} sections={[activeSection]} limit={14}
          contentRevision={feedRenderRevision} onRenderEvidence={recordFeedEvidence} /> : suitabilityWarming ? (
          <View style={{ gap: 8 }}><AppText variant="small">{uiLabel("Loading")}</AppText><Button title="Retry" variant="secondary" onPress={() => void ensureDetails({ force: true, abandonInFlight: true })} /></View>
        ) : filteredEmpty ? (
          <View key={'empty:' + feedRenderRevision} onLayout={event => {
            if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) recordFeedEvidence({ expectedCount: 0, actualCount: 0, emptyStateRendered: true });
          }}><AppText variant="body">{uiLabel("No movements")}</AppText></View>
        ) : error ? <View style={{ gap: 8 }}><AppText variant="small">{uiLabel("Movements unavailable")}</AppText>
          <Button title="Retry" loading={retrying} onPress={() => { setRetrying(true); void retryBankInsights().finally(() => setRetrying(false)); }} />
        </View> : <AppText variant="small">{uiLabel("Loading")}</AppText>}
        {payload && error ? <AppText variant="small" color="textMuted">{uiLabel("Cached observations")}</AppText> : null}
      </View>
      {payload ? <Disclosure title="30-day movers" open={moversOpen} onToggle={toggleMovers}>
        <MoversLeaderboard payload={payload} section={activeSection} />
      </Disclosure> : null}
      <Button title="Bank response" variant="secondary" onPress={openResponse} disabled={!payload} />
    </ScreenScrollView>
  );
}
