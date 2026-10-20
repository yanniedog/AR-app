import AsyncStorage from '@react-native-async-storage/async-storage';
import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';
const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  clear: jest.fn(async () => { mockStorage.clear(); }),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('../src/lib/debugLog', () => ({
  debugLog: { readCompleteText: jest.fn(async () => 'RAW SECRET MUST NEVER LEAVE'), warn: jest.fn() },
  deleteDebugLogUpload: jest.fn(), formatVersionedLogExport: jest.fn(),
  loadDebugLogUploadReceipts: jest.fn(), markDebugLogUploadReceiptVerified: jest.fn(),
  saveDebugLogUploadReceipt: jest.fn(), uploadDebugLog: jest.fn(), verifyDebugLogUpload: jest.fn(),
}));

const report = makePerformanceAuditReport('private-session', [{
  id: 'journey-rates-cold', label: 'Private user@example.com', kind: 'journey', status: 'fail', durationMs: 300,
  error: 'Bearer secret-token', trace: 'raw traceback', metrics: { maxEventLoopLagMs: 300,
    eventLoopSamples: 2, product_key: 'private-product', expectedPath: '/profile/private', account: 'secret' },
}]);
const result = { url: 'https://paste.c-net.org/fixture', provider: 'paste.c-net.org', deleteKey: 'private-delete',
  truncated: false, clientTruncated: false, originalBytes: 100, uploadedBytes: 100 };
let receipts: any[];
let log: typeof import('../src/lib/debugLog');
let sharing: typeof import('../src/lib/debugLogSharing');
let delivery: typeof import('../src/lib/performanceAuditSharing');
function reload() {
  jest.resetModules();
  log = jest.requireMock('../src/lib/debugLog');
  sharing = jest.requireActual('../src/lib/debugLogSharing');
  delivery = jest.requireActual('../src/lib/performanceAuditSharing');
  jest.mocked(log.loadDebugLogUploadReceipts).mockImplementation(async () => receipts);
  jest.mocked(log.uploadDebugLog).mockResolvedValue(result as any);
  jest.mocked(log.saveDebugLogUploadReceipt).mockImplementation(async (uploaded, _date, contentSha256) => {
    const receipt = { ...uploaded, schemaVersion: 1 as const, provider: 'paste.c-net.org' as const,
      createdAt: '2026-10-15T18:00:00Z', contentSha256 };
    receipts.push(receipt); return receipt;
  });
  jest.mocked(log.verifyDebugLogUpload).mockResolvedValue(undefined);
  jest.mocked(log.markDebugLogUploadReceiptVerified).mockImplementation(async receipt => {
    const verified = { ...receipt, verified: true };
    receipts = receipts.map(item => item.url === receipt.url ? verified : item); return verified;
  });
}
beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); receipts = []; reload(); });

test('automatic dispatch alone uploads and verifies only the complete sanitized body', async () => {
  delivery.startPerformanceAuditLogUpload(true, { sessionId: report.sessionId, ...report.app,
    audit: { report, summaryMarker: 'PRIVATE RAW MARKER' } });
  for (let turn = 0; turn < 100 && !sharing.getDebugLogUploadSnapshot().verified; turn++) await Promise.resolve();
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
  expect(log.debugLog.readCompleteText).not.toHaveBeenCalled();
  const body = jest.mocked(log.uploadDebugLog).mock.calls[0][0];
  const decoded = decodeCompactDiagnosticJson(body) as any;
  expect(decoded.checks[0]).toMatchObject({ id: 'journey-rates-cold', status: 'fail', metrics: { maxEventLoopLagMs: 300 } });
  expect(decoded.diagnosticLog.checks[0].trace).toMatch(/^~private/);
  expect(body).not.toContain('raw traceback');
  expect(decoded.diagnosticLog.checks[0].metrics.account).not.toBe('secret');
  for (const text of ['private-session', 'private-product', 'secret-token', 'RAW SECRET MUST NEVER LEAVE', 'user@example.com', '/profile/private']) expect(body).not.toContain(text);
  expect(sharing.getDebugLogUploadSnapshot()).toMatchObject({ verified: true, url: result.url });
  expect(log.verifyDebugLogUpload).toHaveBeenCalledWith(expect.any(Object), body);
});

test('concurrent manual post-completion requests share one upload', async () => {
  await Promise.all([delivery.uploadCompletedPerformanceAudit(report), delivery.uploadCompletedPerformanceAudit(report)]);
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
  expect(log.verifyDebugLogUpload).toHaveBeenCalledTimes(1);
  expect(sharing.getDebugLogUploadSnapshot()).toMatchObject({ verified: true, url: result.url });
});

test('a definite failure permits retry while preserving the completed report and using single flight', async () => {
  jest.mocked(log.uploadDebugLog).mockRejectedValueOnce(new Error('offline'));
  await delivery.uploadCompletedPerformanceAudit(report);
  expect(sharing.getDebugLogUploadSnapshot()).toMatchObject({ phase: 'failed', mayHaveUploaded: false });
  await Promise.all([sharing.retryDebugLogUpload(), sharing.retryDebugLogUpload()]);
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(2);
  expect(sharing.getDebugLogUploadSnapshot().verified).toBe(true);
});

