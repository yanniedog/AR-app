import { createV1AppHealthSourceContract } from '../src/lib/appHealth/sourceContract';
import { readLiveAppHealthSnapshot } from '../src/lib/appHealthLiveSource';
import {
  installAppHealthTransportGuard,
  type AuditTransportTarget,
} from '../src/lib/appHealthTransportGuard';

describe('live app-health source validation', () => {
  it('rejects a malformed HTTP-success manifest instead of auditing cached state', async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = jest.fn(async () => ({
      ok: true,
      status: 200,
      redirected: false,
      url: '',
      json: async () => ({ schema_version: 1, files: {} }),
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchSpy;
    const contract = createV1AppHealthSourceContract();
    const guard = installAppHealthTransportGuard({
      target: globalThis as unknown as AuditTransportTarget,
      mode: 'live-source',
      contract,
    });
    try {
      await expect(readLiveAppHealthSnapshot({
        guard,
        contract,
        appVersion: '1.0.0',
      })).rejects.toThrow('Core asset is not a JSON object');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      guard.restore();
      globalThis.fetch = originalFetch;
    }
  });
});
