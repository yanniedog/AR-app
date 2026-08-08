import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { TextInput, View } from 'react-native';

import { ScreenScrollView } from '../src/components/Screen';
import { AppText, Button, Card, Row } from '../src/components/ui';
import {
  DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS,
  getPerformanceAuditState,
  MAX_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS,
  MIN_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS,
  parsePerformanceAuditHangTimeoutSeconds,
  PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY,
  requestPerformanceAudit,
  selectReportedAuditChecks,
  subscribePerformanceAudit,
  type AuditCheck,
  type AuditCheckStatus,
} from '../src/lib/performanceAudit';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
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
    const background = Number(check.metrics.backgroundSettleMs ?? 0);
    const jsLag = Number(check.metrics.maxEventLoopLagMs ?? 0);
    const animationGap = Number(check.metrics.maxFrameGapMs ?? 0);
    const parts = [`Open ${forward.toFixed(0)} ms`, `Back ${back.toFixed(0)} ms`];
    if (background > 0) parts.push(`Background ${background.toFixed(0)} ms`);
    if (jsLag > 0) parts.push(`Max JS lag ${jsLag.toFixed(0)} ms`);
    if (animationGap > 0) parts.push(`JS animation gap ${animationGap.toFixed(0)} ms`);
    return parts.join(' · ');
  }
  if (check.id === 'active-data') {
    return `Parse ${Number(check.metrics.parseMs ?? 0).toFixed(0)} ms · ${Number(check.metrics.rateRows ?? 0).toLocaleString()} rate rows`;
  }
  if (check.id === 'manifest-network') {
    return `${check.durationMs.toFixed(0)} ms · HTTP ${check.metrics.statusCode ?? '—'}`;
  }
  if (check.id.startsWith('section-model-')) {
    return [
      `Rows ${Number(check.metrics.rows ?? 0).toLocaleString()}`,
      `Hierarchy ${Number(check.metrics.firstHierarchyMs ?? 0).toFixed(0)} ms`,
      `Stats ${Number(check.metrics.firstStatsMs ?? 0).toFixed(0)} ms`,
      `Rank ${Number(check.metrics.firstRankMs ?? 0).toFixed(0)} ms`,
    ].join(' · ');
  }
  if (check.id === 'debug-log-io') {
    return `Flush ${Number(check.metrics.flushMs ?? 0).toFixed(0)} ms · Read ${Number(check.metrics.readMs ?? 0).toFixed(0)} ms · ${Number(check.metrics.bytes ?? 0).toLocaleString()} bytes`;
  }
  if (check.id === 'update-readiness') {
    return `${check.metrics.checkStatus ?? 'unknown'} · installed ${check.metrics.installedVersion ?? '?'} (${check.metrics.installedBuild ?? '?'}) · cache ${check.metrics.downloadPhase ?? 'unknown'}`;
  }
  if (check.id === 'runtime-responsiveness') {
    return `Max JS lag ${Number(check.metrics.maxEventLoopLagMs ?? 0).toFixed(0)} ms · JS animation callback gap ${Number(check.metrics.maxFrameGapMs ?? 0).toFixed(0)} ms`;
  }
  return `${check.durationMs.toFixed(0)} ms`;
}

