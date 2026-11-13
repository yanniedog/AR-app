import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeCompleteDisplayFixture } from '../__fixtures__/appHealth';
import { evaluateAppHealthDisplayQuality } from '../src/lib/appHealth/displayQuality';
import {
  APP_HEALTH_CHECK_CODES,
  APP_HEALTH_EXPECTED_CHECK_IDS,
  type AppHealthCheck,
} from '../src/lib/appHealth/types';
import {
  finalizeAppHealthReport,
  readCompatibleAppHealthReport,
  summarizeAppHealthDomains,
  toPublicAppHealthReport,
} from '../src/lib/appHealth/report';

function passingCheck(
  code: AppHealthCheck['code'] = APP_HEALTH_CHECK_CODES.SOURCE_STATE,
): AppHealthCheck {
  return {
    id: code,
    code,
    label: 'Local label',
    domain: 'data-completeness',
    status: 'pass',
    metrics: { source: 'cache', coreAvailable: true, privateMetric: 'do-not-upload' },
    localEvidence: { providerIds: ['private-provider'] },
  };
}

const baseInput = {
  sessionId: 'local-session-id',
  mode: 'local' as const,
  startedAt: '2026-09-03T00:00:00.000Z',
  finishedAt: '2026-09-03T00:01:00.000Z',
};

describe('app-health report finalization', () => {
  it('declares every non-plan check independently of the checks a run produced', () => {
    expect(APP_HEALTH_EXPECTED_CHECK_IDS).toEqual(
      Object.values(APP_HEALTH_CHECK_CODES).filter(
        (code) => code !== APP_HEALTH_CHECK_CODES.AUDIT_PLAN,
      ),
    );
  });

  it('adds plan integrity before summary and produces a healthy complete report', () => {
    const check = passingCheck();
    const report = finalizeAppHealthReport({
      ...baseInput,
      checks: [check],
      plannedCheckIds: [check.id],
    });

    expect(report.schemaVersion).toBe(7);
    expect(report.coverage).toMatchObject({
      plannedChecks: 2,
      storedChecks: 2,
      complete: true,
    });
    expect(report.checks.at(-1)).toMatchObject({
      id: APP_HEALTH_CHECK_CODES.AUDIT_PLAN,
      status: 'pass',
    });
    expect(report.summary.overall).toBe('healthy');
  });

  it('cannot report healthy when planned checks are missing or duplicated', () => {
    const source = passingCheck();
    const report = finalizeAppHealthReport({
      ...baseInput,
      checks: [source, source],
      plannedCheckIds: [source.id, APP_HEALTH_CHECK_CODES.RATE_VALUES],
    });

    expect(report.coverage.complete).toBe(false);
    expect(report.coverage.missingPlannedCheckIds).toEqual([
      APP_HEALTH_CHECK_CODES.RATE_VALUES,
    ]);
    expect(report.coverage.duplicateStoredCheckIds).toEqual([source.id]);
    expect(report.checks.at(-1)?.status).toBe('fail');
    expect(report.summary.overall).toBe('bottleneck');
  });

  it('summarizes every domain, including domains not exercised', () => {
    const domains = summarizeAppHealthDomains([passingCheck()]);

    expect(domains).toHaveLength(8);
    expect(domains.find((domain) => domain.domain === 'data-completeness')).toMatchObject({
      overall: 'healthy',
      pass: 1,
    });
    expect(domains.find((domain) => domain.domain === 'network')).toMatchObject({
      overall: 'attention',
      total: 0,
    });
  });

  it('publishes only explicitly allowlisted aggregate fields', () => {
    const source = passingCheck();
    const report = finalizeAppHealthReport({
      ...baseInput,
      checks: [source],
      plannedCheckIds: [source.id],
      limitations: ['local detail that must not upload'],
    });
    const publicReport = toPublicAppHealthReport(report);

    expect(publicReport).not.toHaveProperty('sessionId');
    expect(publicReport).not.toHaveProperty('startedAt');
    expect(publicReport).not.toHaveProperty('finishedAt');
    expect(publicReport).not.toHaveProperty('limitations');
    expect(publicReport.checks[0]).not.toHaveProperty('label');
    expect(publicReport.checks[0]).not.toHaveProperty('localEvidence');
    expect(publicReport.checks[0].metrics).toEqual({ source: 'cache', coreAvailable: true });
    expect(publicReport.coverage).not.toHaveProperty('missingPlannedCheckIds');
  });

  it('identifies interrupted execution even when every planned record exists', () => {
    const source = passingCheck();
    const report = finalizeAppHealthReport({ ...baseInput, checks: [source],
      plannedCheckIds: [source.id], incompleteReason: 'Private local failure' });
    const published = toPublicAppHealthReport(report);
    expect(published.coverage).toMatchObject({ complete: false, plannedChecks: 2, storedChecks: 2 });
    expect(published.checks.at(-1)).toMatchObject({ status: 'fail', metrics: { interrupted: true, missingChecks: 0 } });
    expect(JSON.stringify(published)).not.toContain('Private');
  });

  it('reads schema v7 and still recognizes a schema-v6 performance report', () => {
    const check = passingCheck();
    const report = finalizeAppHealthReport({
      ...baseInput,
      checks: [check],
      plannedCheckIds: [check.id],
    });
    expect(readCompatibleAppHealthReport(report)?.kind).toBe('app-health-v7');

    const legacy = {
      schemaVersion: 6,
      sessionId: 'legacy-session',
      startedAt: '2026-09-02T00:00:00.000Z',
      finishedAt: '2026-09-02T00:01:00.000Z',
      checks: [{ id: 'journey', status: 'pass' }],
      summary: { overall: 'healthy' },
    };
    expect(readCompatibleAppHealthReport(legacy)).toEqual({
      kind: 'performance-audit-v6',
      report: legacy,
    });
    expect(readCompatibleAppHealthReport({ ...legacy, schemaVersion: 5 })).toBeNull();
  });
});


