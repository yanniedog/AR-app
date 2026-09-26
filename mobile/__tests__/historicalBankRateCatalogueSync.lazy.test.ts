import type { CorePayload, Manifest } from '../src/types';

const mockLoadBundle = jest.fn(() => { throw new Error('Bundled snapshot initialized'); });
jest.mock('../src/data/bundledHistoricalBankRateCatalogue', () => mockLoadBundle());
jest.mock('../src/data/cache', () => ({ cache: {} }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => undefined }));

test('loading sync does not initialize the bundled snapshot before deferred history work starts', async () => {
  // Keep this module separate from sync tests that import the mocked bundle as
  // a fixture: an already initialized Jest module cannot prove lazy loading.
  const sync = jest.requireActual<typeof import('../src/data/historicalBankRateCatalogueSync')>('../src/data/historicalBankRateCatalogueSync');
  expect(mockLoadBundle).not.toHaveBeenCalled();
  const core = { run_date: '2026-09-26', sections: { Mortgage: { rates: [] }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload;
  expect(await sync.prepareHistoricalBankRateHistory(core, { run_date: core.run_date } as Manifest)).toBe(false);
  expect(mockLoadBundle).toHaveBeenCalledTimes(1);
});
