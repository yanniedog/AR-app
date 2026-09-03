import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { BankMovesFeed, MoversLeaderboard } from '../../src/components/BankInsights';
import { ScreenScrollView } from '../../src/components/Screen';
import { SegmentedControl } from '../../src/components/controls';
import { ScreenSkeleton } from '../../src/components/feedback';
import { AppText, Button, Card, Disclosure, SectionHeading } from '../../src/components/ui';
import { SECTIONS } from '../../src/constants';
import {
  filterBankInsightsForSuitability,
  marketPulse,
  rbaPassThroughMultiSection,
} from '../../src/data/bankInsights';
import { summarizeSectionResponse } from '../../src/data/passThroughModels';
import { resolveInterestSection, sectionSegmentOptions } from '../../src/data/interests';
import { useStore } from '../../src/data/store';
import { isSuitabilityFilterReady } from '../../src/data/suitabilityGate';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { usePerformanceAuditSurface } from '../../src/hooks/usePerformanceAuditReadiness';
import { formatRunDate } from '../../src/data/format';
import { scalarRouteParam } from '../../src/lib/nav';

function weeklySummary(
  section: keyof typeof SECTIONS,
  pulse: ReturnType<typeof marketPulse>,
): string {
  const label = SECTIONS[section].title.toLowerCase();
  if (!pulse || pulse.banksMoved === 0) return `No tracked ${label} changes in the last 7 days.`;
  const up = pulse.hikes;
  const down = pulse.cuts;
  const mixedSummary = pulse.mixed
    ? ` and ${pulse.mixed} mixed move${pulse.mixed === 1 ? '' : 's'}`
    : '';
  if (section === 'Mortgage') {
    return `${pulse.banksMoved} lender${pulse.banksMoved === 1 ? '' : 's'} changed ${label}: ${down} cut${down === 1 ? '' : 's'}, ${up} increase${up === 1 ? '' : 's'}${mixedSummary}.`;
  }
  return `${pulse.banksMoved} lender${pulse.banksMoved === 1 ? '' : 's'} changed ${label}: ${up} increase${up === 1 ? '' : 's'}, ${down} decrease${down === 1 ? '' : 's'}${mixedSummary}.`;
}

interface FeedRenderEvidence {
  expectedCount: number;
  actualCount: number;
  emptyStateRendered: boolean;
}

