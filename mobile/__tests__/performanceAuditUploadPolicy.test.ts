import {
  completePerformanceAudit, getPerformanceAuditState, markPerformanceAuditRunning,
  requestPerformanceAudit, resetPerformanceAuditForTests,
} from '../src/lib/performanceAudit';
import { publishPerformanceAuditAfterFinalization } from '../src/lib/performanceAuditFinalization';
import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('../src/lib/debugLog', () => ({
  debugLog: { readCompleteText: jest.fn(), warn: jest.fn(), getEntries: () => [] },
  subscribeApplicationJournal: () => () => {},
  debugLogUploadShareUrl: (receipt: { url: string; shareUrl?: string }) => receipt.shareUrl ?? receipt.url,
  deleteDebugLogUpload: jest.fn(), formatVersionedLogExport: jest.fn((value: string) => value),
  loadDebugLogUploadReceipts: jest.fn(), markDebugLogUploadReceiptVerified: jest.fn(),
  saveDebugLogUploadReceipt: jest.fn(), uploadDebugLog: jest.fn(), verifyDebugLogUpload: jest.fn(),
}));

const fixtureReport = makePerformanceAuditReport;
const request = { sessionId: 'audit-fixture', appVersion: '1.0.0', buildVersion: '1',
  audit: { summaryMarker: 'SUMMARY audit-fixture', report: fixtureReport('audit-fixture') } };
const result = { url: 'https://paste.c-net.org/fixture', provider: 'paste.c-net.org', deleteKey: 'fixture-key',
  truncated: false, clientTruncated: false, originalBytes: 16, uploadedBytes: 16 };
const receipt = { ...result, schemaVersion: 1, createdAt: '2026-10-15T00:00:00Z' };
let log: typeof import('../src/lib/debugLog');
let sharing: typeof import('../src/lib/debugLogSharing');
let clipboard: typeof import('expo-clipboard');
let dispatch: typeof import('../src/lib/performanceAuditSharing').startPerformanceAuditLogUpload;
let performanceAuditUploadRequest: typeof import('../src/lib/performanceAuditSharing').performanceAuditUploadRequest;

beforeEach(() => {
  void AsyncStorage.clear();
  resetPerformanceAuditForTests();
  jest.resetModules();
  log = jest.requireMock('../src/lib/debugLog');
  clipboard = jest.requireMock('expo-clipboard');
  sharing = jest.requireActual('../src/lib/debugLogSharing');
  const auditSharing = jest.requireActual<typeof import('../src/lib/performanceAuditSharing')>('../src/lib/performanceAuditSharing');
  dispatch = auditSharing.startPerformanceAuditLogUpload;
  performanceAuditUploadRequest = auditSharing.performanceAuditUploadRequest;
  (log.debugLog.readCompleteText as jest.Mock).mockResolvedValue('fixture evidence');
  (log.loadDebugLogUploadReceipts as jest.Mock).mockResolvedValue([]);
  (log.uploadDebugLog as jest.Mock).mockResolvedValue(result);
  (log.saveDebugLogUploadReceipt as jest.Mock).mockResolvedValue(receipt);
  (log.verifyDebugLogUpload as jest.Mock).mockResolvedValue(undefined);
  (log.markDebugLogUploadReceiptVerified as jest.Mock).mockResolvedValue({ ...receipt, verified: true });
  (clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);
});

function expectLocalSharingUntouched(before: ReturnType<typeof sharing.getDebugLogUploadSnapshot>) {
  expect(sharing.getDebugLogUploadSnapshot()).toBe(before);
  expect(log.debugLog.readCompleteText).not.toHaveBeenCalled();
  expect(log.loadDebugLogUploadReceipts).not.toHaveBeenCalled();
  expect(log.uploadDebugLog).not.toHaveBeenCalled();
  expect(log.saveDebugLogUploadReceipt).not.toHaveBeenCalled();
  expect(log.verifyDebugLogUpload).not.toHaveBeenCalled();
  expect(clipboard.setStringAsync).not.toHaveBeenCalled();
}

test.each([undefined, true, false])('captures per-request uploadLog=%s with historical default true', uploadLog => {
  requestPerformanceAudit(uploadLog === undefined ? {} : { uploadLog });
  expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', uploadLog: uploadLog ?? true });
});

test('a repeated request cannot change an already queued or running publication choice', () => {
  const sessionId = requestPerformanceAudit({ uploadLog: false });
  expect(requestPerformanceAudit({ uploadLog: true })).toBe(sessionId);
  expect(getPerformanceAuditState().uploadLog).toBe(false);
  markPerformanceAuditRunning(1);
  expect(requestPerformanceAudit()).toBe(sessionId);
  expect(getPerformanceAuditState().uploadLog).toBe(false);
});

