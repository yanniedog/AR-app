import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { BankMovesFeed, MoversLeaderboard } from '../../src/components/BankInsights';
import { ScreenScrollView } from '../../src/components/Screen';
import { SegmentedControl } from '../../src/components/controls';
import { ScreenSkeleton } from '../../src/components/feedback';
import { AppText, Button, Card, Disclosure, SectionHeading } from '../../src/components/ui';
import { SECTIONS } from '../../src/constants';
import { filterBankInsightsForSuitability, marketPulse } from '../../src/data/bankInsights';
import { sectionSegmentOptions } from '../../src/data/interests';
import { useStore } from '../../src/data/store';
import { isSuitabilityFilterReady } from '../../src/data/suitabilityGate';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
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

export default function RateMovesTab() {
  const core = useStore((state) => state.core);
  const rawPayload = useStore((state) => state.bankInsights);
  const error = useStore((state) => state.bankInsightsError);
  const ensureBankInsights = useStore((state) => state.ensureBankInsights);
  const retryBankInsights = useStore((state) => state.retryBankInsights);
  const ensureDetails = useStore((state) => state.ensureDetails);
  const ensureRbaCalendar = useStore((state) => state.ensureRbaCalendar);
  const detailsProducts = useStore((state) => state.details?.products ?? null);
  const includeNonStandard = useStore((state) => state.prefs.includeNonStandard);
  const interests = useStore((state) => state.prefs.interests);
  const activeSection = useStore((state) => state.activeSection);
  const setActiveSection = useStore((state) => state.setActiveSection);
  const [retrying, setRetrying] = useState(false);
  const [moversOpen, setMoversOpen] = useState(false);
  const suitabilityRevision = useSuitabilityRevision();
  const { date: decisionDateRaw } = useLocalSearchParams<{ date?: string | string[] }>();
  const decisionDate = scalarRouteParam(decisionDateRaw);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);

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
    router.replace({ pathname: '/rba-response', params: { date: decisionDate } } as never);
  }, [decisionDate]);

  const payload = useMemo(() => {
    void suitabilityRevision;
    return filterBankInsightsForSuitability(
      rawPayload,
      core,
      includeNonStandard,
      detailsProducts,
    );
  }, [core, detailsProducts, includeNonStandard, rawPayload, suitabilityRevision]);
  const pulse = useMemo(() => marketPulse(payload, 7, [activeSection]), [activeSection, payload]);
  const suitabilityWarming = rawPayload !== null && payload === null && !error && !suitabilityReady;
  const filteredEmpty = rawPayload !== null && payload === null && !error && suitabilityReady;

  if (!core) return <ScreenSkeleton />;

  return (
    <ScreenScrollView>
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
            <BankMovesFeed payload={payload} error={error} sections={[activeSection]} limit={14} />
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
            <AppText variant="small" color="textMuted">{error}</AppText>
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
          summary="See which lenders changed the most"
          open={moversOpen}
          onToggle={() => setMoversOpen((open) => !open)}
        >
          <MoversLeaderboard payload={payload} section={activeSection} />
        </Disclosure>
      ) : null}

      <Card variant="outlined" style={{ gap: 10 }}>
        <SectionHeading
          title="After an RBA decision"
          subtitle="Explore how quickly advertised lender medians responded"
        />
        <Button
          title="Explore RBA responses"
          variant="secondary"
          icon="analytics-outline"
          onPress={() => router.push('/rba-response')}
          disabled={!payload}
        />
      </Card>

      <AppText variant="small" color="textMuted" style={{ textAlign: 'center' }}>
        Advertised rates are observations, not proof of causation or the rate an individual customer received.
      </AppText>
    </ScreenScrollView>
  );
}
