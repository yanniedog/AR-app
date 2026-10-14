import fs from 'node:fs';
import path from 'node:path';

import {
  buildDeidentifiedPerformanceAudit,
  createDeidentifiedDiagnosticsShare,
  DEIDENTIFIED_DIAGNOSTICS_MAX_BYTES,
} from '../src/lib/diagnosticsEnvelope';
import {
  PERFORMANCE_AUDIT_SCHEMA_VERSION,
  summarizePerformanceAudit,
  type AuditCheck,
  type PerformanceAuditReport,
} from '../src/lib/performanceAudit';

const read = (relativePath: string) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

function reportFixture(checks: AuditCheck[]): PerformanceAuditReport {
  return {
    schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
    sessionId: 'private-session-id',
    startedAt: '2026-08-15T00:00:00.000Z',
    finishedAt: '2026-08-15T00:01:00.000Z',
    durationMs: 60_000,
    app: { appVersion: '1.2.3', buildVersion: '456' },
    watchdog: { hangTimeoutMs: 30_000, storedCheckCount: checks.length, lastStoredCheckAt: null },
    environment: {
      appVersion: 'private-stale-version',
      buildVersion: 'private-stale-build',
      platform: 'android',
      platformVersion: '37',
      manufacturer: 'Private Maker',
      brand: 'Private Brand',
      model: 'Private Model',
      osName: 'Android',
      osVersion: '17.2.1',
      totalMemoryBytes: 123456789,
      jsEngine: 'Hermes',
      developmentBuild: false,
      viewportWidth: 448,
      viewportHeight: 997,
      fontScale: 1,
      payloadSource: 'remote',
      payloadRunDate: '2026-08-15',
      payloadProducts: 2878,
      payloadProviders: 104,
      detailsLoaded: true,
      historyLoaded: true,
      productHistoryLoaded: true,
      diagnosticsUploadEnabled: false,
      networkType: 'WIFI',
      networkConnected: true,
      networkInternetReachable: true,
    },
    summary: summarizePerformanceAudit(checks),
    checks,
    routeAggregates: [],
    limitations: ['private limitation'],
  };
}