test('completion preserves the choice, while the next omitted option restores historical behavior', () => {
  const sessionId = requestPerformanceAudit({ uploadLog: false });
  completePerformanceAudit(fixtureReport(sessionId));
  expect(getPerformanceAuditState()).toMatchObject({ status: 'complete', uploadLog: false });
  requestPerformanceAudit();
  expect(getPerformanceAuditState()).toMatchObject({ status: 'queued', uploadLog: true });
});

test('local completion waits for the final flush and releases transport without entering sharing', async () => {
  requestPerformanceAudit({ uploadLog: false }); markPerformanceAuditRunning(1);
  const uploadLog = getPerformanceAuditState().uploadLog;
  const before = sharing.getDebugLogUploadSnapshot();
  let finish!: () => void;
  const localFlush = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const releaseTransport = jest.fn(() => expect(getPerformanceAuditState().status).toBe('running'));
  const report = fixtureReport(getPerformanceAuditState().sessionId!);
  const finalized = publishPerformanceAuditAfterFinalization(report, localFlush, releaseTransport);
  expect(getPerformanceAuditState().status).toBe('running');
  expect(releaseTransport).not.toHaveBeenCalled();
  finish(); await finalized;
  dispatch(uploadLog, request);
  expect(localFlush).toHaveBeenCalledTimes(1); expect(releaseTransport).toHaveBeenCalledTimes(1);
  expect(getPerformanceAuditState()).toMatchObject({ status: 'complete', report, uploadLog: false });
  expectLocalSharingUntouched(before);
});

test('automatic upload verifies the receipt before an explicit copy action without a duplicate upload', async () => {
  await dispatch(true, request);
  await dispatch(true, request);
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
  expect(log.debugLog.readCompleteText).not.toHaveBeenCalled();
  expect(log.verifyDebugLogUpload).toHaveBeenCalledWith(receipt, performanceAuditUploadRequest(request.audit.report).publicReport.body);
  expect(clipboard.setStringAsync).not.toHaveBeenCalled();
  await sharing.retryDebugLogUpload();
  expect(clipboard.setStringAsync).toHaveBeenCalledTimes(1);
  expect(clipboard.setStringAsync).toHaveBeenCalledWith(result.url);
  expect((log.saveDebugLogUploadReceipt as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((log.verifyDebugLogUpload as jest.Mock).mock.invocationCallOrder[0]);
  expect((log.verifyDebugLogUpload as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((clipboard.setStringAsync as jest.Mock).mock.invocationCallOrder[0]);
});

test('a local audit cannot queue itself behind a manual public upload already in flight', async () => {
  let finishUpload!: (value: typeof result) => void;
  (log.uploadDebugLog as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finishUpload = resolve; }));
  const manual = sharing.startDebugLogUpload({ ...request, sessionId: null, audit: undefined });
  for (let i = 0; i < 8 && !finishUpload; i++) await Promise.resolve();
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
  const before = sharing.getDebugLogUploadSnapshot();
  dispatch(false, request);
  expect(sharing.getDebugLogUploadSnapshot()).toBe(before);
  finishUpload(result); await manual; await Promise.resolve();
  expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
  expect(log.debugLog.readCompleteText).toHaveBeenCalledTimes(1);
  expect(sharing.getDebugLogUploadSnapshot().sessionId).toBeNull();
});

test('public upload failure cannot turn an already finalized audit into a failed measurement', async () => {
  const sessionId = requestPerformanceAudit({ uploadLog: true }); markPerformanceAuditRunning(1);
  const report = fixtureReport(sessionId);
  const localFlush = jest.fn(async () => undefined), releaseTransport = jest.fn();
  await publishPerformanceAuditAfterFinalization(report, localFlush, releaseTransport);
  (log.uploadDebugLog as jest.Mock).mockRejectedValueOnce(new Error('fixture public service offline'));
  dispatch(getPerformanceAuditState().uploadLog, request);
  await sharing.startDebugLogUpload(performanceAuditUploadRequest(request.audit.report));
  expect(sharing.getDebugLogUploadSnapshot().phase).toBe('failed');
  expect(getPerformanceAuditState()).toMatchObject({ status: 'complete', report, error: null });
  expect(localFlush).toHaveBeenCalledTimes(1); expect(releaseTransport).toHaveBeenCalledTimes(1);
  expect(clipboard.setStringAsync).not.toHaveBeenCalled();
});
