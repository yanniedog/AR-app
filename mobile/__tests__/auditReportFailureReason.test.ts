import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { APP_HEALTH_CHECK_CODES, finalizeAppHealthReport } from '../src/lib/appHealth';
import { capturePreAuditApplicationJournal, resetAuditApplicationJournalForTests } from '../src/lib/auditApplicationJournal';
import { decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';
import * as diagnosticCodec from '../src/lib/compactDiagnosticJson';
import { debugLog } from '../src/lib/debugLog';
import { collapseRepeatedFrames, createPublicPerformanceAuditReport, encodeHostedPerformanceAudit } from '../src/lib/diagnosticsEnvelope';
import type { AuditCheck } from '../src/lib/performanceAudit';

afterEach(() => resetAuditApplicationJournalForTests());

function failed(partial: Partial<AuditCheck> & Pick<AuditCheck, 'id'>): AuditCheck {
  return {
    label: 'Rates', kind: 'journey', status: 'fail', durationMs: 1200, metrics: {},
    diagnostic: { stage: 'data', readiness: null }, ...partial,
  };
}

test('a step-limit failure names the timeout and the limit, even when the error type is generic', () => {
  const report = makePerformanceAuditReport('stall-not-this-check', [
    failed({
      id: 'journey-rates-savings-cold',
      diagnostic: { stage: 'data', readiness: null },
      metrics: { stepLimitExceeded: true, stepLimitMs: 10_000, actionCompleted: false, nonTimingFailure: false, executionAttempted: true },
      error: 'Error: data prepare\n    at run (app.js:1:2)',
    }),
    failed({
      id: 'journey-outlook-cold',
      diagnostic: { stage: 'readiness', readiness: null },
      metrics: { stepLimitExceeded: true, stepLimitMs: 10_000, executionAttempted: true },
      error: 'PerformanceAuditReadinessTimeoutError: Readiness did not settle after 10000ms: probe pending',
    }),
  ]);
  const decoded = decodeCompactDiagnosticJson(createPublicPerformanceAuditReport(report)) as {
    checks: { failureReason: string; error: { frames: unknown[] } }[];
  };
  expect(decoded.checks[0].failureReason).toContain('Timed out at stage data');
  expect(decoded.checks[0].failureReason).toContain('step limit of 10000ms exceeded');
  expect(decoded.checks[0].failureReason).toContain('Error type Error');
  expect(decoded.checks[0].failureReason).not.toBe(JSON.stringify(decoded.checks[0].error.frames));
  expect(decoded.checks[1].failureReason).toContain('Timed out at stage readiness');
  expect(decoded.checks[1].failureReason).toContain('readiness wait limit of 10000ms exceeded');
});

test('a non-timeout failure states the stage, action result, error type and message', () => {
  const report = makePerformanceAuditReport('functional-fail', [
    failed({
      id: 'journey-rates-cold',
      metrics: { actionCompleted: false, nonTimingFailure: true, executionAttempted: true },
      error: 'Error: dataset prepare failed\n    at run (app.js:4:8)',
    }),
    failed({
      id: 'journey-market-cold',
      diagnostic: { stage: 'complete', readiness: null },
      metrics: { actionCompleted: true, nonTimingFailure: false, executionAttempted: true, maxEventLoopLagMs: 1052.3, maxFrameGapMs: 1048.6 },
    }),
  ]);
  report.appHealth = finalizeAppHealthReport({
    sessionId: report.sessionId, mode: 'local', startedAt: report.startedAt, finishedAt: report.finishedAt,
    plannedCheckIds: [APP_HEALTH_CHECK_CODES.DISPLAY_LIST],
    checks: [{
      id: APP_HEALTH_CHECK_CODES.DISPLAY_LIST, code: APP_HEALTH_CHECK_CODES.DISPLAY_LIST,
      domain: 'display-completeness', label: 'Display list', status: 'fail',
      metrics: { checked: 13, missing: 0, failed: 1, warned: 0, unavailable: 0 },
    }],
  });
  const decoded = decodeCompactDiagnosticJson(createPublicPerformanceAuditReport(report)) as {
    checks: { id: string; failureReason: string }[];
    appHealth: { checks: { code: string; failureReason?: string }[] };
  };
  expect(decoded.checks[0].failureReason).toContain('Failed at stage data');
  expect(decoded.checks[0].failureReason).toContain('Action did not complete');
  expect(decoded.checks[0].failureReason).toContain('Error type Error');
  expect(decoded.checks[0].failureReason).toContain('Message: dataset prepare failed');
  expect(decoded.checks[0].failureReason).not.toContain('Timed out');
  expect(decoded.checks[1].failureReason).toContain('Timing failure, not a step or stall timeout');
  expect(decoded.checks[1].failureReason).toContain('maxEventLoopLagMs=1052.3ms exceeded the 300ms fail limit');
  expect(decoded.checks[1].failureReason).toContain('maxFrameGapMs=1048.6ms exceeded the 250ms fail limit');
  expect(decoded.checks[1].failureReason).not.toContain('Timed out');
  const health = decoded.appHealth.checks.find(check => check.code === APP_HEALTH_CHECK_CODES.DISPLAY_LIST);
  expect(health?.failureReason).toContain('Health check display-list failed');
  expect(health?.failureReason).toContain('failed=1');
  expect(health?.failureReason).toContain('checked=13');
});

test('the configured stall timeout is on a report that did not stall', () => {
  const report = makePerformanceAuditReport('no-stall', [{
    id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'pass', durationMs: 20,
    metrics: { executionAttempted: true, actionCompleted: true },
    diagnostic: { stage: 'complete', readiness: null },
  }]);
  report.watchdog.hangTimeoutMs = 30_000;
  const body = createPublicPerformanceAuditReport(report);
  const header = JSON.parse(body).audit;
  const decoded = decodeCompactDiagnosticJson(body) as {
    stallTimeout: { stallTimeoutMs: number; stallTimeoutSeconds: number };
    diagnostics: { watchdog: { stallTimeoutMs: number; stallTimeoutSeconds: number; hangTimeoutMs: number } };
    checks: { failureReason?: string }[];
  };
  expect(header).toMatchObject({ stallTimeoutMs: 30_000, stallTimeoutSeconds: 30, failureCount: 0 });
  expect(decoded.stallTimeout).toEqual({ stallTimeoutMs: 30_000, stallTimeoutSeconds: 30 });
  expect(decoded.diagnostics.watchdog).toMatchObject({ hangTimeoutMs: 30_000, stallTimeoutMs: 30_000, stallTimeoutSeconds: 30 });
  expect(decoded.checks[0].failureReason).toBeUndefined();
  const stalled = makePerformanceAuditReport('stalled', [failed({
    id: 'fatal-1', kind: 'runtime',
    metrics: { executionAttempted: true, nonTimingFailure: false },
    error: 'AuditInactivityError: Performance audit stored no completed check for 30000ms (stored checks: 4)',
  })]);
  stalled.watchdog.hangTimeoutMs = 30_000;
  const stallDecoded = decodeCompactDiagnosticJson(createPublicPerformanceAuditReport(stalled)) as {
    checks: { failureReason: string }[];
  };
  expect(stallDecoded.checks[0].failureReason).toBe('Timed out: stall timeout of 30000ms (30s) elapsed with no completed check stored.');
});

test('pre-audit and post-audit log sections survive compressed upload', () => {
  debugLog.info('app', 'before-audit-marker');
  capturePreAuditApplicationJournal('journal-session');
  debugLog.info('app', 'during-audit-marker');
  debugLog.info('app', 'account 12345678 token=sekret');
  const report = makePerformanceAuditReport('journal-session', [{
    id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'pass', durationMs: 20,
    metrics: { executionAttempted: true, actionCompleted: true },
  }]);
  const body = createPublicPerformanceAuditReport(report);
  expect(JSON.parse(body).format).toBe('ar-audit-gzip-v1');
  const decoded = decodeCompactDiagnosticJson(body) as {
    applicationJournal: {
      beforeAudit: { entries: { ts: string; message: string }[]; entryCount: number };
      duringAndAfterAudit: { entries: { ts: string; message: string }[]; entryCount: number };
    };
    stallTimeout: { stallTimeoutMs: number };
  };
  const before = decoded.applicationJournal.beforeAudit;
  const after = decoded.applicationJournal.duringAndAfterAudit;
  expect(before.entryCount).toBe(before.entries.length);
  expect(after.entryCount).toBe(after.entries.length);
  expect(before.entries.some(entry => entry.message === 'before-audit-marker' && entry.ts.length > 0)).toBe(true);
  expect(before.entries.some(entry => entry.message === 'during-audit-marker')).toBe(false);
  expect(after.entries.map(entry => entry.message)).toEqual(['during-audit-marker', '[REDACTED]']);
  expect(after.entries.every(entry => entry.ts.length > 0)).toBe(true);
  const text = JSON.stringify(decoded);
  expect(text).not.toContain('12345678');
  expect(text).not.toContain('sekret');
  expect(decoded.stallTimeout.stallTimeoutMs).toBe(10_000);
});

test('an over-budget upload drops repeated frames and still decodes reasons and both logs', () => {
  const value = {
    failureReason: 'Timed out: step limit of 10000ms exceeded.',
    applicationJournal: {
      beforeAudit: { capturedAt: '2026-10-15T18:00:00.000Z', entryCount: 1, entries: [{ ts: '2026-10-15T18:00:00.000Z', level: 'info', tag: 'app', message: 'before-audit-marker' }] },
      duringAndAfterAudit: { capturedAt: '2026-10-15T18:01:00.000Z', entryCount: 1, entries: [{ ts: '2026-10-15T18:01:00.000Z', level: 'info', tag: 'app', message: 'during-audit-marker' }] },
    },
    checks: [{ error: { frames: [['frame', 1, 2], ['frame', 1, 2], ['frame', 3, 4]] } }],
  };
  expect(collapseRepeatedFrames(value).removed).toBe(1);
  const real = jest.requireActual<typeof diagnosticCodec>('../src/lib/compactDiagnosticJson').encodeCompressedDiagnosticJson;
  const encode = jest.spyOn(diagnosticCodec, 'encodeCompressedDiagnosticJson')
    .mockImplementationOnce(() => { throw new Error('The diagnostic report exceeds the public upload limit.'); })
    .mockImplementation(real);
  try {
    const body = encodeHostedPerformanceAudit(value, { audit: { outcome: 'failed' } });
    expect(JSON.parse(body).format).toBe('ar-audit-gzip-v1');
    const decoded = decodeCompactDiagnosticJson(body) as {
      truncation: { repeatedFramesRemoved: number; preserved: string[] };
      failureReason: string;
      applicationJournal: { beforeAudit: { entries: { message: string }[] }; duringAndAfterAudit: { entries: { message: string }[] } };
      checks: { error: { frames: [string, number, number][] } }[];
    };
    expect(decoded.truncation).toEqual({
      repeatedFramesRemoved: 1,
      preserved: ['failureReason', 'applicationJournal.beforeAudit', 'applicationJournal.duringAndAfterAudit'],
    });
    expect(decoded.failureReason).toContain('step limit of 10000ms');
    expect(decoded.applicationJournal.beforeAudit.entries[0].message).toBe('before-audit-marker');
    expect(decoded.applicationJournal.duringAndAfterAudit.entries[0].message).toBe('during-audit-marker');
    expect(decoded.checks[0].error.frames).toEqual([['frame', 1, 2], ['frame', 3, 4]]);
  } finally {
    encode.mockRestore();
  }
});
