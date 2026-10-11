import { getBundledHistoricalBankRateReady } from '../src/data/bundledHistoricalBankRateReady';
import { decompressCatalogueAsync } from '../src/data/historicalBankRateCatalogueCompression';
import * as compiler from '../contracts/history-ready/compiler-manifest.json';
import type { HistoricalBankRateReady } from '../src/data/historicalBankRateReadyWire';

jest.mock('../src/data/historicalBankRateCatalogueCompression', () => ({ decompressCatalogueAsync: jest.fn() }));
const day = '2026-09-26', sha = 'a'.repeat(64);
const fixture: HistoricalBankRateReady = { schema_version: 1, semantic_revision: 'ar-history-ready-v1', compiler_sha256: compiler.sha256,
  run_dates: [day], sources: { [day]: { kind: 'published_core', core_sha256: sha, details_sha256: sha, manifest_sha256: sha } },
  unavailable_dates: {}, quarantined_tier_count: 0, sections: { Mortgage: [], Savings: [], TD: [] }, products: { Mortgage: [], Savings: [], TD: [] } };

test('a transient first-owner decode failure does not permanently poison the shared fallback', async () => {
  jest.mocked(decompressCatalogueAsync).mockRejectedValueOnce(new Error('first owner cancelled'))
    .mockResolvedValueOnce(null).mockResolvedValueOnce(fixture);
  const options = { yieldControl: async () => {} };
  const first = getBundledHistoricalBankRateReady(options), joined = getBundledHistoricalBankRateReady(options);
  expect(first).toBe(joined);
  expect(await first).toBeNull();
  expect(await getBundledHistoricalBankRateReady(options)).toBeNull();
  expect(await getBundledHistoricalBankRateReady(options)).toBe(fixture);
  expect(await getBundledHistoricalBankRateReady(options)).toBe(fixture);
  expect(decompressCatalogueAsync).toHaveBeenCalledTimes(3);
});
