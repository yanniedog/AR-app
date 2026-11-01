import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { auditMetricRun, auditMetricPlot, mergeAuditMetricRuns, parseAuditMetricHistory, AUDIT_HISTORY_LIMIT } from '../src/lib/auditMetricHistory';

test('unknown measurements and modes remain distinct from measured zero', () => {
  const report = makePerformanceAuditReport();
  const run = auditMetricRun({ ...report, appHealth: undefined,
    summary: { ...report.summary, maxEventLoopLagMs: null, maxFrameGapMs: 0 } });
  expect(run.mode).toBe('unknown');
  expect(run.metrics.maxEventLoopLagMs).toBeNull();
  expect(run.metrics.maxFrameGapMs).toBe(0);
  expect(run.coverageComplete).toBe(false);
});

test('repeated saves deduplicate by run and keep chronological bounded history', () => {
  const run = auditMetricRun(makePerformanceAuditReport());
  const rows = Array.from({ length: 125 }, (_, index) => ({ ...run,
    sessionId: `run-${index}`, finishedAt: new Date(index * 1000).toISOString() }));
  const saved = mergeAuditMetricRuns([], rows.reverse());
  expect(saved).toHaveLength(AUDIT_HISTORY_LIMIT);
  expect(saved[0].sessionId).toBe('run-5');
  expect(saved.at(-1)?.sessionId).toBe('run-124');
  expect(mergeAuditMetricRuns(saved, [saved[0]])).toEqual(saved);
});

test('time coordinates preserve spacing and missing measurements break lines', () => {
  const run = auditMetricRun(makePerformanceAuditReport());
  const rows = [0, 1000, 9000].map((time, index) => ({ ...run, sessionId: String(index),
    finishedAt: new Date(time).toISOString(), metrics: { ...run.metrics, failures: index === 1 ? null : index } }));
  const plot = auditMetricPlot(rows, 'failures');
  expect(plot.points[0]).toMatchObject({ x: 12, y: 128, value: 0 });
  expect(plot.points[1]).toBeNull();
  expect(plot.points[2]).toMatchObject({ x: 308, y: 16, value: 2 });
  expect(plot.path).not.toContain('L');
  expect(auditMetricPlot([run], 'failures').points[0]?.x).toBe(160);
  expect(auditMetricPlot([], 'failures').points).toEqual([]);
});

test('invalid history is rejected instead of silently erasing it', () => {
  const run = auditMetricRun(makePerformanceAuditReport());
  const encode = (runs: unknown[]) => JSON.stringify({ schemaVersion: 1, runs });
  expect(parseAuditMetricHistory(encode([run]))).toEqual([run]);
  for (const invalid of [{ ...run, finishedAt: 'bad' }, { ...run, metrics: {} },
    { ...run, metrics: { ...run.metrics, coveragePercent: 101 } }]) {
    expect(() => parseAuditMetricHistory(encode([invalid]))).toThrow('Invalid audit');
  }
});
