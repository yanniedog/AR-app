import core from '../assets/sample/core.json';

import {

  detailSearchIndex,

  DETAIL_SEARCH_MEMO_LIMIT,

  detailSearchMemoSize,

  productDetailSearchText,

  productKeysMatchingIndex,

  resetDetailSearchIndexCache,

  rowMatchesSearchQuery,

  type SearchIndexPayload,

} from '../src/data/detailSearch';

import type { CorePayload, ProductDetail } from '../src/types';



describe('detailSearch', () => {

  afterEach(() => resetDetailSearchIndexCache());



  test('productDetailSearchText includes description and detail item fields', () => {

    const detail: ProductDetail = {

      description: 'Finance renewable energy upgrades.',

      features: [{ label: 'OFFSET', name: 'Offset account', info: '100% offset' }],

      fees: [{ label: 'UPFRONT', name: 'Application fee', value: 600 }],

      eligibility: [{ label: 'MIN_AGE', name: 'Minimum age', value: 18 }],

      constraints: [{ label: 'MAX_BALANCE', name: 'Maximum balance', info: 'Up to $2m' }],

    };

    const text = productDetailSearchText(detail);

    expect(text).toContain('renewable energy');

    expect(text).toContain('offset account');

    expect(text).toContain('application fee');

  });

  test('indexes allowlisted normalized fact fields without ids, URLs or unknown text', () => {
    const detail = {
      facts: [{
        id: 'internal-source-row-481',
        kind: 'feature',
        canonicalKey: 'OFFSET',
        label: 'Linked offset account',
        value: true,
        unit: 'boolean',
        appliesTo: ['OWNER_OCCUPIED'],
        condition: 'Salary must be credited monthly',
        searchTerms: ['linked offset', 'https://developer.example/raw'],
        developerNote: 'private implementation detail',
      }],
    } as unknown as ProductDetail;

    const text = productDetailSearchText(detail);
    expect(text).toContain('offset');
    expect(text).toContain('linked offset account');
    expect(text).toContain('owner occupied');
    expect(text).toContain('salary must be credited monthly');
    expect(text).toContain('linked offset');
    expect(text).not.toContain('internal-source-row');
    expect(text).not.toContain('developer.example');
    expect(text).not.toContain('private implementation');
  });



  test('payload index can match detail-only text for a sampled product', () => {

    const row = (core as CorePayload).sections.Mortgage.rates[0];

    expect(row).toBeTruthy();

    const index: SearchIndexPayload = {

      schema_version: 1,

      run_date: '2026-05-19',

      products: { [row.product_key]: 'renewable energy efficiency' },

    };

    expect(rowMatchesSearchQuery(row, 'energy', index)).toBe(true);

    expect(productKeysMatchingIndex(index, 'energy')?.has(row.product_key)).toBe(true);

  });



  test('prefers payload index over runtime detail blob building', () => {

    const index: SearchIndexPayload = {

      schema_version: 1,

      run_date: '2026-05-19',

      products: { 'Z|1': 'acme solar panel finance' },

    };

    const row = { provider: 'Acme', product_name: 'Loan', product_key: 'Z|1' };

    expect(rowMatchesSearchQuery(row, 'solar', index, undefined)).toBe(true);

    expect(detailSearchIndex(null).size).toBe(0);

  });

  test('narrows an extended query from cached prefix hits', () => {
    let reads = 0;
    const products: Record<string, string> = {};
    for (const [key, value] of Object.entries({
      a: 'solar offset home loan',
      b: 'solar savings account',
      c: 'fixed home loan',
    })) {
      Object.defineProperty(products, key, {
        enumerable: true,
        get: () => {
          reads += 1;
          return value;
        },
      });
    }
    const index: SearchIndexPayload = { schema_version: 1, run_date: '2026-08-04', products };

    expect(productKeysMatchingIndex(index, 'solar')).toEqual(new Set(['a', 'b']));
    expect(reads).toBe(3);
    reads = 0;
    expect(productKeysMatchingIndex(index, 'solar off')).toEqual(new Set(['a']));
    expect(reads).toBe(2);
  });

  test('bounds the query memo with least-recently-used eviction', () => {
    const index: SearchIndexPayload = {
      schema_version: 1,
      run_date: '2026-08-04',
      products: { a: 'alpha beta gamma' },
    };
    for (let i = 0; i < DETAIL_SEARCH_MEMO_LIMIT + 10; i += 1) {
      productKeysMatchingIndex(index, `query-${i}`);
    }
    expect(detailSearchMemoSize()).toBe(DETAIL_SEARCH_MEMO_LIMIT);
  });

  test('invalidates prefix memoization when a corrected index object keeps the same date', () => {
    const first: SearchIndexPayload = {
      schema_version: 1,
      run_date: '2026-08-04',
      products: { a: 'solar offset home loan' },
    };
    const corrected: SearchIndexPayload = {
      schema_version: 1,
      run_date: '2026-08-04',
      products: { a: 'solar offset home loan', b: 'solar offset saver' },
    };

    expect(productKeysMatchingIndex(first, 'solar')).toEqual(new Set(['a']));
    expect(productKeysMatchingIndex(corrected, 'solar off')).toEqual(new Set(['a', 'b']));
  });

  test('touches memo hits and defensively owns cached result sets', () => {
    let reads = 0;
    const products: Record<string, string> = {};
    for (const [key, value] of Object.entries({ a: 'needle-a', b: 'needle-b' })) {
      Object.defineProperty(products, key, {
        enumerable: true,
        get: () => {
          reads += 1;
          return value;
        },
      });
    }
    const index: SearchIndexPayload = { schema_version: 1, run_date: '2026-08-04', products };
    const first = productKeysMatchingIndex(index, 'needle-a')!;
    productKeysMatchingIndex(index, 'needle-b');
    first.clear();
    reads = 0;
    expect(productKeysMatchingIndex(index, 'needle-a')).toEqual(new Set(['a']));
    expect(reads).toBe(0);

    for (let i = 0; i < DETAIL_SEARCH_MEMO_LIMIT - 1; i += 1) {
      productKeysMatchingIndex(index, `unrelated-${i}`);
    }
    reads = 0;
    productKeysMatchingIndex(index, 'needle-a');
    expect(reads).toBe(0);
    productKeysMatchingIndex(index, 'needle-b');
    expect(reads).toBeGreaterThan(0);
  });

});