export default function RateMovesTab() {
  const core = useStore((state) => state.core);
  const coreIntegrity = useStore((state) => state.coreIntegrity);
  const coreSha = useStore((state) => state.manifest?.files.core.sha256 ?? null);
  const rawPayload = useStore((state) => state.bankInsights);
  const calendar = useStore((state) => state.rbaCalendar);
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
  const [feedEvidence, setFeedEvidence] = useState<FeedRenderEvidence>({
    expectedCount: 0,
    actualCount: 0,
    emptyStateRendered: false,
  });
  const suitabilityRevision = useSuitabilityRevision();
  const { date: decisionDateRaw } = useLocalSearchParams<{ date?: string | string[] }>();
  const decisionDate = scalarRouteParam(decisionDateRaw);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);

  useEffect(() => {
    setActiveSection((current) => resolveInterestSection(interests, current));
  }, [interests]);

  useEffect(() => {
    if (!core) return;
    void ensureBankInsights();
    void ensureRbaCalendar();
  }, [core, ensureBankInsights, ensureRbaCalendar]);

  const suitabilityReady = useMemo(() => {
    void suitabilityRevision;
    return isSuitabilityFilterReady(includeNonStandard);
  }, [includeNonStandard, suitabilityRevision]);

  useEffect(() => {
    if (!core || includeNonStandard || isSuitabilityFilterReady(includeNonStandard)) return;
    void ensureDetails({ force: true });
  }, [core, ensureDetails, includeNonStandard]);

  // Preserve existing notification deep links while making the tab itself a
  // useful chronological feed rather than an advanced analytics landing page.
  useEffect(() => {
    if (!decisionDate) return;
    router.replace({ pathname: '/rba-response', params: { date: decisionDate, section: activeSection } } as never);
  }, [activeSection, decisionDate]);

  const payload = useMemo(() => {
    void suitabilityRevision;
    return filterBankInsightsForSuitability(
      rawPayload,
      core,
      includeNonStandard,
      detailsProducts,
      suitabilityRevision,
      coreIntegrity,
    );
  }, [core, coreIntegrity, detailsProducts, includeNonStandard, rawPayload, suitabilityRevision]);
  const pulse = useMemo(() => marketPulse(payload, 7, [activeSection]), [activeSection, payload]);
  const currentRbaWindow = useMemo(
    () => payload && core ? rbaPassThroughMultiSection(payload, core.rba, { calendar }) : null,
    [calendar, core, payload],
  );
  const currentRbaSummary = useMemo(
    () => currentRbaWindow ? summarizeSectionResponse(currentRbaWindow, activeSection) : null,
    [activeSection, currentRbaWindow],
  );
  const suitabilityWarming = rawPayload !== null && payload === null && !error && !suitabilityReady;
  const filteredEmpty = rawPayload !== null && payload === null && !error && suitabilityReady;

  const changeSection = useCallback(() => {
    const index = sectionOptions.findIndex((option) => option.value === activeSection);
    const next = sectionOptions[(Math.max(0, index) + 1) % Math.max(1, sectionOptions.length)];
    if (next) setActiveSection(next.value);
  }, [activeSection, sectionOptions]);
  const auditActions = useMemo(() => ({
    'changes.open': () => undefined,
    'changes.section.next': changeSection,
    'changes.movers.toggle': () => setMoversOpen((open) => !open),
  }), [changeSection]);
  const renderRevision = `${payload?.run_date ?? core?.run_date ?? 'none'}:${activeSection}:${moversOpen ? 'movers' : 'feed'}`;
  usePerformanceAuditSurface({
    id: 'changes.feed',
    routeKey: '/passthrough',
    datasetRevision: coreSha ?? core?.run_date ?? null,
    renderRevision,
    actions: auditActions,
    probes: [
      {
        id: 'changes.data',
        kind: 'data',
        status: payload || filteredEmpty ? 'ready' : error ? 'error' : 'pending',
        error: error && !payload ? 'Observed rate changes could not be prepared' : null,
        datasetRevision: coreSha ?? core?.run_date ?? null,
      },
      {
        id: 'changes.feed-list',
        kind: 'list',
        status: payload && (
          feedEvidence.emptyStateRendered ||
          feedEvidence.actualCount >= feedEvidence.expectedCount
        ) ? 'ready' : filteredEmpty ? 'ready' : 'pending',
        expectedCount: feedEvidence.expectedCount,
        actualCount: feedEvidence.actualCount,
        emptyStateRendered: feedEvidence.emptyStateRendered,
      },
      {
        id: 'changes.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
        renderRevision,
      },
    ],
  });

  if (!core) return <ScreenSkeleton />;

  return (
    <ScreenScrollView onLayout={() => setLayoutReady(true)}>
      {sectionOptions.length > 1 ? (
        <SegmentedControl options={sectionOptions} value={activeSection} onChange={setActiveSection} />
      ) : null}

      <Card variant="outlined" style={{ gap: 10 }}>
        <AppText variant="small" color="textMuted">
          Last 7 days · {SECTIONS[activeSection].short}
        </AppText>
        <AppText variant="h2">{weeklySummary(activeSection, pulse)}</AppText>
        <AppText variant="small" color="textMuted">
          Observed changes in advertised rates. Tap a lender to see the products involved.
        </AppText>
      </Card>

      <View style={{ gap: 10 }}>
        <SectionHeading
          title="Latest changes"
          subtitle={
            payload
              ? `Updated ${formatRunDate(payload.run_date)}`
              : filteredEmpty
                ? 'No observations match the current product settings'
                : 'Preparing the latest observed changes'
          }
        />
        {payload ? (
          <Card>
            <BankMovesFeed
              payload={payload}
              error={error}
              sections={[activeSection]}
              limit={14}
              onRenderEvidence={setFeedEvidence}
            />
          </Card>
        ) : suitabilityWarming ? (
          <Card variant="outlined" style={{ gap: 10 }}>
            <AppText variant="body" weight="700">Preparing compatible rate moves</AppText>
            <AppText variant="small" color="textMuted">
              Checking which products are broadly available before showing lender changes.
            </AppText>
            <Button
              title="Retry preparation"
              variant="secondary"
              onPress={() => void ensureDetails({ force: true, abandonInFlight: true })}
            />
          </Card>
        ) : filteredEmpty ? (
          <Card variant="outlined" style={{ gap: 8 }}>
            <AppText variant="body" weight="700">No compatible rate moves</AppText>
            <AppText variant="small" color="textMuted">
              No observed lender changes match the products currently included in your settings.
            </AppText>
          </Card>
        ) : error ? (
          <Card variant="outlined" style={{ gap: 12 }}>
            <AppText variant="body" weight="700">Rate moves are unavailable</AppText>
            <AppText variant="small" color="textMuted">
              The latest observations could not be prepared. Previously downloaded rates remain available.
            </AppText>
            <Button
              title="Retry"
              icon="refresh"
              loading={retrying}
              onPress={() => {
                setRetrying(true);
                void retryBankInsights().finally(() => setRetrying(false));
              }}
            />
          </Card>
        ) : (
          <Card><AppText variant="small" color="textMuted">Preparing rate moves…</AppText></Card>
        )}
        {payload && error ? (
          <AppText variant="small" color="textMuted">
            Showing cached observations · the latest check was unavailable.
          </AppText>
        ) : null}
      </View>

      {payload ? (
        <Disclosure
          title="Biggest 30-day movers"
          summary="See which banks changed the most"
          open={moversOpen}
          onToggle={() => setMoversOpen((open) => !open)}
        >
          <MoversLeaderboard payload={payload} section={activeSection} />
        </Disclosure>
      ) : null}

      <Card variant="outlined" style={{ gap: 10 }}>
        <SectionHeading
          title="Since the latest RBA decision"
          subtitle={currentRbaSummary && currentRbaSummary.eligible > 0
            ? `${currentRbaSummary.movedWithRba} of ${currentRbaSummary.eligible} observed banks moved in the same direction`
            : 'See how banks moved after current and previous cash-rate decisions'}
        />
        <Button
          title="Compare bank responses"
          variant="secondary"
          icon="analytics-outline"
          onPress={() => router.push({ pathname: '/rba-response', params: { section: activeSection } })}
          disabled={!payload}
        />
      </Card>

      <Card variant="outlined" style={{ gap: 10 }}>
        <SectionHeading
          title="Market and RBA research"
          subtitle="Rate history, RBA decisions and the economic signals shaping rates"
        />
        <Button
          title="Explore the data"
          icon="analytics-outline"
          variant="secondary"
          onPress={() => router.navigate('/research')}
        />
      </Card>
    </ScreenScrollView>
  );
}
