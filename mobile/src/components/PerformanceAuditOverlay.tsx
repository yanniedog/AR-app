import React, { memo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuditScreenAwake } from '../../modules/audit-screen-awake';
import { cancelPerformanceAudit, getPerformanceAuditState } from '../lib/performanceAudit';
import { formatPerformanceAuditEstimate } from '../lib/performanceAuditTiming';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Card, Row } from './ui';

/** Route changes update the runner's path ref without reconciling its progress UI. */
export const PerformanceAuditOverlay = memo(function PerformanceAuditOverlay({ state }: {
  state: ReturnType<typeof getPerformanceAuditState>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (state.status !== 'queued' && state.status !== 'running') return null;

  const total = Math.max(1, state.progress.total);
  const fraction = Math.max(0, Math.min(1, state.progress.completed / total));
  const percent = Math.round(fraction * 100);

  return (
    <View
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 500,
        elevation: 500,
        backgroundColor: 'rgba(3, 10, 18, 0.42)',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingBottom: Math.max(16, insets.bottom + 12),
      }}
    >
      <AuditScreenAwake />
      <Card variant="elevated" style={{ gap: 12, borderWidth: 1, borderColor: theme.colors.border }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <AppText variant="body" weight="700">
            App health audit
          </AppText>
          <AppText variant="small" weight="700" color="primary">
            {percent}%
          </AppText>
        </Row>
        <AppText variant="small" color="textMuted" accessibilityLiveRegion="polite">
          {formatPerformanceAuditEstimate(state.estimate, state.paused)}
        </AppText>
        {!state.paused && state.progress.label.startsWith('Background work:') ? (
          <ScrollView style={{ maxHeight: 180 }}>
            <AppText variant="small" color="textMuted">{state.progress.label}</AppText>
          </ScrollView>
        ) : (
          <AppText variant="small" color="textMuted" numberOfLines={2}>
            {state.paused ? 'Paused — the audit continues when you return' : state.progress.label}
          </AppText>
        )}
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="App health audit progress"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          style={{
            height: 8,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.chip,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${percent}%`,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primary,
            }}
          />
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="tiny" color="textFaint">
            {state.progress.completed} of {state.progress.total || '...'} checks
          </AppText>
          <Button
            title={state.cancelRequested ? 'Cancelling...' : 'Cancel audit'}
            icon="close"
            variant="ghost"
            disabled={state.cancelRequested}
            onPress={cancelPerformanceAudit}
            style={{ paddingVertical: 8 }}
          />
        </Row>
      </Card>
    </View>
  );
});
