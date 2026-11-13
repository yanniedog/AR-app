import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { buildAuditMetricAnalysis } from '../src/lib/auditMetricAnalysis';
import { auditMetricRun } from '../src/lib/auditMetricHistory';
import type { AuditCheck } from '../src/lib/performanceAudit';

const journey = (id: string, metrics: AuditCheck['metrics']): AuditCheck => ({
  id, label: 'Rates', kind: 'journey', status: 'pass', durationMs: 10,
  metrics: { executionAttempted: true, ...metrics },
});

test('Back population excludes semantic actions and retains missing attempted returns', () => {
  const report = makePerformanceAuditReport('returns', [
    journey('route-measured', { measurementMode: 'route-round-trip', backMs: 20 }),
    journey('route-missing', { measurementMode: 'route-round-trip' }),
    journey('legacy-measured', { backMs: 40 }),
    journey('legacy-missing', { backMs: null, backReturnedToAudit: false }),
    journey('legacy-failed-return', { backChangedPath: false }),
    journey('semantic', { measurementMode: 'semantic-action', actionMs: 5 }),
    journey('unavailable-route', { measurementMode: 'route-round-trip', executionAttempted: false }),
    { ...journey('skipped-route', { measurementMode: 'route-round-trip' }), status: 'skipped' },
  ]);
  const analysis = buildAuditMetricAnalysis(report);
  const evidence = analysis.metrics.backP95Ms;
  expect(evidence.value).toBe(auditMetricRun(report).metrics.backP95Ms);
  expect(evidence).toMatchObject({ value: 40, eligibleCount: 5, observedCount: 2,
    sampleSize: 2, missingCount: 3, excludedCount: 3, missingEvidence: ['partial-samples'],
    distribution: { n: 2, p50: 20, p95: 40, population: 'return-duration' } });
  expect(evidence.contributors.map(index => analysis.observations[index].checkId)).toEqual([
    'route-measured', 'route-missing', 'legacy-measured', 'legacy-missing', 'legacy-failed-return',
  ]);
});

test('semantic-only audit has no eligible Back observations rather than missing return samples', () => {
  const report = makePerformanceAuditReport('semantic-only', [
    journey('semantic', { measurementMode: 'semantic-action', actionMs: 5 }),
  ]);
  expect(buildAuditMetricAnalysis(report).metrics.backP95Ms).toMatchObject({
    value: null, eligibleCount: 0, observedCount: 0, missingCount: 0, excludedCount: 1,
    missingEvidence: ['no-eligible-observations'], contributors: [],
  });
});
