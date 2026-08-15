import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, Share, TextInput, View } from 'react-native';

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
  MAX_REPORTED_AUDIT_CHECKS,
  subscribePerformanceAudit,
  type AuditCheck,
} from '../src/lib/performanceAudit';
import { createDeidentifiedDiagnosticsShare } from '../src/lib/diagnosticsEnvelope';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useTheme } from '../src/theme/ThemeProvider';

function usePerformanceAuditState() {
  return useSyncExternalStore(
    subscribePerformanceAudit,
    getPerformanceAuditState,
    getPerformanceAuditState,
  );
}

function statusLabel(check: AuditCheck): string {
  if (check.metrics.availabilityFailure === true || check.metrics.executionAttempted === false) {
    return 'Unavailable';
  }
  if (check.status === 'pass') return 'Good';
  if (check.status === 'warn') return 'Slow';
  if (check.status === 'fail') return 'Bottleneck';
  return 'Interrupted';
}

function metricNumber(check: AuditCheck, key: string): number | null {
  const value = check.metrics[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (
    value === 0 &&
    check.metrics.executionAttempted !== true &&
    check.metrics.measurementAvailable !== true
  ) return null;
  return value;
}

function checkDuration(check: AuditCheck): number | null {
  if (check.durationMs == null || !Number.isFinite(check.durationMs)) return null;
  if (check.durationMs !== 0) return check.durationMs;
  return check.metrics.executionAttempted === true || check.metrics.measurementAvailable === true
    ? 0
    : null;
}

function metricDuration(check: AuditCheck, key: string, label: string): string {
  const value = metricNumber(check, key);
  if (value == null) return `${label} not measured`;
  return value === 0 ? `${label} <0.1 ms (measured)` : `${label} ${value.toFixed(1)} ms`;
}

function measuredMs(label: string, value: number | null): string {
  if (value == null) return `${label} not measured`;
  return value === 0 ? `${label} <0.1 ms (measured)` : `${label} ${value.toFixed(0)} ms`;
}

function checkDetail(check: AuditCheck): string {
  if (check.status === 'skipped') {
    const reason = String(check.metrics.reason ?? 'No timing was recorded');
    return `Timing unavailable · ${reason}`;
  }
  if (check.kind === 'journey') {
    const measured = (key: string) => metricNumber(check, key);
    const forward = measured('forwardMs');
    const back = measured('backMs');
    const action = measured('actionMs');
    const background = measured('backgroundSettleMs');
    const jsLag = measured('maxEventLoopLagMs');
    const animationGap = measured('maxFrameGapMs');
    const isRoundTrip = check.metrics.measurementMode === 'route-round-trip';
    const parts: string[] = [];
    if (isRoundTrip) {
      parts.push(
        measuredMs('Open', forward),
        measuredMs('Back', back),
      );
    } else {
      parts.push(measuredMs('Action', action));
      if (forward != null) parts.push(measuredMs('Ready', forward));
    }
    if (background != null) parts.push(measuredMs('Background', background));
    if (jsLag != null) parts.push(measuredMs('Max JS lag', jsLag));
    if (animationGap != null) parts.push(measuredMs('JS animation gap', animationGap));
    return parts.join(' · ');
  }
  if (check.id === 'active-data') {
    const rows = metricNumber(check, 'rateRows');
    return `${metricDuration(check, 'parseMs', 'Parse')} · ${rows == null ? 'Rows not measured' : `${rows.toLocaleString()} rate rows`}`;
  }
  if (check.id === 'manifest-network') {
    return `${measuredMs('Request', checkDuration(check))} · HTTP ${check.metrics.statusCode ?? '—'}`;
  }
  if (check.id.startsWith('section-model-')) {
    const rows = metricNumber(check, 'rows');
    return [
      rows == null ? 'Rows not measured' : `Rows ${rows.toLocaleString()}`,
      metricDuration(check, 'firstHierarchyMs', 'Hierarchy'),
      metricDuration(check, 'firstStatsMs', 'Stats'),
      metricDuration(check, 'firstRankMs', 'Rank'),
    ].join(' · ');
  }
  if (check.id === 'debug-log-io') {
    const bytes = metricNumber(check, 'bytes');
    return `${metricDuration(check, 'flushMs', 'Flush')} · ${metricDuration(check, 'readMs', 'Read')} · ${bytes == null ? 'Bytes not measured' : `${bytes.toLocaleString()} bytes`}`;
  }
  if (check.id === 'update-readiness') {
    return `${check.metrics.checkStatus ?? 'unknown'} · installed ${check.metrics.installedVersion ?? '?'} (${check.metrics.installedBuild ?? '?'}) · cache ${check.metrics.downloadPhase ?? 'unknown'}`;
  }
  if (check.id === 'runtime-responsiveness') {
    return [
      measuredMs('Max JS lag', metricNumber(check, 'maxEventLoopLagMs')),
      measuredMs('JS animation callback gap', metricNumber(check, 'maxFrameGapMs')),
    ].join(' · ');
  }
  return measuredMs('Duration', checkDuration(check));
}

function PerformanceAuditScreenInner() {
  const theme = useTheme();
  const state = usePerformanceAuditState();
  const [hangTimeoutInput, setHangTimeoutInput] = useState(
    String(DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS / 1_000),
  );
  const [hangTimeoutLoaded, setHangTimeoutLoaded] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [sharingReport, setSharingReport] = useState(false);
  const [visibleCheckLimit, setVisibleCheckLimit] = useState(MAX_REPORTED_AUDIT_CHECKS);
  const report = state.report;
  const orderedChecks = useMemo(
    () => (report ? selectReportedAuditChecks(report.checks) : []),
    [report],
  );
  const reportedChecks = orderedChecks.slice(0, visibleCheckLimit);
  useEffect(() => {
    setVisibleCheckLimit(MAX_REPORTED_AUDIT_CHECKS);
  }, [report?.sessionId]);
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
  const confirmShareReport = () => {
    if (!report || sharingReport) return;
    let prepared: ReturnType<typeof createDeidentifiedDiagnosticsShare>;
    try {
      prepared = createDeidentifiedDiagnosticsShare(report);
    } catch (error) {
      Alert.alert('Report unavailable', error instanceof Error ? error.message : String(error));
      return;
    }
    Alert.alert(
      'Share deidentified report?',
      [
        `Destination: ${prepared.destination}.`,
        `Size: ${prepared.byteLength.toLocaleString()} bytes (complete JSON).`,
        'Included fields:',
        ...prepared.fields.map((field) => `• ${field}`),
        'Raw logs, tracebacks, routes, product keys, device identifiers and timestamps are excluded.',
      ].join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share report',
          onPress: () => {
            setSharingReport(true);
            void Share.share({
              title: 'Australian Rates deidentified performance report',
              message: prepared.body,
            }).catch((error) => {
              Alert.alert('Share failed', error instanceof Error ? error.message : String(error));
            }).finally(() => setSharingReport(false));
          },
        },
      ],
    );
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
          Runs the registered safe checks locally, reports anything unavailable, and restores your
          settings and saved data afterward. It does not contact a host or write to the clipboard.
        </AppText>
        <AppText variant="tiny" color="textMuted">
          When results are ready, you can separately review and share a byte-capped deidentified
          report. Raw debug logs are never included in that report.
        </AppText>
        <AppText variant="tiny" color="textMuted">
          The screen stays awake during visual checks. Leaving the app pauses the run and it
          continues where it left off when you return — route and animation timings cannot be
          measured while the app is off screen.
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
              bottlenecks · {report.summary.skipped} interrupted · {report.summary.unavailable}{' '}
              unavailable
            </AppText>
            <AppText
              variant="small"
              color={report.summary.unexpectedSkipped > 0 ? 'danger' : 'textMuted'}
            >
              Coverage {report.summary.coveragePercent == null
                ? 'unavailable'
                : `${report.summary.coveragePercent.toFixed(1)}%`} · {report.summary.executed}{' '}
              executed · {report.summary.justifiedSkipped} declared unavailable ·{' '}
              {report.summary.unexpectedSkipped} interrupted/unexpected
            </AppText>
            {report.coverage ? (
              <AppText variant="small" color={report.coverage.complete ? 'textMuted' : 'danger'}>
                Safe journey checks {report.coverage.executedJourneyChecks}/
                {report.coverage.plannedJourneyChecks} executed ·{' '}
                {report.coverage.justifiedSkippedJourneyChecks} terminal unavailable ·{' '}
                {report.coverage.unavailableJourneyChecks} unavailable ·{' '}
                {report.coverage.unexpectedSkippedJourneyChecks} unexpected ·{' '}
                {report.coverage.excludedUnsafeFacetCount} unsafe side effects declared separately
              </AppText>
            ) : null}
            <AppText variant="small" color="textMuted">
              Slowest: {report.summary.slowestCheckLabel ?? 'unavailable'} (
              {report.summary.slowestCheckMs == null
                ? 'not measured'
                : `${report.summary.slowestCheckMs.toFixed(0)} ms`})
            </AppText>
            <AppText variant="small" color="textMuted">
              Worst JS lag {report.summary.maxEventLoopLagMs == null
                ? 'not measured'
                : `${report.summary.maxEventLoopLagMs.toFixed(0)} ms`} · Worst frame gap{' '}
              {report.summary.maxFrameGapMs == null
                ? 'not measured'
                : `${report.summary.maxFrameGapMs.toFixed(0)} ms`} · Total{' '}
              {(report.durationMs / 1_000).toFixed(1)} s
              {report.wallClockMs != null && report.wallClockMs - report.durationMs >= 1_000
                ? ` (+ ${((report.wallClockMs - report.durationMs) / 1_000).toFixed(1)} s paused)`
                : ''}
            </AppText>
            <AppText variant="small" color="textMuted">
              Hang timeout {(report.watchdog.hangTimeoutMs / 1_000).toFixed(0)} s; saved{' '}
              {report.watchdog.storedCheckCount} checks
            </AppText>
            <AppText variant="small" color="textMuted">
              App v{report.environment.appVersion} (build {report.environment.buildVersion})
            </AppText>
            <AppText variant="small" color="textMuted">
              Results are stored locally. No report or log was uploaded automatically.
            </AppText>
            <Button
              title="Share deidentified report"
              icon="share-outline"
              variant="ghost"
              loading={sharingReport}
              disabled={sharingReport}
              onPress={confirmShareReport}
            />
          </Card>

          {report.routeAggregates.length > 0 ? (
            <View style={{ gap: 8 }}>
              <AppText variant="tiny" weight="700" color="textFaint" style={{ marginLeft: 4 }}>
                FIRST VS REPEAT ROUTE ROUND TRIPS
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
            {reportedChecks.length < orderedChecks.length ? (
              <AppText
                variant="tiny"
                color="textFaint"
                style={{ marginLeft: 4 }}
                accessibilityLiveRegion="polite"
              >
                Showing {reportedChecks.length} of {orderedChecks.length} checks. All
                bottlenecks, warnings and unavailable facets come before successful checks.
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
                      {statusLabel(check)}
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
            {reportedChecks.length < orderedChecks.length ? (
              <Button
                title={`Show next ${Math.min(
                  MAX_REPORTED_AUDIT_CHECKS,
                  orderedChecks.length - reportedChecks.length,
                )} checks`}
                icon="chevron-down-outline"
                variant="ghost"
                onPress={() => setVisibleCheckLimit((current) =>
                  Math.min(orderedChecks.length, current + MAX_REPORTED_AUDIT_CHECKS))}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </ScreenScrollView>
  );
}

export default function PerformanceAuditScreen() {
  return <PerformanceAuditScreenInner />;
}
