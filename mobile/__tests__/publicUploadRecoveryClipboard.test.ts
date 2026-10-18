import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'locked-device-only',
  getItemAsync: jest.fn(async (key: string) => mockSecure.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockSecure.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockSecure.delete(key); }),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('../src/lib/debugLog', () => ({
  debugLog: { readCompleteText: jest.fn(), warn: jest.fn() },
  deleteDebugLogUpload: jest.fn(), formatVersionedLogExport: jest.fn(), loadDebugLogUploadReceipts: jest.fn(),
  markDebugLogUploadReceiptVerified: jest.fn(), saveDebugLogUploadReceipt: jest.fn(), uploadDebugLog: jest.fn(), verifyDebugLogUpload: jest.fn(),
}));
const report = makePerformanceAuditReport('complete');
const result = { url: 'https://paste.c-net.org/recovery', provider: 'paste.c-net.org' as const, deleteKey: 'private-capability',
  truncated: false, clientTruncated: false, originalBytes: 100, uploadedBytes: 100, attempts: 1 };
function reload() {
  jest.resetModules();
  const log: typeof import('../src/lib/debugLog') = require('../src/lib/debugLog');
  jest.mocked(log.loadDebugLogUploadReceipts).mockResolvedValue([]);
  jest.mocked(log.uploadDebugLog).mockResolvedValue(result);
  jest.mocked(log.saveDebugLogUploadReceipt).mockImplementation(async (_result, createdAt, hash) => ({ ...result, schemaVersion: 1,
    createdAt: createdAt ?? new Date().toISOString(), contentSha256: hash }));
  jest.mocked(log.markDebugLogUploadReceiptVerified).mockImplementation(async receipt => ({ ...receipt, verified: true }));
  jest.mocked(log.verifyDebugLogUpload).mockResolvedValue(undefined);
  return { log, sharing: require('../src/lib/debugLogSharing') as typeof import('../src/lib/debugLogSharing'),
    delivery: require('../src/lib/performanceAuditSharing') as typeof import('../src/lib/performanceAuditSharing'),
    clipboard: require('expo-clipboard') as typeof import('expo-clipboard') };
}
beforeEach(() => { mockSecure.clear(); jest.clearAllMocks(); });
it('automatic verified publication preserves the clipboard until an explicit Copy link action', async () => {
  const { log, sharing, delivery, clipboard } = reload();
  await delivery.uploadCompletedPerformanceAudit(report);
  expect(sharing.getDebugLogUploadSnapshot()).toMatchObject({ phase: 'verified', verified: true });
  expect(clipboard.setStringAsync).not.toHaveBeenCalled();
  await sharing.retryDebugLogUpload();
  expect(clipboard.setStringAsync).toHaveBeenCalledTimes(1);
  expect(clipboard.setStringAsync).toHaveBeenCalledWith(result.url);
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
  expect(log.verifyDebugLogUpload).toHaveBeenCalledTimes(1);
});
it('secure fallback deletion access survives restart when primary receipt storage and cleanup fail', async () => {
  let modules = reload();
  jest.mocked(modules.log.saveDebugLogUploadReceipt).mockRejectedValueOnce(new Error('primary storage full'));
  jest.mocked(modules.log.deleteDebugLogUpload).mockRejectedValueOnce(new Error('offline'));
  await modules.delivery.uploadCompletedPerformanceAudit(report);
  expect(modules.sharing.getDebugLogUploadSnapshot()).toMatchObject({ recoveryReceipt: { deleteKey: result.deleteKey } });
  expect([...mockSecure.values()].some(value => value.includes(result.deleteKey))).toBe(true);
  modules = reload();
  await modules.delivery.restorePerformanceAuditUpload(report);
  expect(modules.sharing.getDebugLogUploadSnapshot()).toMatchObject({ recoveryReceipt: { url: result.url, deleteKey: result.deleteKey } });
  await modules.delivery.uploadCompletedPerformanceAudit({ ...report, sessionId: 'next' });
  expect(modules.log.uploadDebugLog).not.toHaveBeenCalled();
  expect(modules.clipboard.setStringAsync).not.toHaveBeenCalled();
});

