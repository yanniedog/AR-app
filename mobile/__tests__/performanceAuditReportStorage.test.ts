import * as FileSystem from 'expo-file-system/legacy';
import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { clearCompletedPerformanceAudit, loadCompletedPerformanceAudit, saveCompletedPerformanceAudit } from '../src/lib/performanceAuditReportStorage';
import { buildPerformanceAuditCompletion } from '../src/lib/performanceAuditCompletion';

const files = new Map<string, string>();
const path = 'file:///docs/logs/ar-performance-audit-completed.json';
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
