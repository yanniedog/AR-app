import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { InsightsLockedCard } from '../../src/components/BankInsights';
import { PassThroughDashboard } from '../../src/components/passthrough/PassThroughDashboard';
import { ProPaywall } from '../../src/components/ProPaywall';
import { AppText, Button, Card } from '../../src/components/ui';
import { useStore } from '../../src/data/store';
import { useProPaywall } from '../../src/hooks/useProPaywall';
import { effectiveBankInsights } from '../../src/lib/proAccess';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function PassThroughTab() {
  const theme = useTheme();
  const core = useStore((state) => state.core);
  const calendar = useStore((state) => state.rbaCalendar);
  const payload = useStore((state) => state.bankInsights);
  const error = useStore((state) => state.bankInsightsError);
  const enabled = useStore((state) => effectiveBankInsights(state.prefs));
  const ensureBankInsights = useStore((state) => state.ensureBankInsights);
  const retryBankInsights = useStore((state) => state.retryBankInsights);
  const ensureRbaCalendar = useStore((state) => state.ensureRbaCalendar);
  const { paywallVisible, paywallIntent, requestPro, closePaywall } = useProPaywall();
  const [retrying, setRetrying] = useState(false);
  const { date: decisionDate } = useLocalSearchParams<{ date?: string }>();

  useEffect(() => {
    if (!enabled || !core) return;
    void ensureBankInsights();
    void ensureRbaCalendar();
  }, [enabled, core, ensureBankInsights, ensureRbaCalendar]);

  if (!core) return null;

  if (!enabled) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, padding: 16 }}>
        <Card>
          <InsightsLockedCard onUnlock={() => requestPro('bank_insights')} />
        </Card>
        <ProPaywall visible={paywallVisible} intent={paywallIntent} onClose={closePaywall} />
      </View>
    );
  }

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
