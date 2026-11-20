import { uiLabel } from '../lib/uiCopy';
import React, { memo, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuditScreenAwake } from '../../modules/audit-screen-awake';
import { cancelPerformanceAudit, getPerformanceAuditState, pausePerformanceAudit, resumePerformanceAudit } from '../lib/performanceAudit';
import { uiCount, uiDurationClock, uiJoin } from '../lib/uiCopy';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Card, Row } from './ui';

/** Route changes update the runner's path ref without reconciling its progress UI. */
export const PerformanceAuditOverlay = memo(function PerformanceAuditOverlay({ state }: {
  state: ReturnType<typeof getPerformanceAuditState>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const live = state.status === 'queued' || state.status === 'running';
  const [now, setNow] = useState(() => Date.now());
  const pausedMs = useRef(0);
  const pausedAt = useRef<number | null>(null);
  useEffect(() => {
    pausedMs.current = 0;
    pausedAt.current = null;
  }, [state.startedAt]);
  useEffect(() => {
    if (state.paused) {
      if (pausedAt.current == null) pausedAt.current = Date.now();
    } else if (pausedAt.current != null) {
      pausedMs.current += Date.now() - pausedAt.current;
      pausedAt.current = null;
    }
  }, [state.paused]);
  useEffect(() => {
    if (!live || state.paused) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [live, state.paused]);
  if (state.status !== 'queued' && state.status !== 'running') return null;

  const total = Math.max(1, state.progress.total);
  const fraction = Math.max(0, Math.min(1, state.progress.completed / total));
  const percent = Math.round(fraction * 100);
  const startedMs = state.startedAt ? Date.parse(state.startedAt) : NaN;
  const elapsed = Number.isFinite(startedMs) ? uiDurationClock(Math.max(0, (pausedAt.current ?? now) - startedMs - pausedMs.current)) : uiLabel('Unknown');
  const estimate = state.estimate ? uiDurationClock(state.estimate.remainingMs) : null;

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
          <AppText variant="body" weight="700">{uiLabel("App health audit")}</AppText>
          <AppText variant="small" weight="700" color="primary">
            {uiJoin(uiCount(percent), '%')}
          </AppText>
        </Row>
        <AppText variant="small" color="textMuted" accessibilityLiveRegion="polite">
          {state.paused ? uiLabel('Paused') : estimate ? uiJoin('Estimated time', ': ', estimate) : uiLabel('Preparing')}
        </AppText>
        <AppText variant="small" color="textMuted">{uiLabel(state.paused ? 'Paused' : state.progress.label.startsWith('Background work:') ? 'Background checks' : 'Checking')}</AppText>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="small" color="textMuted">{uiJoin('Elapsed', ': ', elapsed)}</AppText>
          <AppText variant="small" color="textMuted">
            {uiJoin('Checks', ' ', uiCount(state.progress.completed), ' / ', uiCount(state.progress.total))}
          </AppText>
        </Row>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="App health audit"
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
            {uiJoin(uiCount(state.progress.completed), ' / ', state.progress.total ? uiCount(state.progress.total) : 'Unknown', ' ', 'Checks')}
          </AppText>
          <Row style={{ gap: 4 }}>
          <Button
            title={state.paused ? 'Resume' : 'Pause'}
            variant="ghost"
            disabled={state.cancelRequested}
            onPress={() => (state.paused ? resumePerformanceAudit() : pausePerformanceAudit())}
            style={{ paddingVertical: 8 }}
          />
          <Button
            title={state.cancelRequested ? 'Cancelling' : 'Cancel'}
            icon="close"
            variant="ghost"
            disabled={state.cancelRequested}
            onPress={cancelPerformanceAudit}
            style={{ paddingVertical: 8 }}
          />
          </Row>
        </Row>
      </Card>
    </View>
  );
});
