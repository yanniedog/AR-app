import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { finalizeAppHealthReport, toPublicAppHealthReport } from '../src/lib/appHealth/report';
import { APP_HEALTH_CHECK_CODES, type AppHealthMetricValue } from '../src/lib/appHealth/types';
import { decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';
import { createPublicPerformanceAuditReport } from '../src/lib/diagnosticsEnvelope';
import { buildPerformanceAuditCompletion } from '../src/lib/performanceAuditCompletion';

function healthReport(metrics: Record<string, AppHealthMetricValue>) {
  return finalizeAppHealthReport({ sessionId: 'history-privacy', mode: 'local',
    startedAt: '2026-10-24T00:00:00Z', finishedAt: '2026-10-24T00:00:01Z',
    checks: [{ id: APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE, code: APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE,
      label: 'Catalogue', domain: 'data-completeness', status: 'warn', metrics }],
    plannedCheckIds: [APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE] });
}

test('the complete gzip upload retains every gap and correlates provider aliases without publishing identities', () => {
  const gaps: unknown[][] = Array.from({ length: 400 }, (_, index) => ['2026-10-23', 'source-to-model-count-mismatch',
    'Mortgage', -(index + 1), index % 2 ? 'Private Bank A' : 'Private Bank B']);
  gaps.push(['2026-10-24', 'historical-quarantined-tiers', null, 2, 'Private Bank A']);
  gaps.push(['2026-10-24', 'current-product-rate-mismatch', 'Mortgage', 1, 'PRIVATE_PRODUCT_KEY']);
  gaps.push(['2026-10-23', 'product-model-to-chart-mismatch', 'Mortgage', 1, 'PRIVATE_PRODUCT_KEY']);
  gaps.push(['2026-10-24', 'current-payload-stale', null, 1]);
  const report = makePerformanceAuditReport('history-privacy');
  report.appHealth = healthReport({ historyGaps: JSON.stringify(gaps),
    historySourceGapDays: '["2026-10-21","2026-10-22"]', historicalPixelsVerified: false });
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as any;
  const summary = decoded.appHealth.checks.find((check: any) => check.code === APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE).metrics;
  const retained = decoded.diagnosticLog.appHealth.checks.find((check: any) => check.code === APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE).metrics;
  const publicGaps = JSON.parse(summary.historyGaps);
  expect(publicGaps).toHaveLength(gaps.length);
  expect(publicGaps.map((gap: unknown[]) => gap.slice(0, 4))).toEqual(gaps.map(gap => gap.slice(0, 4)));
  expect(publicGaps[0][4]).toMatch(/^~private-source-identity-/);
  expect(publicGaps[0][4]).toBe(publicGaps[2][4]);
  expect(publicGaps[0][4]).not.toBe(publicGaps[1][4]);
  expect(publicGaps.at(-2)[4]).toBe(publicGaps.at(-3)[4]);
  expect(summary).toEqual(retained);
  expect(summary.historySourceGapDays).toBe('["2026-10-21","2026-10-22"]');
  expect(summary.historyGapEvidenceInvalid).toBeUndefined();
  expect(JSON.stringify(decoded)).not.toMatch(/Private Bank [AB]|PRIVATE_PRODUCT_KEY/);
  expect(report.appHealth.checks[0].metrics.historyGaps).toBe(JSON.stringify(gaps));
});

test('malformed nested strings fail closed while preserving each invalid record and marking unknown evidence', () => {
  const gaps = [
    ['2026-10-23', 'source-to-model-count-mismatch', 'Mortgage', -2],
    ['customer@example.com', 'processed-day-missing', null, 1],
    ['2026-10-23', 'secret reason', null, 1],
    ['2026-10-23', 'processed-day-missing', 'secret section', 1],
    ['2026-10-23', 'processed-day-missing', null, Infinity],
    ['2026-10-23', 'processed-day-missing', null, 1, { password: 'secret' }],
    ['2026-10-23', 'processed-day-missing', null, 1, 'provider', 'extra secret'],
  ];
  const metrics = toPublicAppHealthReport(healthReport({ historyGaps: JSON.stringify(gaps),
    historySourceGapDays: JSON.stringify(['2026-10-23', '2026-02-30', 'customer@example.com']) })).checks[0].metrics;
  const retained = JSON.parse(String(metrics.historyGaps));
  expect(retained).toHaveLength(gaps.length);
  expect(retained[0]).toEqual(gaps[0]);
  expect(retained.slice(1).every((gap: unknown[]) => gap[1] === 'invalid-gap-evidence')).toBe(true);
  expect(JSON.parse(String(metrics.historySourceGapDays))).toHaveLength(3);
  expect(metrics).toMatchObject({ historyGapEvidenceInvalid: true, historyInvalidGapRecords: 6, historyInvalidSourceGapDates: 2 });
  expect(JSON.stringify(metrics)).not.toMatch(/customer@example.com|secret|2026-02-30|password/);
  const unreadable = toPublicAppHealthReport(healthReport({ historyGaps: 'SECRET invalid JSON' })).checks[0].metrics;
  expect(unreadable).toMatchObject({ historyGapEvidenceInvalid: true, historyInvalidGapRecords: null });
  expect(JSON.parse(String(unreadable.historyGaps))).toMatchObject({ invalidEvidence: true,
    opaqueEvidence: expect.stringMatching(/^~private-history-evidence-/) });
  expect(JSON.stringify(unreadable)).not.toContain('SECRET');
  const report = makePerformanceAuditReport('history-privacy');
  report.appHealth = healthReport({ historyGaps: 'SECRET invalid JSON' });
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ detailsComplete: false, coverageComplete: false,
    gaps: { invalidHistoryEvidenceChecks: 1 }, gapPositions: [{ source: 'health', position: 1,
      checkId: APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE, reason: 'invalid-history-evidence' }] });
});

test.each<Record<string, AppHealthMetricValue>>([{}, { historyGaps: '[]' }, { historySourceGapDays: '[]' }])(
  'omitted daily gap lists invalidate retained audit completeness: %j', metrics => {
    const report = makePerformanceAuditReport('missing-history');
    report.appHealth = healthReport(metrics);
    expect(buildPerformanceAuditCompletion(report)).toMatchObject({ detailsComplete: false, coverageComplete: false,
      gaps: { invalidHistoryEvidenceChecks: 1 }, gapPositions: [{ source: 'health', position: 1,
        checkId: APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE, reason: 'invalid-history-evidence' }] });
    const publicMetrics = toPublicAppHealthReport(report.appHealth).checks[0].metrics;
    expect(publicMetrics.historyGapEvidenceInvalid).toBe(true);
    for (const key of ['historyGaps', 'historySourceGapDays']) if (!Object.hasOwn(metrics, key))
      expect(JSON.parse(String(publicMetrics[key]))).toEqual({ invalidEvidence: true, missingEvidence: true });
  },
);