test('public chart failure names only fixed source roles and counts rejected private identities', () => {
  const check: AppHealthCheck = { ...passingCheck(APP_HEALTH_CHECK_CODES.DISPLAY_CHART),
    domain: 'display-completeness', status: 'fail', metrics: { checked: 8, missing: 1 },
    localEvidence: { failedSurfaceIds: ['product.details', 'projections.lifecycle-chart',
      'private-account-123456', 'product.details'] } };
  const report = finalizeAppHealthReport({ ...baseInput, plannedCheckIds: [check.id], checks: [check] });
  const exported = toPublicAppHealthReport(report);
  const metrics = exported.checks.find(item => item.code === APP_HEALTH_CHECK_CODES.DISPLAY_CHART)!.metrics;
  expect(metrics).toMatchObject({ failedSurfaceRoles: '["product.details","projections.lifecycle-chart"]',
    unclassifiedFailedSurfaces: 1, checked: 8, missing: 1 });
  expect(JSON.stringify(exported)).not.toMatch(/private-account|123456/);
});


test('a missing required chart is attributable after public report serialization', () => {
  const { contracts, observations } = makeCompleteDisplayFixture();
  contracts[0] = { ...contracts[0], id: 'product.details' };
  observations[0] = { ...observations[0], surfaceId: 'product.details',
    evidence: observations[0].evidence.filter(item => item.role !== 'chart') };
  const checks = evaluateAppHealthDisplayQuality(contracts, observations);
  const report = finalizeAppHealthReport({ ...baseInput, plannedCheckIds: checks.map(item => item.id), checks });
  const chart = toPublicAppHealthReport(report).checks.find(item => item.code === APP_HEALTH_CHECK_CODES.DISPLAY_CHART)!;
  expect(chart.status).toBe('fail');
  expect(chart.metrics).toMatchObject({ missing: 1, failedSurfaceRoles: '["product.details"]',
    unclassifiedFailedSurfaces: 0 });
});


test('every literal audit-plan display surface has fixed public attribution', () => {
  const sources = ['performanceAudit.ts', 'performanceAuditPlan.ts'].map(file =>
    readFileSync(path.resolve(__dirname, '../src/lib', file), 'utf8'));
  const ids = [...new Set(sources.flatMap(source => [...source.matchAll(/expectedSurface: '([a-z.-]+)'/g)]
    .map(match => match[1])))].sort();
  expect(ids.length).toBeGreaterThan(20);
  const check: AppHealthCheck = { ...passingCheck(APP_HEALTH_CHECK_CODES.DISPLAY_CHART),
    domain: 'display-completeness', localEvidence: { failedSurfaceIds: ids } };
  const report = finalizeAppHealthReport({ ...baseInput, plannedCheckIds: [check.id], checks: [check] });
  const metrics = toPublicAppHealthReport(report).checks.find(item => item.code === check.code)!.metrics;
  expect(metrics.failedSurfaceRoles).toBe(JSON.stringify(ids));
  expect(metrics.unclassifiedFailedSurfaces).toBe(0);
});
