import * as FileSystem from 'expo-file-system/legacy';
import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { clearCompletedPerformanceAudit, loadCompletedPerformanceAudit, saveCompletedPerformanceAudit } from '../src/lib/performanceAuditReportStorage';

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
});

test('the completed diagnosis is restored from local storage and never replaced by a later partial sidecar', async () => {
  const report = makePerformanceAuditReport();
  await saveCompletedPerformanceAudit(report);
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'partial=true', reportJson: '{}' }));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
});

test('upgrades can recover the existing complete sidecar without an upload or new audit', async () => {
  const report = makePerformanceAuditReport();
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'PERFORMANCE_AUDIT_SUMMARY', reportJson: JSON.stringify(report) }));
  expect(await loadCompletedPerformanceAudit()).toEqual(report);
  expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
});

test('a previous partial audit is never promoted to a completed report', async () => {
  files.set('file:///docs/logs/ar-performance-audit-latest.json', JSON.stringify({ summaryMarker: 'partial=true', reportJson: JSON.stringify(makePerformanceAuditReport()) }));
  expect(await loadCompletedPerformanceAudit()).toBeNull();
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
