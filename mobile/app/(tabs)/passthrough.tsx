import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { PassThroughDashboard } from '../../src/components/passthrough/PassThroughDashboard';
import { AppText, Button, Card } from '../../src/components/ui';
import { useStore } from '../../src/data/store';
import { scalarRouteParam } from '../../src/lib/nav';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ScreenSkeleton } from '../../src/components/feedback';

export default function PassThroughTab() {
  const theme = useTheme();
  const core = useStore((state) => state.core);
  const calendar = useStore((state) => state.rbaCalendar);
  const payload = useStore((state) => state.bankInsights);
  const error = useStore((state) => state.bankInsightsError);
  const ensureBankInsights = useStore((state) => state.ensureBankInsights);
  const retryBankInsights = useStore((state) => state.retryBankInsights);
  const ensureRbaCalendar = useStore((state) => state.ensureRbaCalendar);
  const [retrying, setRetrying] = useState(false);
  const { date: decisionDateRaw } = useLocalSearchParams<{ date?: string | string[] }>();
  const decisionDate = scalarRouteParam(decisionDateRaw);

  useEffect(() => {
    if (!core) return;
    void ensureBankInsights();
    void ensureRbaCalendar();
  }, [core, ensureBankInsights, ensureRbaCalendar]);

  if (!core) return <ScreenSkeleton />;

  if (!payload) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.bg,
          padding: 24,
        }}
      >
        {error ? (
          <Card style={{ width: '100%', maxWidth: 520 }}>
            <AppText variant="h3">Bank response data unavailable</AppText>
            <AppText variant="small" color="textMuted" style={{ marginTop: 6, marginBottom: 14 }}>
              {error}
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
          <View style={{ alignItems: 'center', gap: 12 }} accessibilityRole="progressbar">
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <AppText variant="small" color="textMuted">Preparing bank response analysis…</AppText>
          </View>
        )}
      </View>
    );
  }

  return (
    <PassThroughDashboard
      payload={payload}
      rba={core.rba}
      calendar={calendar}
      initialDecisionDate={decisionDate}
    />
  );
}
