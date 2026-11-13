import * as FileSystem from 'expo-file-system/legacy';
import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { clearCompletedPerformanceAudit, loadCompletedPerformanceAudit, saveCompletedPerformanceAudit, loadPerformanceAuditHistory } from '../src/lib/performanceAuditReportStorage';
import { buildPerformanceAuditCompletion } from '../src/lib/performanceAuditCompletion';
import { auditMetricRun } from '../src/lib/auditMetricHistory';

const files = new Map<string, string>();
const path = 'file:///docs/logs/ar-performance-audit-completed.json';
const historyPath = 'file:///docs/logs/ar-audit-metric-history.json';
beforeEach(() => {
  files.clear(); jest.clearAllMocks();
  jest.mocked(FileSystem.getInfoAsync).mockImplementation(async file => ({ exists: files.has(file) }) as any);
  jest.mocked(FileSystem.writeAsStringAsync).mockImplementation(async (file, body) => { files.set(file, body); });
  jest.mocked(FileSystem.readAsStringAsync).mockImplementation(async file => {
    if (!files.has(file)) throw new Error('missing'); return files.get(file)!;
  });
  jest.mocked(FileSystem.deleteAsync).mockImplementation(async file => { files.delete(file); });
  jest.mocked(FileSystem.moveAsync).mockImplementation(async ({ from, to }) => {
    if (!files.has(from)) throw new Error('missing staged report');
    files.set(to, files.get(from)!); files.delete(from);
  });
});

test('raw-report recovery retains collector provenance and never upgrades persisted legacy methods', async () => {
  const old = makePerformanceAuditReport('legacy-methods');
  delete old.renderingEvidenceVersion;
  files.set(path, JSON.stringify(old));
  const recovered = (await loadPerformanceAuditHistory())[0];
  expect(recovered.methodVersions.displayModelPassPercent).toBe(1);
  expect(recovered.methodVersions.actionP95Ms).toBe(2);
  const legacy = { ...auditMetricRun(old), metrics: { ...recovered.metrics, actionP95Ms: 321 } };
  files.set(historyPath, JSON.stringify({ schemaVersion: 2, runs: [legacy] }));
  const restored = (await loadPerformanceAuditHistory())[0];
  expect(restored.methodVersions.actionP95Ms).toBe(1);
  expect(restored.metrics.actionP95Ms).toBe(321);
  const fresh = makePerformanceAuditReport('fresh-methods');
  fresh.finishedAt = '2026-10-31T10:34:28.796Z';
  await saveCompletedPerformanceAudit(fresh);
  const history = await loadPerformanceAuditHistory();
  expect(history.find(run => run.sessionId === old.sessionId)?.methodVersions.displayModelPassPercent).toBe(1);
  expect(history.find(run => run.sessionId === old.sessionId)?.metrics.actionP95Ms).toBe(321);
  expect(history.find(run => run.sessionId === fresh.sessionId)?.methodVersions.displayModelPassPercent).toBe(2);
  expect(JSON.parse(files.get(path)!).renderingEvidenceVersion).toBe(2);
});

test('history retains both completed runs, deduplicates rerender recovery and clears with diagnostics', async () => {
  const first = makePerformanceAuditReport('first');
  const second = { ...first, sessionId: 'second', finishedAt: '2026-10-31T10:34:28.796Z' };
  await saveCompletedPerformanceAudit(first);
  await saveCompletedPerformanceAudit(second);
  await saveCompletedPerformanceAudit(second);
  files.delete(path);
  expect((await loadPerformanceAuditHistory()).map(run => run.sessionId)).toEqual(['first', 'second']);
  await clearCompletedPerformanceAudit();
  expect(files.has(historyPath)).toBe(false);
  expect(await loadPerformanceAuditHistory()).toEqual([]);
});

