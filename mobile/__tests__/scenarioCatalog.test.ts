import { alphabeticalScenarioProviders, currentProductOptions } from '../src/data/scenarioCatalog';
import type { RateRow } from '../src/types';

const row = (provider: string, product: string, rateIndex: number): RateRow => ({
  provider,
  product_key: `${provider}:${product}`,
  product_name: product,
  rate: '0.05',
  rate_index: rateIndex,
});

describe('scenario catalogue options', () => {
  const rows = [
    row('West Bank', 'Zulu loan', 2),
    row('alpha bank', 'Saver 10', 3),
    row('Alpha Bank', 'Saver 2', 2),
    row('Bank 2', 'Variable', 1),
    row('Bank 10', 'Variable', 1),
    row('West Bank', 'Alpha loan', 1),
    row('West Bank', 'Alpha loan', 1),
  ];

  it('returns distinct bank names in stable A-Z and natural number order', () => {
    expect(alphabeticalScenarioProviders(rows)).toEqual([
      'alpha bank',
      'Bank 2',
      'Bank 10',
      'West Bank',
    ]);
  });

  it('returns deduplicated optional exact tiers in product order', () => {
    expect(currentProductOptions(rows, 'West Bank').map((item) => `${item.product_name}:${item.rate_index}`))
      .toEqual(['Alpha loan:1', 'Zulu loan:2']);
    expect(currentProductOptions(rows, 'ALPHA BANK').map((item) => item.product_name).sort())
      .toEqual(['Saver 10', 'Saver 2']);
  });
});