it('an old in-flight upload cannot recreate its intent after the full Clear completes', async () => {
  const { log, delivery } = reload();
  let rejectPost!: (error: Error) => void;
  jest.mocked(log.uploadDebugLog).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPost = reject; }));
  const upload = delivery.uploadCompletedPerformanceAudit(report);
  for (let tick = 0; tick < 100 && !rejectPost; tick++) await Promise.resolve();
  expect(rejectPost).toBeDefined();
  const journal = require('../src/lib/publicReportUploadAttempt') as typeof import('../src/lib/publicReportUploadAttempt');
  const hash = delivery.performanceAuditUploadRequest(report).publicReport.contentSha256;
  const finish = journal.beginPublicReportUploadAttemptsClear();
  await finish();
  rejectPost(new Error('offline')); await upload;
  expect(await journal.publicReportUploadAttempt(hash)).toBeNull();
});

it('reports unavailable durable recovery honestly when both SecureStore receipt paths reject', async () => {
  const { log, sharing, delivery, clipboard } = reload();
  jest.mocked(log.saveDebugLogUploadReceipt).mockRejectedValueOnce(new Error('primary unavailable'));
  jest.mocked(log.deleteDebugLogUpload).mockRejectedValueOnce(new Error('offline'));
  const secure = require('expo-secure-store') as typeof import('expo-secure-store');
  jest.mocked(secure.setItemAsync).mockRejectedValueOnce(new Error('recovery unavailable'));
  await delivery.uploadCompletedPerformanceAudit(report);
  expect(sharing.getDebugLogUploadSnapshot()).toMatchObject({ phase: 'failed', recoveryReceipt: { deleteKey: result.deleteKey },
    error: 'Secure deletion recovery is unavailable. Keep this app open and use Delete uploaded log in Debug log before restarting.' });
  expect(mockSecure.size).toBe(0);
  expect(clipboard.setStringAsync).not.toHaveBeenCalled();
});

it('Clear forgets a completed public report retry and suppresses a late verified completion while retaining its deletion receipt', async () => {
  let modules = reload();
  await modules.delivery.uploadCompletedPerformanceAudit(report);
  modules.sharing.resetClearedPublicReportUpload();
  await modules.sharing.retryDebugLogUpload();
  expect(modules.sharing.getDebugLogUploadSnapshot()).toMatchObject({ phase: 'idle', sessionId: null });
  expect(modules.clipboard.setStringAsync).not.toHaveBeenCalled();
  modules = reload();
  let finishPost!: (value: typeof result) => void;
  jest.mocked(modules.log.uploadDebugLog).mockImplementationOnce(() => new Promise(resolve => { finishPost = resolve; }));
  const upload = modules.delivery.uploadCompletedPerformanceAudit(report);
  for (let tick = 0; tick < 100 && !finishPost; tick++) await Promise.resolve();
  expect(finishPost).toBeDefined();
  const journal = require('../src/lib/publicReportUploadAttempt') as typeof import('../src/lib/publicReportUploadAttempt');
  const finishClear = journal.beginPublicReportUploadAttemptsClear();
  modules.sharing.resetClearedPublicReportUpload();
  await finishClear();
  finishPost(result); await upload;
  expect(modules.log.saveDebugLogUploadReceipt).toHaveBeenCalledWith(result, undefined, expect.any(String));
  expect(modules.sharing.getDebugLogUploadSnapshot()).toMatchObject({ phase: 'idle', sessionId: null });
  await modules.sharing.retryDebugLogUpload();
  expect(modules.clipboard.setStringAsync).not.toHaveBeenCalled();
  expect(modules.log.uploadDebugLog).toHaveBeenCalledTimes(1);
  expect(modules.log.verifyDebugLogUpload).not.toHaveBeenCalled();
});
