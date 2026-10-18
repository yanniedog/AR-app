import { PERFORMANCE_AUDIT_SCHEMA_VERSION, summarizePerformanceAudit, type AuditCheck,
  type PerformanceAuditReport } from '../src/lib/performanceAudit';

export function makePerformanceAuditReport(sessionId = 'audit-fixture', checks: AuditCheck[] = []): PerformanceAuditReport {
  return { schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION, sessionId,
    startedAt: '2026-10-15T18:00:00Z', finishedAt: '2026-10-15T18:01:00Z', durationMs: 60_000,
    app: { appVersion: '1.0.240', buildVersion: '297' },
    watchdog: { hangTimeoutMs: 10_000, storedCheckCount: checks.length, lastStoredCheckAt: null },
    environment: { appVersion: '1.0.240', buildVersion: '297', platform: 'android', platformVersion: '37',
      manufacturer: 'private-maker', brand: 'private-brand', model: 'private-model', osName: 'Android', osVersion: '17',
      totalMemoryBytes: 12000000000, jsEngine: 'Hermes', developmentBuild: false,
      viewportWidth: 448, viewportHeight: 997, fontScale: 1, payloadSource: 'remote', payloadRunDate: '2026-10-16',
      payloadProducts: 2796, payloadProviders: 102, detailsLoaded: true, historyLoaded: true,
      productHistoryLoaded: true, diagnosticsUploadEnabled: false, networkType: 'WIFI',
      networkConnected: true, networkInternetReachable: true },
    summary: summarizePerformanceAudit(checks), checks, routeAggregates: [], limitations: ['private diagnostic text'] };
}