export default function PerformanceAuditScreen() {
  const theme = useTheme();
  const state = usePerformanceAuditState();
  const [hangTimeoutInput, setHangTimeoutInput] = useState(
    String(DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS / 1_000),
  );
  const [hangTimeoutLoaded, setHangTimeoutLoaded] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const report = state.report;
  const reportedChecks = useMemo(
    () => (report ? selectReportedAuditChecks(report.checks) : []),
    [report],
  );
  const running = state.status === 'queued' || state.status === 'running';
  const hangTimeoutSeconds = parsePerformanceAuditHangTimeoutSeconds(hangTimeoutInput);
  const auditActions = useMemo(() => ({
    'audit.pass.complete': () => ({
      status: state.status,
      storedCheckCount: state.storedCheckCount,
      lastStoredCheckAt: state.lastStoredCheckAt,
    }),
  }), [state.lastStoredCheckAt, state.status, state.storedCheckCount]);
  usePerformanceAuditSurface({
    id: 'audit.progress',
    routeKey: '/performance-audit',
    renderRevision: `${state.status}:${state.storedCheckCount}:${state.lastStoredCheckAt ?? ''}`,
    actions: auditActions,
    probes: [
      {
        id: 'audit.state',
        kind: 'data',
        status: state.status === 'queued' ? 'pending' : 'ready',
      },
      {
        id: 'audit.log-buffer',
        kind: 'list',
        status: 'ready',
        expectedCount: state.storedCheckCount,
        actualCount: state.storedCheckCount,
      },
      {
        id: 'audit.layout',
        kind: 'layout',
        status: layoutReady && hangTimeoutLoaded ? 'ready' : 'pending',
      },
    ],
  });

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        const parsed = parsePerformanceAuditHangTimeoutSeconds(stored);
        setHangTimeoutInput(
          String(parsed ?? DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS / 1_000),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHangTimeoutLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hangTimeoutLoaded || hangTimeoutSeconds == null) return;
    void AsyncStorage.setItem(
      PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY,
      String(hangTimeoutSeconds),
    ).catch(() => {});
  }, [hangTimeoutLoaded, hangTimeoutSeconds]);

  const runAudit = () => {
    if (!hangTimeoutLoaded || hangTimeoutSeconds == null) return;
    requestPerformanceAudit({ hangTimeoutMs: hangTimeoutSeconds * 1_000 });
  };

  const summaryColor = report
    ? report.summary.overall === 'healthy'
      ? theme.colors.success
      : report.summary.overall === 'attention'
        ? theme.colors.warning
        : theme.colors.danger
    : theme.colors.textMuted;

  return (
    <ScreenScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
      onLayout={() => setLayoutReady(true)}
    >
      <Card style={{ gap: 12 }}>
        <AppText variant="h2">Full responsiveness diagnosis</AppText>
        <AppText variant="small" color="textMuted">
          One tap repeats every screen cold and warm, then tests section models, responsiveness,
          storage, payload processing, network and Android update readiness. When complete, the
          full on-disk log uploads and its link is copied automatically.
        </AppText>
        <AppText variant="tiny" color="textMuted">
          The screen stays awake during visual checks; leaving the app cancels the run safely.
        </AppText>
        <View style={{ gap: 6 }}>
          <AppText variant="small" weight="700">
            Hang prevention timeout
          </AppText>
          <Row style={{ alignItems: 'center' }} gap={8}>
            <TextInput
              accessibilityLabel="Audit hang prevention timeout in seconds"
              accessibilityHint={`Enter a value from ${MIN_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS} to ${MAX_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS} seconds`}
              value={hangTimeoutInput}
              onChangeText={setHangTimeoutInput}
              editable={!running}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={4}
              selectTextOnFocus
              style={{
                minWidth: 112,
                minHeight: 48,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor:
                  hangTimeoutSeconds == null
                    ? theme.colors.danger
                    : theme.colors.border,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surfaceAlt,
                color: theme.colors.text,
                fontSize: theme.font.body,
              }}
            />
            <AppText variant="small" color="textMuted">
              seconds
            </AppText>
          </Row>
          <AppText
            variant="tiny"
            color={hangTimeoutSeconds == null ? 'danger' : 'textFaint'}
          >
            {hangTimeoutSeconds == null
              ? `Enter a whole number from ${MIN_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS} to ${MAX_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS}.`
              : 'The timer restarts only after a completed check is saved to the debug log.'}
          </AppText>
        </View>
        <Button
          title={report ? 'Run audit again' : 'Run full audit'}
          icon="pulse-outline"
          loading={running}
          disabled={!hangTimeoutLoaded || hangTimeoutSeconds == null}
          onPress={runAudit}
        />
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
          <AppText variant="tiny" color="textMuted">
            Saved {state.storedCheckCount} checks
            {state.lastStoredCheckAt ? `; last progress ${state.lastStoredCheckAt}` : ''}.
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
            <AppText variant="small" color="textMuted">
              Hang timeout {(report.watchdog.hangTimeoutMs / 1_000).toFixed(0)} s; saved{' '}
              {report.watchdog.storedCheckCount} checks
            </AppText>
            <AppText variant="small" color="textMuted">
              App v{report.environment.appVersion} (build {report.environment.buildVersion})
            </AppText>
            <AppText variant="small" color={state.uploadUrl ? 'success' : 'textMuted'}>
              {state.uploadUrl
                ? `Full log uploaded via ${state.uploadProvider}; link copied to clipboard.`
                : state.uploadPending
                  ? 'Uploading the full log and copying its link...'
                  : `Automatic log upload failed${state.uploadError ? `: ${state.uploadError}` : '.'}`}
            </AppText>
          </Card>

          {report.routeAggregates.length > 0 ? (
            <View style={{ gap: 8 }}>
              <AppText variant="tiny" weight="700" color="textFaint" style={{ marginLeft: 4 }}>
                COLD VS WARM ROUTES
              </AppText>
              {report.routeAggregates.map((route) => (
                <Card key={route.journeyId} style={{ gap: 4 }}>
                  <AppText variant="small" weight="700">{route.label}</AppText>
                  <AppText variant="tiny" color="textFaint">
                    Open {route.coldForwardMs.toFixed(0)} → {route.warmForwardMs.toFixed(0)} ms
                    {' · '}Back {route.coldBackMs.toFixed(0)} → {route.warmBackMs.toFixed(0)} ms
                  </AppText>
                </Card>
              ))}
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <AppText variant="tiny" weight="700" color="textFaint" style={{ marginLeft: 4 }}>
              CHECK RESULTS
            </AppText>
            {reportedChecks.length < report.checks.length ? (
              <AppText variant="tiny" color="textFaint" style={{ marginLeft: 4 }}>
                Showing every failure, warning and skip plus the slowest passes (
                {reportedChecks.length} of {report.checks.length}). The uploaded log holds
                the complete report.
              </AppText>
            ) : null}
            {reportedChecks.map((check) => {
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
        </>
      ) : null}
    </ScreenScrollView>
  );
}
