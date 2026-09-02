import {
  APP_HEALTH_CHECK_CODES,
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