test('pre-upgrade latest report supplies one honest history point and survives the next save', async () => {
  const old = makePerformanceAuditReport('pre-upgrade');
  files.set(path, JSON.stringify(old));
  expect((await loadPerformanceAuditHistory()).map(run => run.sessionId)).toEqual(['pre-upgrade']);
  await saveCompletedPerformanceAudit({ ...old, sessionId: 'new', finishedAt: '2026-10-31T10:34:28.796Z' });
  expect((await loadPerformanceAuditHistory()).map(run => run.sessionId)).toEqual(['pre-upgrade', 'new']);
});

test('a corrupt history surfaces an error and is not overwritten by a new run', async () => {
  const previous = makePerformanceAuditReport('previous');
  files.set(path, JSON.stringify(previous));
  files.set(historyPath, '{broken');
  await expect(saveCompletedPerformanceAudit(makePerformanceAuditReport())).rejects.toThrow();
  expect(files.get(historyPath)).toBe('{broken');
  await expect(loadPerformanceAuditHistory()).rejects.toThrow();
  expect(await loadCompletedPerformanceAudit()).toEqual(previous);
  expect(files.has(`${path}.tmp`)).toBe(false);
});

test('a complete staged history is recovered after an interrupted rename', async () => {
  await saveCompletedPerformanceAudit(makePerformanceAuditReport('retained'));
  files.set(`${historyPath}.tmp`, files.get(historyPath)!);
  files.set(historyPath, '{broken');
  files.delete(path);
  expect((await loadPerformanceAuditHistory())[0].sessionId).toBe('retained');
});

test('valid metric history remains available when the optional completed copy is corrupt', async () => {
  await saveCompletedPerformanceAudit(makePerformanceAuditReport('retained'));
  files.set(path, '{broken');
  expect((await loadPerformanceAuditHistory()).map(run => run.sessionId)).toEqual(['retained']);
});

test('saving migrates canonical and staged reports before replacing either copy', async () => {
  const first = makePerformanceAuditReport('canonical');
  const staged = { ...first, sessionId: 'staged', finishedAt: '2026-10-31T10:34:28.796Z' };
  const next = { ...first, sessionId: 'next', finishedAt: '2026-10-31T10:35:28.796Z' };
  files.set(path, JSON.stringify(first));
  files.set(`${path}.tmp`, JSON.stringify(staged));
  const write = jest.mocked(FileSystem.writeAsStringAsync).getMockImplementation()!;
  jest.mocked(FileSystem.writeAsStringAsync).mockImplementation(async (file, body, options) => {
    if (file === `${path}.tmp`) {
      expect(JSON.parse(files.get(historyPath)!).runs.map((run: { sessionId: string }) => run.sessionId))
        .toEqual(['canonical', 'staged', 'next']);
      throw new Error('process stopped before report replacement');
    }
    return write(file, body, options);
  });
  await expect(saveCompletedPerformanceAudit(next)).rejects.toThrow('process stopped');
  expect(JSON.parse(files.get(path)!).sessionId).toBe('canonical');
  expect(JSON.parse(files.get(`${path}.tmp`)!).sessionId).toBe('staged');
  files.delete(path); files.delete(`${path}.tmp`);
  expect((await loadPerformanceAuditHistory()).map(run => run.sessionId)).toEqual(['canonical', 'staged', 'next']);
});

test.each(['read', 'history write'] as const)('a failed %s preserves both completed-report recovery files', async failure => {
  const first = makePerformanceAuditReport('canonical');
  const staged = { ...first, sessionId: 'staged' };
  const original = JSON.stringify(first), temporary = JSON.stringify(staged);
  files.set(path, original); files.set(`${path}.tmp`, temporary);
  if (failure === 'read') jest.mocked(FileSystem.readAsStringAsync).mockRejectedValueOnce(new Error('storage unavailable'));
  else jest.mocked(FileSystem.writeAsStringAsync).mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(saveCompletedPerformanceAudit({ ...first, sessionId: 'next' })).rejects.toThrow('storage unavailable');
  expect(files.get(path)).toBe(original);
  expect(files.get(`${path}.tmp`)).toBe(temporary);
});

test('the completed diagnosis is restored from local storage and never replaced by a later partial sidecar', async () => {
  const report = makePerformanceAuditReport();
  await saveCompletedPerformanceAudit(report);
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'partial=true', reportJson: '{}' }));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
});

