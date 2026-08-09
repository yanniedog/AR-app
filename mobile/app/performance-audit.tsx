import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, TextInput, View } from 'react-native';

import { ScreenScrollView } from '../src/components/Screen';
import { AppText, Button, Card, Row } from '../src/components/ui';
import {
  DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS,
  getPerformanceAuditState,
  claimPerformanceAuditUploadDeletion,
  markPerformanceAuditUploadDeleted,
  MAX_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS,
  MIN_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS,
  parsePerformanceAuditHangTimeoutSeconds,
  PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY,
  requestPerformanceAudit,
  releasePerformanceAuditUploadDeletion,
  selectReportedAuditChecks,
  MAX_REPORTED_AUDIT_CHECKS,
  subscribePerformanceAudit,
  type AuditCheck,
  type AuditCheckStatus,
} from '../src/lib/performanceAudit';
import { deleteDebugLogUpload } from '../src/lib/debugLog';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { ScreenSkeleton } from '../src/components/feedback';
import { useDeveloperToolsEnabled } from '../src/lib/developerTools';
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

function metricNumber(check: AuditCheck, key: string): number | null {
  const value = check.metrics[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
    return `${measuredMs('Request', check.durationMs)} · HTTP ${check.metrics.statusCode ?? '—'}`;
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
    return `Max JS lag ${Number(check.metrics.maxEventLoopLagMs ?? 0).toFixed(0)} ms · JS animation callback gap ${Number(check.metrics.maxFrameGapMs ?? 0).toFixed(0)} ms`;
  }
  return measuredMs('Duration', check.durationMs);
}

function PerformanceAuditScreenInner() {
  const theme = useTheme();
  const state = usePerformanceAuditState();
  const [hangTimeoutInput, setHangTimeoutInput] = useState(
    String(DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS / 1_000),
  );
  const [hangTimeoutLoaded, setHangTimeoutLoaded] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [deletingUpload, setDeletingUpload] = useState(false);
  const [visibleCheckLimit, setVisibleCheckLimit] = useState(MAX_REPORTED_AUDIT_CHECKS);
  const deletingUploadRef = useRef(false);
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
  const confirmRunAudit = () => {
    if (!hangTimeoutLoaded || hangTimeoutSeconds == null) return;
    Alert.alert(
      'Run and publicly upload the full log?',
      'After the audit, the complete redacted debug log is uploaded to paste.rs, or to paste.c-net.org when needed. Anyone with the link can read it. C-net uploads expire after 180 inactive days; access resets that period. Review or clear the debug log first if needed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Run and upload', style: 'destructive', onPress: runAudit },
      ],
    );
  };
  const deleteUpload = () => {
    if (!state.sessionId || !state.uploadUrl || deletingUpload) return;
    const sessionId = state.sessionId;
    const url = state.uploadUrl;
    Alert.alert(
      'Delete uploaded log?',
      'Permanently removes this public copy. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (!claimPerformanceAuditUploadDeletion(deletingUploadRef)) return;
            setDeletingUpload(true);
            void deleteDebugLogUpload(url, state.uploadDeleteKey ?? undefined)
              .then(() => markPerformanceAuditUploadDeleted(sessionId))
              .catch((error) => {
                Alert.alert(
                  'Could not delete upload',
                  error instanceof Error ? error.message : String(error),
                );
              })
              .finally(() => {
                releasePerformanceAuditUploadDeletion(deletingUploadRef);
                setDeletingUpload(false);
              });
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
          Maximum safe coverage is always on. One tap temporarily enables every local feature and
          all three sections, preloads their trusted assets, repeats every safe screen action cold
          and warm, then tests models, responsiveness, storage, payload processing, network and
          Android update readiness. Your settings and saved data are restored exactly afterward.
        </AppText>
        <AppText variant="tiny" color="warning">
          Anyone with the link can read the uploaded full log. You will be asked to confirm before
          the audit starts, and can delete a successful upload below.
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
          onPress={confirmRunAudit}
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
              Coverage {report.summary.coveragePercent.toFixed(1)}% · {report.summary.executed}{' '}
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
              Slowest: {report.summary.slowestCheckLabel ?? '—'} (
              {report.summary.slowestCheckMs.toFixed(0)} ms)
            </AppText>
            <AppText variant="small" color="textMuted">
              Worst JS lag {report.summary.maxEventLoopLagMs.toFixed(0)} ms · Worst frame gap{' '}
              {report.summary.maxFrameGapMs.toFixed(0)} ms · Total{' '}
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
            <AppText variant="small" color={state.uploadUrl ? 'success' : 'textMuted'}>
              {state.uploadUrl
                ? `Full log publicly hosted via ${state.uploadProvider}. ${
                  state.uploadLinkCopied ? 'Link copied to clipboard.' : 'Clipboard copy failed; use the link below.'
                } Anyone with the link can read it.`
                : state.uploadPending
                  ? 'Uploading the full log to a public host...'
                  : state.uploadDeleted
                    ? 'Public log upload deleted.'
                    : `Automatic log upload failed${state.uploadError ? `: ${state.uploadError}` : '.'}`}
            </AppText>
            {state.uploadUrl ? (
              <>
                <AppText variant="tiny" selectable style={{ fontFamily: 'monospace' }}>
                  {state.uploadUrl}
                </AppText>
                <Button
                  title="Delete uploaded log"
                  icon="trash-outline"
                  variant="ghost"
                  loading={deletingUpload}
                  disabled={deletingUpload}
                  onPress={deleteUpload}
                />
              </>
            ) : null}
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

/**
 * Route guard: direct navigation to this maintainer screen must not bypass the
 * seven-tap unlock in Settings.
 */
export default function PerformanceAuditScreen() {
  const developerTools = useDeveloperToolsEnabled();
  // Undecided until prefs rehydrate — redirecting here would discard the
  // requested destination for a user who has actually unlocked these tools.
  if (developerTools == null) return <ScreenSkeleton rows={2} />;
  if (!developerTools) return <Redirect href="/settings" />;
  return <PerformanceAuditScreenInner />;
}
