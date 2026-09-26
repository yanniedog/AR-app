jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('../src/lib/debugLog', () => ({
  debugLog: { readCompleteText: jest.fn(), warn: jest.fn() },
  deleteDebugLogUpload: jest.fn(),
  formatVersionedLogExport: jest.fn((text: string) => `versioned\n${text}`),
  loadDebugLogUploadReceipts: jest.fn(),
  markDebugLogUploadReceiptVerified: jest.fn(),
  saveDebugLogUploadReceipt: jest.fn(),
  uploadDebugLog: jest.fn(),
  verifyDebugLogUpload: jest.fn(),
}));

describe('automatic audit log sharing', () => {
  const result = {
    url: 'https://paste.c-net.org/test', provider: 'paste.c-net.org', deleteKey: 'test-key',
    truncated: false, clientTruncated: false, originalBytes: 500_000, uploadedBytes: 500_000,
  };
  const receipt = { ...result, schemaVersion: 1, createdAt: '2026-09-26T00:00:00Z' };
  let log: typeof import('../src/lib/debugLog');
  let sharing: typeof import('../src/lib/debugLogSharing');
  let clipboard: typeof import('expo-clipboard');
  const request = {
    sessionId: 'audit-1', appVersion: '1.2.3', buildVersion: '456',
    audit: { summaryMarker: 'SUMMARY audit-1', report: { sessionId: 'audit-1', checks: ['last-check'] } },
  };

  beforeEach(() => {
    jest.resetModules();
    log = require('../src/lib/debugLog');
    clipboard = require('expo-clipboard');
    sharing = require('../src/lib/debugLogSharing');
    (log.debugLog.readCompleteText as jest.Mock).mockResolvedValue('full-log-with-complete-report');
    (log.loadDebugLogUploadReceipts as jest.Mock).mockResolvedValue([]);
    (log.uploadDebugLog as jest.Mock).mockResolvedValue(result);
    (log.saveDebugLogUploadReceipt as jest.Mock).mockResolvedValue(receipt);
    (log.verifyDebugLogUpload as jest.Mock).mockResolvedValue(undefined);
    (log.markDebugLogUploadReceiptVerified as jest.Mock).mockResolvedValue({ ...receipt, verified: true });
    (log.deleteDebugLogUpload as jest.Mock).mockResolvedValue(undefined);
    (clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('exports the just-completed report, saves the receipt, verifies, then copies exactly the URL', async () => {
    const phases: string[] = [];
    const unsubscribe = sharing.subscribeDebugLogUpload(() => phases.push(sharing.getDebugLogUploadSnapshot().phase));
    const state = await sharing.startDebugLogUpload(request);
    expect(log.debugLog.readCompleteText).toHaveBeenCalledWith(request.audit);
    expect(log.uploadDebugLog).toHaveBeenCalledWith('versioned\nfull-log-with-complete-report');
    expect(log.verifyDebugLogUpload).toHaveBeenCalledWith(receipt, 'versioned\nfull-log-with-complete-report');
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(result.url);
    expect(phases).toEqual(expect.arrayContaining(['preparing', 'uploading', 'verifying', 'copying', 'copied']));
    expect((log.saveDebugLogUploadReceipt as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((log.verifyDebugLogUpload as jest.Mock).mock.invocationCallOrder[0]);
    expect((log.verifyDebugLogUpload as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((log.markDebugLogUploadReceiptVerified as jest.Mock).mock.invocationCallOrder[0]);
    expect((log.markDebugLogUploadReceiptVerified as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((clipboard.setStringAsync as jest.Mock).mock.invocationCallOrder[0]);
    expect(state).toMatchObject({ phase: 'copied', verified: true, sessionId: 'audit-1' });
    unsubscribe();
  });

  it('deduplicates active and completed runs while allowing the next audit to upload', async () => {
    await Promise.all([sharing.startDebugLogUpload(request), sharing.startDebugLogUpload(request)]);
    await sharing.startDebugLogUpload(request);
    expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
    await sharing.startDebugLogUpload({ ...request, sessionId: 'audit-2' });
    expect(log.uploadDebugLog).toHaveBeenCalledTimes(2);
    expect(log.deleteDebugLogUpload).not.toHaveBeenCalled();
  });

  it('never copies a broken link and retries only its read-back, without reposting or deleting it', async () => {
    (log.verifyDebugLogUpload as jest.Mock).mockRejectedValueOnce(new Error('404 missing'));
    expect(await sharing.startDebugLogUpload(request)).toMatchObject({ phase: 'failed', error: '404 missing' });
    expect(clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(log.markDebugLogUploadReceiptVerified).not.toHaveBeenCalled();
    expect(await sharing.retryDebugLogUpload()).toMatchObject({ phase: 'copied' });
    expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
    expect(log.verifyDebugLogUpload).toHaveBeenCalledTimes(2);
    expect(log.deleteDebugLogUpload).not.toHaveBeenCalled();
  });

  it('retries only clipboard access if upload and verification already succeeded', async () => {
    (clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(new Error('clipboard unavailable'));
    expect(await sharing.startDebugLogUpload(request)).toMatchObject({ phase: 'failed', verified: true });
    expect(await sharing.retryDebugLogUpload()).toMatchObject({ phase: 'copied' });
    expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
    expect(log.verifyDebugLogUpload).toHaveBeenCalledTimes(1);
    expect(clipboard.setStringAsync).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed upload separate from the completed audit and permits an explicit retry', async () => {
    (log.uploadDebugLog as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    expect(await sharing.startDebugLogUpload(request)).toMatchObject({ phase: 'failed', error: 'offline', url: null });
    expect(clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(await sharing.retryDebugLogUpload()).toMatchObject({ phase: 'copied' });
  });

  it('does not claim the link was copied when the clipboard returns false', async () => {
    (clipboard.setStringAsync as jest.Mock).mockResolvedValueOnce(false);
    expect(await sharing.startDebugLogUpload(request)).toMatchObject({ phase: 'failed', verified: true });
  });

  it('requires an explicit duplicate-copy acknowledgement after an ambiguous POST failure', async () => {
    (log.uploadDebugLog as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('response lost'), { mayHaveUploaded: true }),
    );
    expect(await sharing.startDebugLogUpload(request)).toMatchObject({ phase: 'failed', mayHaveUploaded: true });
    await sharing.retryDebugLogUpload();
    expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
    expect(await sharing.retryDebugLogUpload({ acceptDuplicateRisk: true })).toMatchObject({ phase: 'copied' });
    expect(log.uploadDebugLog).toHaveBeenCalledTimes(2);
  });

  it('does not upload when existing deletion receipts cannot be read', async () => {
    (log.loadDebugLogUploadReceipts as jest.Mock).mockRejectedValueOnce(new Error('locked'));
    expect(await sharing.startDebugLogUpload(request)).toMatchObject({ phase: 'failed' });
    expect(log.uploadDebugLog).not.toHaveBeenCalled();
  });

  it('cleans up only the newly created paste if secure receipt storage fails', async () => {
    (log.saveDebugLogUploadReceipt as jest.Mock).mockRejectedValueOnce(new Error('storage failed'));
    expect(await sharing.startDebugLogUpload(request)).toMatchObject({ phase: 'failed', url: null });
    expect(log.deleteDebugLogUpload).toHaveBeenCalledWith(result.url, result.deleteKey);
    expect(clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it('preserves recovery access if both receipt storage and paste cleanup fail', async () => {
    (log.saveDebugLogUploadReceipt as jest.Mock).mockRejectedValueOnce(new Error('storage failed'));
    (log.deleteDebugLogUpload as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    expect(await sharing.startDebugLogUpload(request)).toMatchObject({
      phase: 'failed', recoveryReceipt: { url: result.url, deleteKey: result.deleteKey },
    });
    await sharing.retryDebugLogUpload();
    expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
    expect(clipboard.setStringAsync).not.toHaveBeenCalled();
    const laterRequest = { ...request, sessionId: 'audit-2', audit: { summaryMarker: 'SUMMARY audit-2', report: { sessionId: 'audit-2', checks: ['new-check'] } } };
    expect(await sharing.startDebugLogUpload(laterRequest)).toMatchObject({
      phase: 'failed', sessionId: 'audit-2',
      recoveryReceipt: { url: result.url, deleteKey: result.deleteKey },
    });
    expect(log.uploadDebugLog).toHaveBeenCalledTimes(1);
    sharing.forgetDeletedDebugLogUpload(result.url);
    expect(sharing.getDebugLogUploadSnapshot()).toMatchObject({ phase: 'failed', sessionId: 'audit-2', recoveryReceipt: null });
    expect(await sharing.retryDebugLogUpload()).toMatchObject({ phase: 'copied', sessionId: 'audit-2' });
    expect(log.debugLog.readCompleteText).toHaveBeenLastCalledWith(laterRequest.audit);
  });
});
