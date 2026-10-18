import { useStore } from '../src/data/store';
import type { Manifest, RateRow } from '../src/types';

let mockCatalogue: { status: string; allLoaded: boolean; getProduct: () => undefined };
jest.mock('../src/data/publicRateCatalogue', () => ({
  getPublicRateCatalogueSnapshot: () => mockCatalogue,
}));

const row: RateRow = { provider: 'Example Bank', product_key: 'EX|TD', product_name: 'Term deposit', rate_index: 4, rate: '0.04' };

beforeEach(() => {
  useStore.setState({ savedRates: [], trackedRates: [], favorites: [], manifest: { public_rate_catalogue: {} } as Manifest });
});

it.each([['loading', false], ['error', false], ['ready', false]] as const)(
  'preserves an exact tier save while catalogue status is %s and completeness is %s', (status, allLoaded) => {
    mockCatalogue = { status, allLoaded, getProduct: () => undefined };
    useStore.getState().toggleSavedRate(row);
    expect(useStore.getState().savedRates[0]).toMatchObject({ scope: 'rate', productKey: row.product_key, rateIndex: 4 });
  },
);

it('uses a product save only after complete ready discovery establishes no exact offer', () => {
  mockCatalogue = { status: 'ready', allLoaded: true, getProduct: () => undefined };
  useStore.getState().toggleSavedRate(row);
  expect(useStore.getState().savedRates[0]).toMatchObject({ scope: 'product', productKey: row.product_key, rateIndex: null });
});
