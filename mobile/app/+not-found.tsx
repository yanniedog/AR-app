import { router, Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../src/components/ui';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useTheme } from '../src/theme/ThemeProvider';

export default function NotFound() {
  const theme = useTheme();
  const [layoutReady, setLayoutReady] = useState(false);
  const goHome = useCallback(() => router.replace('/(tabs)'), []);
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
      <Stack.Screen options={{ title: 'Not found' }} />
      <View
        onLayout={() => setLayoutReady(true)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.colors.bg }}
      >
        <AppText variant="h2">This screen doesn&apos;t exist</AppText>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Go to Home"
          onPress={goHome}
          style={{ marginTop: 16 }}
        >
          <AppText variant="body" style={{ color: theme.colors.primary }} weight="700">
            Go to Home
          </AppText>
        </Pressable>
      </View>
    </>
  );
}