test('legacy recovered optional evidence remains retained and reviewable as incomplete', async () => {
  const report = { ...makePerformanceAuditReport(), coverage: {}, appHealth: {} };
  files.set(path, JSON.stringify(report));
  const recovered = await loadCompletedPerformanceAudit();
  expect(recovered).toEqual(report);
  expect(buildPerformanceAuditCompletion(recovered!)).toMatchObject({ outcome: 'incomplete',
    collectionComplete: false, coverageComplete: false, detailsComplete: false,
    gaps: { invalidCoverageReports: 1, invalidHealthReports: 1 } });
  expect(JSON.parse(files.get(path)!)).toEqual(report);
});

test('upgrades can recover the existing complete sidecar without an upload or new audit', async () => {
  const report = makePerformanceAuditReport();
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'PERFORMANCE_AUDIT_SUMMARY', reportJson: JSON.stringify(report) }));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
  expect(JSON.parse(files.get(path)!)).toEqual(report);
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'partial=true', reportJson: '{}' }));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
});

test('a previous partial audit is never promoted to a completed report', async () => {
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'partial=true', reportJson: JSON.stringify(makePerformanceAuditReport()) }));
  expect(await loadCompletedPerformanceAudit()).toBeNull();
});

test('an interrupted recovery-file write is repaired before a later partial report replaces the canonical copy', async () => {
  const report = makePerformanceAuditReport();
  files.set(path, '{truncated');
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'PERFORMANCE_AUDIT_SUMMARY', reportJson: JSON.stringify(report) }));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'partial=true', reportJson: '{}' }));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
});

test('failed recovery-file repair keeps the completed report reviewable and can repair on the next load', async () => {
  const report = makePerformanceAuditReport();
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'PERFORMANCE_AUDIT_SUMMARY', reportJson: JSON.stringify(report) }));
  jest.mocked(FileSystem.writeAsStringAsync).mockRejectedValueOnce(new Error('disk full'));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
  expect(files.has(path)).toBe(false);
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
  expect(JSON.parse(files.get(path)!)).toEqual(report);
});

test.each(['completed', 'canonical'] as const)('Clear during a %s read cannot restore or rewrite the cleared report', async source => {
  const report = makePerformanceAuditReport();
  const stored = source === 'completed' ? JSON.stringify(report) : JSON.stringify({ summaryMarker: 'PERFORMANCE_AUDIT_SUMMARY', reportJson: JSON.stringify(report) });
  files.set(source === 'completed' ? path : 'file:///docs/logs/ar-performance-audit-latest.json', stored);
  let finish!: () => void;
  jest.mocked(FileSystem.readAsStringAsync).mockImplementationOnce(async () => {
    await new Promise<void>(resolve => { finish = resolve; }); return stored;
  });
  const reading = loadCompletedPerformanceAudit();
  while (!finish) await Promise.resolve();
  await clearCompletedPerformanceAudit();
  finish();
  expect(await reading).toBeNull();
  expect(files.has(path)).toBe(false);
  expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
});

test('a slow canonical recovery cannot overwrite a newer completed diagnosis', async () => {
  const oldReport = makePerformanceAuditReport('older');
  const newReport = { ...makePerformanceAuditReport('newer'), finishedAt: '2026-10-15T20:00:00Z' };
  const stored = JSON.stringify({ summaryMarker: 'PERFORMANCE_AUDIT_SUMMARY', reportJson: JSON.stringify(oldReport) });
  files.set('file:///docs/logs/ar-performance-audit-latest.json', stored);
  let finish!: () => void;
  jest.mocked(FileSystem.readAsStringAsync).mockImplementationOnce(async () => {
    await new Promise<void>(resolve => { finish = resolve; }); return stored;
  });
  const recovering = loadCompletedPerformanceAudit();
  while (!finish) await Promise.resolve();
  await saveCompletedPerformanceAudit(newReport);
  finish();
  expect(await recovering).toBeNull();
  expect(await loadCompletedPerformanceAudit()).toEqual(newReport);
});