test('a definite failed upload retains its status after restart and offers an ordinary retry', async () => {
  jest.mocked(log.uploadDebugLog).mockRejectedValueOnce(new Error('offline'));
  await delivery.uploadCompletedPerformanceAudit(report);
  reload();
  await delivery.restorePerformanceAuditUpload(report);
  expect(sharing.getDebugLogUploadSnapshot()).toMatchObject({ phase: 'failed', mayHaveUploaded: false, sessionId: report.sessionId });
  await sharing.retryDebugLogUpload();
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
});

test('restart restores a verified URL and copies it without another POST', async () => {
  await delivery.uploadCompletedPerformanceAudit(report);
  reload();
  await delivery.restorePerformanceAuditUpload(report);
  expect(sharing.getDebugLogUploadSnapshot()).toMatchObject({ url: result.url, verified: true });
  expect(log.verifyDebugLogUpload).not.toHaveBeenCalled();
  expect(jest.requireMock('expo-clipboard').setStringAsync).not.toHaveBeenCalled();
  await sharing.retryDebugLogUpload();
  expect(log.uploadDebugLog).not.toHaveBeenCalled();
});

test('an ambiguous response survives restart and blocks duplicate upload until explicitly acknowledged', async () => {
  jest.mocked(log.uploadDebugLog).mockRejectedValueOnce(Object.assign(new Error('lost POST response'), { mayHaveUploaded: true }));
  await delivery.uploadCompletedPerformanceAudit(report);
  reload();
  await delivery.uploadCompletedPerformanceAudit(report);
  await sharing.retryDebugLogUpload();
  expect(log.uploadDebugLog).not.toHaveBeenCalled();
  expect(sharing.getDebugLogUploadSnapshot()).toMatchObject({ phase: 'failed', mayHaveUploaded: true });
  await sharing.retryDebugLogUpload({ acceptDuplicateRisk: true });
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
});

test('a known unverified paste retries verification using its saved receipt instead of creating another copy', async () => {
  jest.mocked(log.verifyDebugLogUpload).mockRejectedValueOnce(new Error('GET unavailable'));
  await delivery.uploadCompletedPerformanceAudit(report);
  reload();
  await delivery.restorePerformanceAuditUpload(report);
  await sharing.retryDebugLogUpload();
  expect(log.uploadDebugLog).not.toHaveBeenCalled();
  expect(sharing.getDebugLogUploadSnapshot().verified).toBe(true);
});

test('failed report preparation cannot retry an earlier raw diagnostic request', async () => {
  jest.mocked(log.uploadDebugLog).mockRejectedValueOnce(new Error('offline'));
  await sharing.startDebugLogUpload({ sessionId: null, appVersion: '1', buildVersion: '1' });
  // Arbitrary text is now aliased. Preserve enough distinct numeric evidence to
  // cross the encoded cap without relying on private text surviving redaction.
  const tooLarge = makePerformanceAuditReport('new-report', [{ ...report.checks[0],
    metrics: { samples: Array.from({ length: 350_000 }, (_, index) => index + 0.123456789) } }]);
  await delivery.uploadCompletedPerformanceAudit(tooLarge);
  await sharing.retryDebugLogUpload();
  expect(sharing.getDebugLogUploadSnapshot()).toMatchObject({ preparationFailed: true, sessionId: 'new-report' });
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
  expect(log.debugLog.readCompleteText).toHaveBeenCalledTimes(1);
});

test('a confirmed deletion releases deduplication and leaves no orphan marker after restart', async () => {
  await delivery.uploadCompletedPerformanceAudit(report);
  receipts = [];
  sharing.forgetDeletedDebugLogUpload(result.url);
  await delivery.uploadCompletedPerformanceAudit(report);
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(2);
  receipts = []; reload();
  await delivery.uploadCompletedPerformanceAudit(report);
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
  expect(sharing.getDebugLogUploadSnapshot().mayHaveUploaded).toBe(false);
});

test('returning from an explicit manual log upload restores the report receipt instead of a no-op or duplicate', async () => {
  await delivery.uploadCompletedPerformanceAudit(report);
  jest.mocked(log.uploadDebugLog).mockResolvedValueOnce({ ...result, url: 'https://paste.c-net.org/manual' } as any);
  await sharing.startDebugLogUpload({ sessionId: null, appVersion: '1', buildVersion: '1' });
  expect(sharing.getDebugLogUploadSnapshot().sessionId).toBeNull();
  await delivery.uploadCompletedPerformanceAudit(report);
  expect(sharing.getDebugLogUploadSnapshot()).toMatchObject({ sessionId: report.sessionId, url: result.url, verified: true });
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(2);
});
