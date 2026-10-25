import { uiLabel } from "../src/lib/uiCopy";
import { BankRatesPanel } from '../src/components/passthrough/BankRatesPanel';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { BankResponseDashboard } from '../src/components/passthrough/BankResponseDashboard';
import { ScreenSkeleton } from '../src/components/feedback';
import { Screen, ScreenContent } from '../src/components/Screen';
import { AppText, Button, Card } from '../src/components/ui';
import { filterBankInsightsForSuitability } from '../src/data/bankInsights';
import { useStore } from '../src/data/store';
import { isSuitabilityFilterReady } from '../src/data/suitabilityGate';
import { useNavigationContentReady } from '../src/hooks/useNavigationContentReady';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { scalarRouteParam } from '../src/lib/nav';

export default function RbaResponseScreen() {
  const contentReady = useNavigationContentReady(true);
  const core = useStore((state) => state.core);
  const coreIntegrity = useStore((state) => state.coreIntegrity);
  const calendar = useStore((state) => state.rbaCalendar);
  const rawPayload = useStore((state) => state.bankInsights);
  const error = useStore((state) => state.bankInsightsError);
  const detailsProducts = useStore((state) => state.details?.products ?? null);
  const includeNonStandard = useStore((state) => state.prefs.includeNonStandard);
  const ensureBankInsights = useStore((state) => state.ensureBankInsights);
  const retryBankInsights = useStore((state) => state.retryBankInsights);
  const ensureDetails = useStore((state) => state.ensureDetails);
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
    if (!core || !contentReady) return;
    void ensureBankInsights();
  }, [contentReady, core, ensureBankInsights]);

  const suitabilityReady = useMemo(() => {
    void suitabilityRevision;
    return isSuitabilityFilterReady(includeNonStandard);
  }, [includeNonStandard, suitabilityRevision]);

  useEffect(() => {
    if (!contentReady || !core || includeNonStandard || isSuitabilityFilterReady(includeNonStandard)) return;
    void ensureDetails({ force: true });
  }, [contentReady, core, ensureDetails, includeNonStandard]);

  const payload = useMemo(() => {
    if (!contentReady) return null;
    void suitabilityRevision;
    return filterBankInsightsForSuitability(rawPayload, core, includeNonStandard, detailsProducts, suitabilityRevision, coreIntegrity);
  }, [contentReady, core, coreIntegrity, detailsProducts, includeNonStandard, rawPayload, suitabilityRevision]);
  const retryInsights = () => {
    setRetrying(true);
    void retryBankInsights().finally(() => setRetrying(false));
  };

  if (!core || !contentReady) {
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
        <ScrollView><ScreenContent>
        {suitabilityWarming ? null : <BankRatesPanel section={initialSection} />}
        <Card variant="outlined" style={{ gap: 12 }}>
          <AppText variant="h3">
            {suitabilityWarming
              ? uiLabel("Loading")
              : filteredEmpty
                ? uiLabel("No compatible observations")
                : uiLabel("Observations unavailable")}
          </AppText>
          {suitabilityWarming ? (
            <Button
              title="Retry"
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
        </ScreenContent></ScrollView>
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
            <AppText accessibilityRole="alert" variant="small" weight="700">{uiLabel("Cached observations")}</AppText>
            <AppText variant="tiny" color="textMuted">{uiLabel("Refresh failed · Older observations")}</AppText>
            <Button
              title="Retry"
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
          calendar={calendar}
          initialDecisionDate={decisionDate}
          initialSection={initialSection}
        />
      </View>
    </Screen>
  );
}
