import * as SecureStore from 'expo-secure-store';
import {
  DEBUG_LOG_UPLOAD_RECEIPT_KEY,
  deleteDebugLogUploadAndReceipt,
  loadDebugLogUploadReceipts,
  markDebugLogUploadReceiptVerified,
  saveDebugLogUploadReceipt,
  verifyDebugLogUpload,
} from '../src/lib/debugLog';

describe('verified full paste read-back', () => {
  const receipt = {
    schemaVersion: 1 as const, url: 'https://paste.c-net.org/test',
    provider: 'paste.c-net.org' as const, deleteKey: 'deletion-capability',
    createdAt: '2026-09-26T00:00:00Z',
  };
  const options = { sleep: async () => {} };

  it('accepts only the exact full Unicode body and sends no deletion key on GET', async () => {
    const body = 'full-log-🙂\n' + 'audit'.repeat(200_000);
    const fetcher = jest.fn().mockResolvedValue({ status: 200, text: async () => body });
    await verifyDebugLogUpload(receipt, body, fetcher, options);
    expect(fetcher).toHaveBeenCalledWith(receipt.url, expect.objectContaining({ method: 'GET' }));
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('deletion-capability');
  });

  it('retries temporary 404 reads but never re-uploads', async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ status: 200, text: async () => 'full log' });
    await verifyDebugLogUpload(receipt, 'full log', fetcher, options);
    expect(fetcher.mock.calls.map((call) => call[1].method)).toEqual(['GET', 'GET']);
  });

  it.each([
    [404, 'missing'], [200, 'truncated'], [206, 'full log'], [200, '<html>error</html>'],
  ])('rejects unreadable or incomplete content (%s)', async (status, text) => {
    const fetcher = jest.fn().mockResolvedValue({ status, text: async () => text });
    await expect(verifyDebugLogUpload(receipt, 'full log', fetcher, options)).rejects.toThrow('not copied');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('bounds reads even if transport ignores abort', async () => {
    const fetcher = jest.fn().mockImplementation(() => new Promise(() => {}));
    await expect(verifyDebugLogUpload(receipt, 'log', fetcher, { ...options, attemptTimeoutMs: 1 }))
      .rejects.toThrow('timed out');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls.every((call) => call[1].signal.aborted)).toBe(true);
  });

  it('allows a slow full-body read beyond the former 20-second timeout', async () => {
    jest.useFakeTimers();
    try {
      const fetcher = jest.fn().mockResolvedValue({
        status: 200,
        text: () => new Promise((resolve) => setTimeout(() => resolve('full log'), 30_000)),
      });
      const verification = verifyDebugLogUpload(receipt, 'full log', fetcher);
      await jest.advanceTimersByTimeAsync(30_000);
      await expect(verification).resolves.toBeUndefined();
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('multiple upload deletion receipts', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync(DEBUG_LOG_UPLOAD_RECEIPT_KEY);
  });

  it('migrates legacy state, retains concurrent new receipts, and deletes only the chosen paste', async () => {
    const old = { schemaVersion: 1, url: 'https://paste.rs/old', provider: 'paste.rs', createdAt: '2026-09-25T00:00:00Z' };
    await SecureStore.setItemAsync(DEBUG_LOG_UPLOAD_RECEIPT_KEY, JSON.stringify(old));
    const [first, second] = await Promise.all([
      saveDebugLogUploadReceipt({ url: 'https://paste.rs/first', provider: 'paste.rs' }),
      saveDebugLogUploadReceipt({ url: 'https://paste.rs/second', provider: 'paste.rs' }),
    ]);
    expect(await loadDebugLogUploadReceipts()).toEqual([second, first, old]);
    await deleteDebugLogUploadAndReceipt(first, jest.fn().mockResolvedValue({ status: 204 }));
    expect(await loadDebugLogUploadReceipts()).toEqual([second, old]);
  });

  it('persists successful verification without marking legacy or unfinished uploads verified', async () => {
    const first = await saveDebugLogUploadReceipt({ url: 'https://paste.rs/first', provider: 'paste.rs' });
    const second = await saveDebugLogUploadReceipt({ url: 'https://paste.rs/second', provider: 'paste.rs' });
    await markDebugLogUploadReceiptVerified(first);
    expect(await loadDebugLogUploadReceipts()).toEqual([second, { ...first, verified: true }]);
  });
});
