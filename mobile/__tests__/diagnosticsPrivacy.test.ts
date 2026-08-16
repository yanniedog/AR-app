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
      payloadSource: 'network',
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

  it('keeps running and post-result sharing separate from network, clipboard and raw-log export', () => {
    const runner = read('src/components/PerformanceAuditRunner.tsx');
    const screen = read('app/performance-audit.tsx');
    const debugScreen = read('app/debug-log.tsx');
    const layout = read('app/_layout.tsx');
    const settings = read('app/(tabs)/settings.tsx');
    const observability = read('src/lib/observability.ts');
    const store = read('src/data/store.ts');

    expect(runner).not.toContain('uploadDebugLog');
    expect(runner).not.toContain('reportPerformanceAudit');
    expect(runner).not.toContain('Clipboard');
    expect(runner).toContain('Network transport is disabled during the local performance audit');
    expect(screen).toContain('Share deidentified report');
    expect(screen).not.toContain('readCompleteText');
    expect(screen).not.toContain('Clipboard');
    expect(screen).not.toContain('uploadDebugLog');
    expect(screen).not.toContain('fetch(');
    expect(debugScreen).toContain('Open expert public-upload flow?');
    expect(debugScreen).toContain('Upload private log now?');
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
