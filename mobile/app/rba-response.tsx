import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { BankResponseDashboard } from '../src/components/passthrough/BankResponseDashboard';
import { ScreenSkeleton } from '../src/components/feedback';
import { Screen, ScreenContent } from '../src/components/Screen';
import { AppText, Button, Card } from '../src/components/ui';
import { filterBankInsightsForSuitability } from '../src/data/bankInsights';
import { filterBankSpreadHistoryForIntegrity } from '../src/data/bankSpreadHistory';
import { useStore } from '../src/data/store';
import { isSuitabilityFilterReady } from '../src/data/suitabilityGate';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { scalarRouteParam } from '../src/lib/nav';

export default function RbaResponseScreen() {
  const core = useStore((state) => state.core);
  const coreIntegrity = useStore((state) => state.coreIntegrity);
  const calendar = useStore((state) => state.rbaCalendar);
  const rawPayload = useStore((state) => state.bankInsights);
  const spreadHistory = useStore((state) => state.bankSpreadHistory);
  const spreadError = useStore((state) => state.bankSpreadHistoryError);
  const error = useStore((state) => state.bankInsightsError);
  const detailsProducts = useStore((state) => state.details?.products ?? null);
  const includeNonStandard = useStore((state) => state.prefs.includeNonStandard);
  const ensureBankInsights = useStore((state) => state.ensureBankInsights);
  const ensureBankSpreadHistory = useStore((state) => state.ensureBankSpreadHistory);
  const retryBankInsights = useStore((state) => state.retryBankInsights);
  const retryBankSpreadHistory = useStore((state) => state.retryBankSpreadHistory);
  const ensureDetails = useStore((state) => state.ensureDetails);
  const ensureRbaCalendar = useStore((state) => state.ensureRbaCalendar);
  const suitabilityRevision = useSuitabilityRevision();
  const [retrying, setRetrying] = useState(false);
  const activeSection = useStore((state) => state.activeSection);
  const { date: decisionDateRaw, section: sectionRaw } = useLocalSearchParams<{
    date?: string | string[];
    section?: string | string[];
  }>();
  const decisionDate = scalarRouteParam(decisionDateRaw);
  const requestedSection = scalarRouteParam(sectionRaw);
  const initialSection = requestedSection === 'Mortgage' || requestedSection === 'Savings' || requestedSection === 'TD'
    ? requestedSection
    : activeSection;

  useEffect(() => {
    if (!core) return;
    void ensureBankInsights();
    void ensureBankSpreadHistory();
    void ensureRbaCalendar();
  }, [core, ensureBankInsights, ensureBankSpreadHistory, ensureRbaCalendar]);

  const suitabilityReady = useMemo(() => {
    void suitabilityRevision;
    return isSuitabilityFilterReady(includeNonStandard);
  }, [includeNonStandard, suitabilityRevision]);

  useEffect(() => {
    if (!core || includeNonStandard || isSuitabilityFilterReady(includeNonStandard)) return;
    void ensureDetails({ force: true });
  }, [core, ensureDetails, includeNonStandard]);

  const payload = useMemo(() => {
    void suitabilityRevision;
    return filterBankInsightsForSuitability(rawPayload, core, includeNonStandard, detailsProducts, suitabilityRevision, coreIntegrity);
  }, [core, coreIntegrity, detailsProducts, includeNonStandard, rawPayload, suitabilityRevision]);
  const trustedSpreadHistory = useMemo(
    () => filterBankSpreadHistoryForIntegrity(spreadHistory, coreIntegrity),
    [coreIntegrity, spreadHistory],
  );

  const retryInsights = () => {
    setRetrying(true);
    void retryBankInsights().finally(() => setRetrying(false));
  };

  if (!core) {
    return (
      <Screen>
        <ScreenSkeleton />
      </Screen>
    );
  }
  if (!payload) {
    const suitabilityWarming = rawPayload !== null && !error && !suitabilityReady;
    const filteredEmpty = rawPayload !== null && !error && suitabilityReady;
    return (
      <Screen>
        <ScreenContent style={{ flex: 1, justifyContent: 'center' }}>
        <Card variant="outlined" style={{ gap: 12 }}>
          <AppText variant="h3">
            {suitabilityWarming
              ? 'Preparing compatible RBA response analysis'
              : filteredEmpty
                ? 'No compatible RBA response analysis'
                : 'RBA response analysis unavailable'}
          </AppText>
          <AppText variant="small" color="textMuted">
            {suitabilityWarming
              ? 'Checking which products are broadly available before showing bank response windows.'
              : filteredEmpty
                ? 'No observed bank response windows match the products currently included in your settings.'
              : error ?? 'Preparing observed bank response windows…'}
          </AppText>
          {suitabilityWarming ? (
            <Button
              title="Retry preparation"
              variant="secondary"
              onPress={() => void ensureDetails({ force: true, abandonInFlight: true })}
            />
          ) : null}
          {error ? (
            <Button
              title="Retry"
              icon="refresh"
              loading={retrying}
              onPress={retryInsights}
            />
          ) : null}
        </Card>
        </ScreenContent>
      </Screen>
    );
  }

  return (
    <Screen>
      {rawPayload && error ? (
        <View
          style={{ paddingHorizontal: 16, paddingTop: 12 }}
          testID="bank-response-cached-error"
        >
          <Card variant="outlined" style={{ gap: 8 }}>
            <AppText accessibilityRole="alert" variant="small" weight="700">
              Showing saved Bank response data
            </AppText>
            <AppText variant="tiny" color="textMuted">
              The latest refresh failed. These observed results may be out of date.
            </AppText>
            <Button
              title="Retry Bank response data"
              icon="refresh"
              variant="secondary"
              loading={retrying}
              onPress={retryInsights}
            />
          </Card>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <BankResponseDashboard
          payload={payload}
          spreadHistory={trustedSpreadHistory}
          calendar={calendar}
          initialDecisionDate={decisionDate}
          initialSection={initialSection}
          spreadError={spreadError}
          onRetrySpread={() => void retryBankSpreadHistory()}
        />
      </View>
    </Screen>
  );
}
