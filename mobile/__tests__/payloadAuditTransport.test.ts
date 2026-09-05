import { strToU8 } from 'fflate';
import { downloadSearchIndex } from '../src/data/payload';
import { installAppHealthTransportGuard, hasAppHealthFetchGuard } from '../src/lib/appHealthTransportGuard';
import { createV1AppHealthSourceContract } from '../src/lib/appHealth';

jest.mock('../src/lib/yieldToUi', () => ({
  yieldToUi: jest.fn(async () => undefined),
  parseJsonHeavy: jest.fn(async (text: string) => JSON.parse(text)),
}));

const contract = createV1AppHealthSourceContract();
const url = `https://github.com/${contract.repo}/releases/download/app-payload-latest/search-index.json.gz`;
const index = { schema_version: 1, run_date: '2026-09-05', products: { product: 'offset account' } };

it.each(['local', 'live-source'] as const)('keeps payload transport behind the %s audit policy', async (mode) => {
  const original = globalThis.fetch;
  const fetchSpy = jest.fn(async () => ({ ok: true, status: 200, url,
    arrayBuffer: async () => strToU8(JSON.stringify(index)).buffer }));
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  const guard = installAppHealthTransportGuard({ target: globalThis, mode, contract });
  try {
    expect(hasAppHealthFetchGuard()).toBe(true);
    await expect(downloadSearchIndex(url)).rejects.toThrow('blocked');
    expect(fetchSpy).not.toHaveBeenCalled();
    guard.allowManifestAssets([url]);
    if (mode === 'live-source') {
      await expect(downloadSearchIndex(url)).resolves.toMatchObject({ searchIndex: index });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } else {
      await expect(downloadSearchIndex(url)).rejects.toThrow('blocked');
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  } finally {
    guard.restore();
    expect(hasAppHealthFetchGuard()).toBe(false);
    globalThis.fetch = original;
  }
});

it('rejects an unexpected redirect for manifest-authenticated payload bytes', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, url: 'https://other.test/index',
    arrayBuffer: async () => strToU8(JSON.stringify(index)).buffer })) as unknown as typeof fetch;
  const guard = installAppHealthTransportGuard({ target: globalThis, mode: 'live-source', contract });
  try {
    guard.allowManifestAssets([url]);
    await expect(downloadSearchIndex(url)).rejects.toThrow();
  } finally {
    guard.restore();
    globalThis.fetch = original;
  }
});
