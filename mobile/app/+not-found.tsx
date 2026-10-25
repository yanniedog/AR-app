import { uiLabel } from "../src/lib/uiCopy";
import { router, Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../src/components/ui';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useTheme } from '../src/theme/ThemeProvider';

export default function NotFound() {
  const theme = useTheme();
  const [layoutReady, setLayoutReady] = useState(false);
  const goHome = useCallback(() => {
    // Prefer dismissTo so an existing Rates tab can reuse frozen state instead of
    // rebuilding the destination under a full stack replace.
    if (typeof router.dismissTo === 'function') {
      router.dismissTo('/(tabs)/browse');
      return;
    }
    router.replace('/(tabs)/browse');
  }, []);
  const auditActions = useMemo(() => ({
    'not-found.open': () => undefined,
    'not-found.home': goHome,
  }), [goHome]);
  usePerformanceAuditSurface({
    id: 'not-found.recovery',
    routeKey: '/__audit-not-found__',
    renderRevision: 'not-found-v1',
    actions: auditActions,
    probes: [
      { id: 'not-found.local-state', kind: 'data', status: 'ready' },
      {
        id: 'not-found.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
      },
    ],
  });
  return (
    <>
      <Stack.Screen options={{ title: uiLabel('Screen unavailable') }} />
      <View
        onLayout={() => setLayoutReady(true)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.colors.bg }}
      >
        <AppText variant="h2">{uiLabel("Screen unavailable")}</AppText>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Rates"
          onPress={goHome}
          style={{ marginTop: 16 }}
        >
          <AppText variant="body" style={{ color: theme.colors.primary }} weight="700">{uiLabel("Rates")}</AppText>
        </Pressable>
      </View>
    </>
  );
}
