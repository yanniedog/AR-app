import { router } from 'expo-router';
import React, { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { ScreenScrollView } from '../src/components/Screen';
import { AppText, Button, Card, Row } from '../src/components/ui';
import {
  getPerformanceAuditState,
  requestPerformanceAudit,
  subscribePerformanceAudit,
  type AuditCheck,
  type AuditCheckStatus,
} from '../src/lib/performanceAudit';
import { useTheme } from '../src/theme/ThemeProvider';

function usePerformanceAuditState() {
  return useSyncExternalStore(
    subscribePerformanceAudit,
    getPerformanceAuditState,
    getPerformanceAuditState,
  );
}

function statusLabel(status: AuditCheckStatus): string {
  if (status === 'pass') return 'Good';
  if (status === 'warn') return 'Slow';
  if (status === 'fail') return 'Bottleneck';
  return 'Skipped';
}

function checkDetail(check: AuditCheck): string {
  if (check.kind === 'journey') {
    const forward = Number(check.metrics.forwardMs ?? 0);
    const back = Number(check.metrics.backMs ?? 0);
    return `Open ${forward.toFixed(0)} ms · Back ${back.toFixed(0)} ms`;
  }
  if (check.id === 'active-data') {
    return `Parse ${Number(check.metrics.parseMs ?? 0).toFixed(0)} ms · ${Number(check.metrics.rateRows ?? 0).toLocaleString()} rate rows`;
  }
  if (check.id === 'manifest-network') {
    return `${check.durationMs.toFixed(0)} ms · HTTP ${check.metrics.statusCode ?? '—'}`;
  }
  if (check.id === 'runtime-responsiveness') {
    return `Max JS lag ${Number(check.metrics.maxEventLoopLagMs ?? 0).toFixed(0)} ms · Max frame gap ${Number(check.metrics.maxFrameGapMs ?? 0).toFixed(0)} ms`;
  }
  return `${check.durationMs.toFixed(0)} ms`;
}

export default function PerformanceAuditScreen() {
  const theme = useTheme();
  const state = usePerformanceAuditState();
  const [confirming, setConfirming] = useState(false);
  const report = state.report;
  const running = state.status === 'queued' || state.status === 'running';

  const runAudit = () => {
    setConfirming(true);
  };

  const summaryColor = report
    ? report.summary.overall === 'healthy'
      ? theme.colors.success
      : report.summary.overall === 'attention'
        ? theme.colors.warning
        : theme.colors.danger
    : theme.colors.textMuted;

  return (
    <ScreenScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
      <Card style={{ gap: 12 }}>
        <AppText variant="h2">Full responsiveness diagnosis</AppText>
        <AppText variant="small" color="textMuted">
          Runs real forward-and-back journeys through Home, every rate section, Response,
          Outlook, Watchlist, Settings, search, calculators, lender and product details,
          comparison, terms, and the debug log.
        </AppText>
        <AppText variant="small" color="textMuted">
          It also measures JS event-loop stalls, frame gaps, active-payload parsing,
          preferences storage, log-file storage, and the live manifest request. Every result,
          scheduling trace, and error stack is embedded as structured data in the debug log.
        </AppText>
        <View
          style={{
            padding: 10,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primaryMuted,
          }}
        >
          <AppText variant="tiny" color="textMuted">
            Local by default. Nothing is uploaded automatically. Review and explicitly share
            the debug log when you want performance feedback.
          </AppText>
        </View>
        <Button
          title={report ? 'Run audit again' : 'Run full audit'}
          icon="pulse-outline"
          loading={running}
          onPress={runAudit}
        />
        {confirming && !running ? (
          <View
            style={{
              gap: 10,
              padding: 12,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.warning,
              backgroundColor: theme.colors.chip,
            }}
          >
            <AppText variant="small" weight="700">
              Ready for automated navigation?
            </AppText>
            <AppText variant="tiny" color="textMuted">
              For about a minute, the app will open every steady-state screen and go back
              after each one. Do not interact while it runs. You can cancel at any time. It
              does not change favourites, profile settings, or subscriptions.
            </AppText>
            <Row gap={8}>
              <Button
                title="Not now"
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() => setConfirming(false)}
              />
              <Button
                title="Start audit"
                icon="play"
                style={{ flex: 1 }}
                onPress={() => {
                  setConfirming(false);
                  requestPerformanceAudit();
                }}
              />
            </Row>
          </View>
        ) : null}
      </Card>

      {state.status === 'cancelled' ? (
        <Card style={{ gap: 6 }}>
          <AppText variant="body" weight="700">
            Audit cancelled
          </AppText>
          <AppText variant="small" color="textMuted">
            Completed results remain in the debug log. You can start again when convenient.
          </AppText>
        </Card>
      ) : null}

      {state.status === 'failed' ? (
        <Card style={{ gap: 8, borderWidth: 1, borderColor: theme.colors.danger }}>
          <AppText variant="body" weight="700" style={{ color: theme.colors.danger }}>
            Audit runner failed
          </AppText>
          <AppText variant="tiny" selectable style={{ fontFamily: 'monospace' }}>
            {state.error}
          </AppText>
        </Card>
      ) : null}

      {report ? (
        <>
          <Card style={{ gap: 10, borderWidth: 1, borderColor: summaryColor }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <AppText variant="h3">Diagnosis</AppText>
              <AppText variant="body" weight="700" style={{ color: summaryColor }}>
                {report.summary.overall === 'healthy'
                  ? 'Responsive'
                  : report.summary.overall === 'attention'
                    ? 'Needs attention'
                    : 'Bottleneck found'}
              </AppText>
            </Row>
            <AppText variant="small" color="textMuted">
              {report.summary.pass} good · {report.summary.warn} slow · {report.summary.fail}{' '}
              bottlenecks · {report.summary.skipped} skipped
            </AppText>
            <AppText variant="small" color="textMuted">
              Slowest: {report.summary.slowestCheckLabel ?? '—'} (
              {report.summary.slowestCheckMs.toFixed(0)} ms)
            </AppText>
            <AppText variant="small" color="textMuted">
              Worst JS lag {report.summary.maxEventLoopLagMs.toFixed(0)} ms · Worst frame gap{' '}
              {report.summary.maxFrameGapMs.toFixed(0)} ms · Total{' '}
              {(report.durationMs / 1_000).toFixed(1)} s
            </AppText>
            <Button
              title="Open logs to export"
              icon="share-outline"
              variant="secondary"
              onPress={() => router.push('/debug-log')}
            />
          </Card>

          <View style={{ gap: 8 }}>
            <AppText variant="tiny" weight="700" color="textFaint" style={{ marginLeft: 4 }}>
              CHECK RESULTS
            </AppText>
            {report.checks.map((check) => {
              const color =
                check.status === 'pass'
                  ? theme.colors.success
                  : check.status === 'warn'
                    ? theme.colors.warning
                    : check.status === 'fail'
                      ? theme.colors.danger
                      : theme.colors.textFaint;
              return (
                <Card key={check.id} style={{ gap: 4 }}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <AppText variant="small" weight="700" style={{ flex: 1, paddingRight: 8 }}>
                      {check.label}
                    </AppText>
                    <AppText variant="tiny" weight="700" style={{ color }}>
                      {statusLabel(check.status)}
                    </AppText>
                  </Row>
                  <AppText variant="tiny" color="textFaint">
                    {checkDetail(check)}
                  </AppText>
                  {check.error ? (
                    <AppText variant="tiny" color="textMuted" numberOfLines={3}>
                      {check.error}
                    </AppText>
                  ) : null}
                </Card>
              );
            })}
          </View>

          <Card style={{ gap: 6 }}>
            <AppText variant="small" weight="700">
              Trace boundary
            </AppText>
            <AppText variant="tiny" color="textFaint">
              The exported log contains full JavaScript scheduling and error stacks. Native
              CPU/GPU instruction stacks still require an Android or iOS sampling profiler;
              the report says this explicitly so results are not overstated.
            </AppText>
          </Card>
        </>
      ) : null}
    </ScreenScrollView>
  );
}
