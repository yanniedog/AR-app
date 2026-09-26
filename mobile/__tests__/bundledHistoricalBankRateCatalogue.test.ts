import { bundledHistoricalCatalogueBinding, getBundledHistoricalBankRateCatalogue } from '../src/data/bundledHistoricalBankRateCatalogue';
import { prepareHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogue';
import * as compression from '../src/data/historicalBankRateCatalogueCompression';

test('the shipped rich catalogue validates once and subsequent preparation reuses its object', () => {
  const inflate = jest.spyOn(compression, 'decompressCatalogue');
  try {
    const catalogue = getBundledHistoricalBankRateCatalogue();
    expect(catalogue?.schema_version).toBe(2);
    expect(Object.keys(catalogue!.sources).length).toBeGreaterThan(100);
    expect(catalogue!.run_dates.at(-1)).toBe(bundledHistoricalCatalogueBinding.index?.latest_date);
    expect(bundledHistoricalCatalogueBinding.core_sha256).toMatch(/^[a-f0-9]{64}$/);
    const prepared = prepareHistoricalBankRateCatalogue(catalogue);
    expect(getBundledHistoricalBankRateCatalogue()).toBe(catalogue);
    expect(prepareHistoricalBankRateCatalogue(catalogue)).toBe(prepared);
    expect(inflate).toHaveBeenCalledTimes(1);
  } finally { inflate.mockRestore(); }
}, 30_000);
