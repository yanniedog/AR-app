import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { PassThroughDashboard } from '../src/components/passthrough/PassThroughDashboard';
import { ScreenSkeleton } from '../src/components/feedback';
import { AppText, Button, Card } from '../src/components/ui';
import { filterBankInsightsForSuitability } from '../src/data/bankInsights';
import { useStore } from '../src/data/store';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { scalarRouteParam } from '../src/lib/nav';
import { useTheme } from '../src/theme/ThemeProvider';

export default function RbaResponseScreen() {
  const theme = useTheme();
  const core = useStore((state) => state.core);
  const calendar = useStore((state) => state.rbaCalendar);
  const rawPayload = useStore((state) => state.bankInsights);
  const error = useStore((state) => state.bankInsightsError);
  const detailsProducts = useStore((state) => state.details?.products ?? null);
  const includeNonStandard = useStore((state) => state.prefs.includeNonStandard);
  const ensureBankInsights = useStore((state) => state.ensureBankInsights);
  const retryBankInsights = useStore((state) => state.retryBankInsights);
  const ensureRbaCalendar = useStore((state) => state.ensureRbaCalendar);
  const activeSection = useStore((state) => state.activeSection);
  const setActiveSection = useStore((state) => state.setActiveSection);
  const suitabilityRevision = useSuitabilityRevision();
  const [retrying, setRetrying] = useState(false);
  const { date: decisionDateRaw } = useLocalSearchParams<{ date?: string | string[] }>();
  const decisionDate = scalarRouteParam(decisionDateRaw);

  useEffect(() => {
    if (!core) return;
    void ensureBankInsights();
    void ensureRbaCalendar();
  }, [core, ensureBankInsights, ensureRbaCalendar]);

  const payload = useMemo(() => {
    void suitabilityRevision;
    return filterBankInsightsForSuitability(rawPayload, core, includeNonStandard, detailsProducts);
  }, [core, detailsProducts, includeNonStandard, rawPayload, suitabilityRevision]);

  if (!core) return <ScreenSkeleton />;
  if (!payload) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.colors.bg, padding: 24 }}>
        <Card variant="outlined" style={{ gap: 12 }}>
          <AppText variant="h3">RBA response analysis unavailable</AppText>
          <AppText variant="small" color="textMuted">
            {error ?? 'Preparing the observed lender response windows…'}
          </AppText>
          {error ? (
            <Button
              title="Retry"
              icon="refresh"
              loading={retrying}
              onPress={() => {
                setRetrying(true);
                void retryBankInsights().finally(() => setRetrying(false));
              }}
            />
          ) : null}
        </Card>
      </View>
    );
  }

  return (
    <PassThroughDashboard
      payload={payload}
      rba={core.rba}
      calendar={calendar}
      initialDecisionDate={decisionDate}
      section={activeSection}
      onSectionChange={setActiveSection}
    />
  );
}