test('restart after canonical finalization repairs an older valid completed copy and retains the newer diagnosis through a partial run', async () => {
  const oldReport = makePerformanceAuditReport('older');
  const newReport = { ...makePerformanceAuditReport('newer'), finishedAt: '2026-10-15T20:00:00Z' };
  await saveCompletedPerformanceAudit(oldReport);
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'PERFORMANCE_AUDIT_SUMMARY', reportJson: JSON.stringify(newReport) }));
  expect(await loadCompletedPerformanceAudit()).toEqual(newReport);
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'partial=true', reportJson: '{}' }));
  expect(await loadCompletedPerformanceAudit()).toEqual(newReport);
});

test('a corrupt latest sidecar cannot hide the valid completed recovery copy', async () => {
  const report = makePerformanceAuditReport();
  await saveCompletedPerformanceAudit(report);
  files.set('file:///docs/logs/ar-performance-audit-latest.json', '{truncated');
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
});

test('Clear waits for a pending write and deletes the finished report without resurrection', async () => {
  let finish!: () => void;
  jest.mocked(FileSystem.writeAsStringAsync).mockImplementationOnce(async (file, body) => {
    await new Promise<void>(resolve => { finish = resolve; }); files.set(file, body);
  });
  const write = saveCompletedPerformanceAudit(makePerformanceAuditReport());
  while (!finish) await Promise.resolve();
  const clear = clearCompletedPerformanceAudit();
  finish(); await Promise.all([write, clear]);
  expect(files.has(path)).toBe(false);
});

test('saves during the complete Clear transaction cannot resurrect a cleared diagnosis', async () => {
  let finish!: () => void;
  const clear = clearCompletedPerformanceAudit(async () => { await new Promise<void>(resolve => { finish = resolve; }); });
  while (!finish) await Promise.resolve();
  await saveCompletedPerformanceAudit(makePerformanceAuditReport('during-clear'));
  finish(); await clear;
  expect(files.has(path)).toBe(false);
  await saveCompletedPerformanceAudit(makePerformanceAuditReport('after-clear'));
  expect(await loadCompletedPerformanceAudit()).toMatchObject({ sessionId: 'after-clear' });
});

test('an interrupted staged write preserves the prior completed diagnosis', async () => {
  const report = makePerformanceAuditReport();
  await saveCompletedPerformanceAudit(report);
  jest.mocked(FileSystem.writeAsStringAsync).mockImplementationOnce(async file => { files.set(file, '{partial'); throw new Error('process interrupted'); });
  await expect(saveCompletedPerformanceAudit({ ...report, sessionId: 'newer' })).rejects.toThrow('interrupted');
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'partial=true', reportJson: '{}' }));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
});

test('a complete staged copy survives an interrupted replacement and repairs the dedicated copy', async () => {
  const report = makePerformanceAuditReport();
  files.set(`${path}.tmp`, JSON.stringify(report));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
  expect(JSON.parse(files.get(path)!)).toEqual(report);
});

test.each([
  { finishedAt: 'invalid' }, { summary: { overall: 'healthy' } }, { checks: [{ id: 'incomplete', metrics: {} }] },
  { environment: {} }, { routeAggregates: [{}] }, { limitations: 'invalid' },
])('a malformed newer sidecar cannot replace a valid completed report: %j', async malformed => {
  const report = makePerformanceAuditReport();
  await saveCompletedPerformanceAudit(report);
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'PERFORMANCE_AUDIT_SUMMARY',
    reportJson: JSON.stringify({ ...report, finishedAt: '2026-10-16T20:00:00Z', ...malformed }) }));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
});

test('a complete supported schema-6 sidecar is migrated into the current dedicated recovery copy', async () => {
  const report = makePerformanceAuditReport();
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'PERFORMANCE_AUDIT_SUMMARY',
    reportJson: JSON.stringify({ ...report, schemaVersion: 6 }) }));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
  expect(JSON.parse(files.get(path)!)).toEqual(report);
});
