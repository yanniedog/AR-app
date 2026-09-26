import { bundledHistoricalCatalogueBinding, getBundledHistoricalBankRateCatalogue, getBundledHistoricalBankRateCatalogueAsync } from '../src/data/bundledHistoricalBankRateCatalogue';
import { prepareHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogue';
import * as compression from '../src/data/historicalBankRateCatalogueCompression';

test('the shipped rich catalogue loads cooperatively once for concurrent callers and shares its prepared object', async () => {
  const inflate = jest.spyOn(compression, 'decompressCatalogueAsync');
  try {
    const first = getBundledHistoricalBankRateCatalogueAsync({ yieldControl: async () => undefined });
    const concurrent = getBundledHistoricalBankRateCatalogueAsync({ yieldControl: async () => undefined });
    expect(concurrent).toBe(first);
    const catalogue = await first;
    expect(catalogue?.schema_version).toBe(2);
    expect(Object.keys(catalogue!.sources).length).toBeGreaterThan(100);
    expect(catalogue!.run_dates.at(-1)).toBe(bundledHistoricalCatalogueBinding.index?.latest_date);
    expect(bundledHistoricalCatalogueBinding.core_sha256).toMatch(/^[a-f0-9]{64}$/);
    const prepared = prepareHistoricalBankRateCatalogue(catalogue);
    expect(getBundledHistoricalBankRateCatalogue()).toBe(catalogue);
    expect(await getBundledHistoricalBankRateCatalogueAsync()).toBe(catalogue);
    expect(prepareHistoricalBankRateCatalogue(catalogue)).toBe(prepared);
    expect(inflate).toHaveBeenCalledTimes(1);
  } finally { inflate.mockRestore(); }
}, 30_000);

test('sync getter retains its one-decode API for scripts while async getter reuses that cache', async () => {
  await jest.isolateModulesAsync(async () => {
    const codec = jest.requireActual<typeof compression>('../src/data/historicalBankRateCatalogueCompression');
    const decode = jest.spyOn(codec, 'decompressCatalogue').mockReturnValue(null);
    const bundle = jest.requireActual<typeof import('../src/data/bundledHistoricalBankRateCatalogue')>('../src/data/bundledHistoricalBankRateCatalogue');
    expect(bundle.getBundledHistoricalBankRateCatalogue()).toBeNull();
    expect(bundle.getBundledHistoricalBankRateCatalogue()).toBeNull();
    expect(await bundle.getBundledHistoricalBankRateCatalogueAsync()).toBeNull();
    expect(decode).toHaveBeenCalledTimes(1);
    decode.mockRestore();
  });
});

test('concurrent failed async bundle decoding is cached without repeating work', async () => {
  await jest.isolateModulesAsync(async () => {
    const codec = jest.requireActual<typeof compression>('../src/data/historicalBankRateCatalogueCompression');
    const decode = jest.spyOn(codec, 'decompressCatalogueAsync').mockResolvedValue(null);
    const bundle = jest.requireActual<typeof import('../src/data/bundledHistoricalBankRateCatalogue')>('../src/data/bundledHistoricalBankRateCatalogue');
    const first = bundle.getBundledHistoricalBankRateCatalogueAsync({ yieldControl: async () => undefined });
    expect(bundle.getBundledHistoricalBankRateCatalogueAsync()).toBe(first);
    expect(await first).toBeNull();
    expect(await bundle.getBundledHistoricalBankRateCatalogueAsync()).toBeNull();
    expect(decode).toHaveBeenCalledTimes(1);
    decode.mockRestore();
  });
});