describe('deidentified diagnostics privacy boundary', () => {
  it.each(['pass', 'skipped'] as const)('preserves measured readiness savings for %s checks without private evidence', (status) => {
    const checks: AuditCheck[] = [true, false].map((reused) => ({
      id: 'deep-first-pass.search.action', label: 'Private label', kind: 'journey', status,
      durationMs: status === 'skipped' ? null : 700,
      metrics: { executionAttempted: true, preActionWaitMs: reused ? 3 : 650,
        preActionQuietWindowReused: reused, preActionQuietWindowAvoidedMs: reused ? 650 : 0,
        readinessEvidence: 'Private screen content' },
    }));
    const prepared = createDeidentifiedDiagnosticsShare(reportFixture(checks));
    const parsed = JSON.parse(prepared.body);
    expect(parsed.checks[0].metrics).toMatchObject({
      preActionWaitMs: 3, preActionQuietWindowReused: true, preActionQuietWindowAvoidedMs: 650,
    });
    expect(parsed.checks[1].metrics).toMatchObject({
      preActionWaitMs: 650, preActionQuietWindowReused: false, preActionQuietWindowAvoidedMs: 0,
    });
    expect(prepared.body).not.toContain('Private');
  });

  it.each(['rba', 'rba-redirect'])(
    'retains fixed %s journey IDs and the slowest check while rejecting private suffixes',
    (journey) => {
      const checks: AuditCheck[] = [
        { id: `journey-${journey}-cold`, label: 'Private label', kind: 'journey', status: 'pass', durationMs: 20, metrics: { forwardMs: 20 } },
        { id: `journey-${journey}-warm`, label: 'Private label', kind: 'journey', status: 'warn', durationMs: 40, metrics: { forwardMs: 40 } },
        { id: `journey-${journey}-private-account-cold`, label: 'Private label', kind: 'journey', status: 'pass', durationMs: 10, metrics: { forwardMs: 10 } },
      ];
      const prepared = createDeidentifiedDiagnosticsShare(reportFixture(checks));
      const parsed = JSON.parse(prepared.body);
      expect(parsed.checks.map((check: { id: string | null }) => check.id)).toEqual([
        `journey-${journey}-cold`, `journey-${journey}-warm`, null,
      ]);
      expect(parsed.summary.slowestCheckId).toBe(`journey-${journey}-warm`);
      expect(prepared.body).not.toContain('private-account');
      expect(prepared.body).not.toContain('Private label');
    },
  );

  it('shares only fixed identities, allowlisted metrics and proven zero measurements', () => {
    const report = reportFixture([
      {
        id: 'active-data',
        label: 'Private payload label',
        kind: 'data',
        status: 'pass',
        durationMs: 0,
        metrics: {
          executionAttempted: true,
          measurementAvailable: true,
          parseMs: 0,
          expectedPath: '/product/private-product-id',
          accountBalance: 987654,
          privateText: 'private receipt text',
        },
        error: 'private error',
        trace: 'private trace',
      },
      {
        id: 'product-private-balance-123',
        label: 'Private dynamic check',
        kind: 'runtime',
        status: 'skipped',
        durationMs: 0,
        metrics: { executionAttempted: false, eventLoopSamples: 0, maxEventLoopLagMs: 0 },
      },
    ]);

    const envelope = buildDeidentifiedPerformanceAudit(report);
    const prepared = createDeidentifiedDiagnosticsShare(report);
    const parsed = JSON.parse(prepared.body);

    expect(envelope).toEqual(parsed);
    expect(parsed.checks[0]).toMatchObject({
      id: 'active-data',
      durationMs: 0,
      metrics: { executionAttempted: true, measurementAvailable: true, parseMs: 0 },
    });
    expect(parsed.checks[1]).toMatchObject({
      id: null,
      durationMs: null,
      metrics: { executionAttempted: false, eventLoopSamples: null, maxEventLoopLagMs: null },
    });
    expect(prepared.byteLength).toBe(new TextEncoder().encode(prepared.body).length);
    expect(prepared.byteLength).toBeLessThanOrEqual(DEIDENTIFIED_DIAGNOSTICS_MAX_BYTES);
    expect(prepared.destination).toContain('operating-system share sheet');

    for (const secret of [
      'private-session-id', 'Private Maker', 'Private Brand', 'Private Model',
      'private-stale-version', 'WIFI', '/product/private-product-id', '987654',
      'private receipt text', 'private error', 'private trace', 'private limitation',
      'product-private-balance-123',
    ]) {
      expect(prepared.body).not.toContain(secret);
    }
  });

  it('refuses an envelope above the exact byte cap', () => {
    const checks = Array.from({ length: 4_000 }, (): AuditCheck => ({
      id: 'active-data',
      label: 'not exported',
      kind: 'data',
      status: 'pass',
      durationMs: 1,
      metrics: { executionAttempted: true, parseMs: 1 },
    }));

    expect(() => createDeidentifiedDiagnosticsShare(reportFixture(checks))).toThrow(
      'above the 262144-byte sharing limit',
    );
  });

  it('keeps paste sharing after measurements and retains explicit deidentified sharing', () => {
    const runner = read('src/components/PerformanceAuditRunner.tsx');
    const screen = read('app/performance-audit.tsx');
    const debugScreen = read('app/debug-log.tsx');
    const layout = read('app/_layout.tsx');
    const settings = read('app/settings.tsx');
    const observability = read('src/lib/observability.ts');
    const store = read('src/data/store.ts');

    expect(runner).not.toContain('uploadDebugLog');
    expect(runner).not.toContain('reportPerformanceAudit');
    expect(runner).not.toContain('Clipboard');
    expect(runner).toContain('local app-health mode blocks fetch and XMLHttpRequest before transport');
    expect(screen).toContain('Share deidentified report');
    expect(screen).toContain('FileSystem.writeAsStringAsync(DEIDENTIFIED_AUDIT_SHARE_FILE, prepared.body)');
    expect(screen).toContain('Sharing.shareAsync(DEIDENTIFIED_AUDIT_SHARE_FILE');
    expect(screen).toContain('FileSystem.deleteAsync(DEIDENTIFIED_AUDIT_SHARE_FILE, { idempotent: true })');
    expect(screen).not.toContain('Share.share({');
    expect(screen).not.toContain('readCompleteText');
    expect(screen).not.toContain('Clipboard');
    expect(screen).not.toContain('uploadDebugLog');
    expect(screen).not.toContain('fetch(');
    expect(debugScreen).toContain('Upload diagnostic log?');
    expect(debugScreen).toContain("uiJoin('Public hosting', ': ', uiIdentifier('paste.rs'), ' / ', uiIdentifier('paste.c-net.org')");
    expect(screen).toContain("'Operating-system share sheet'");
    expect(screen).toContain("'Raw logs / tracebacks / routes / product keys / device IDs / timestamps'");
    expect(screen).toContain('uploadLog: publicUpload');
    expect(screen).toContain('useState(false)');
    expect(screen).toContain('Public upload');
    const completion = runner.indexOf('await publishPerformanceAuditAfterFinalization(report');
    const upload = runner.indexOf('startPerformanceAuditLogUpload(uploadLog,');
    expect(runner).not.toContain('startDebugLogUpload');
    expect(runner).not.toContain('await startPerformanceAuditLogUpload(');
    expect(runner.match(/startPerformanceAuditLogUpload\(uploadLog,/g)).toHaveLength(2);
    expect(runner.indexOf('startPerformanceAuditLogUpload(uploadLog,', upload + 1)).toBeGreaterThan(runner.indexOf('failPerformanceAudit(['));
    expect(completion).toBeGreaterThan(0);
    expect(upload).toBeGreaterThan(completion);
    const transportRelease = runner.indexOf('}, restoreTransportGuard);', completion);
    expect(transportRelease).toBeGreaterThan(completion);
    expect(upload).toBeGreaterThan(transportRelease);
    expect(upload).toBeGreaterThan(runner.indexOf("'Final audit log flush'"));
    expect(debugScreen).toContain('!receiptLoaded');
    expect(debugScreen).not.toContain('setStringAsync(result.url)');
    expect(layout).toContain('routeClass=');
    expect(layout).not.toContain('tap route ${String(href)}');
    expect(settings).toContain('setCrashReportsEnabled(value)');
    expect(settings).toContain('Crash reports unchanged');
    expect(observability).toContain('isCrashlyticsCollectionEnabled');
    expect(observability).toContain('consent was not confirmed');
    expect(store).toContain('A native consent-state failure must not');
    expect(store).toContain('background crash-reporting confirmation failed');
  });
});
