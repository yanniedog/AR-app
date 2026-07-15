import {
  buildSuitabilityIndex,
  clearSuitabilityIndex,
  getSuitabilityIndex,
  installSuitabilityIndex,
} from '../src/data/suitabilityIndex';
import { setSuitabilityAllowed, getSuitabilityAllowed } from '../src/data/suitabilityGate';
import { visibleAccountRows, isBroadlyAvailable } from '../src/data/format';
import type { CorePayload, DetailsPayload, ProductDetail, RateRow } from '../src/types';

function row(partial: Partial<RateRow> & Pick<RateRow, 'product_key' | 'product_name'>): RateRow {
  return {
    provider: 'Test Bank',
    rate: 0.05,
    rate_index: 0,
    account_class: 'standard',
    hierarchy: ['Variable'],
    section: 'Mortgage',
    ...partial,
  } as RateRow;
}

describe('suitabilityIndex', () => {
  afterEach(() => {
    clearSuitabilityIndex();
  });

  it('builds an allowed set matching isBroadlyAvailable', async () => {
    const open = row({ product_key: 'a|1', product_name: 'Standard Variable' });
    const staff = row({ product_key: 'a|2', product_name: 'Staff Home Loan' });
    const core = {
      run_date: '2026-07-15',
      sections: { Mortgage: { rates: [open, staff] } },
    } as unknown as CorePayload;
    const details = {
      run_date: '2026-07-15',
      products: {
        'a|1': { product_key: 'a|1', description: 'Open', eligibility: [], constraints: [] },
        'a|2': {
          product_key: 'a|2',
          description: 'Staff only',
          eligibility: [{ label: 'STAFF', name: 'Staff', value: 'Y', info: '' }],
          constraints: [],
        },
      },
    } as unknown as DetailsPayload;

    const index = await buildSuitabilityIndex(core, details, 'sha');
    expect(index.allowed.has('a|1')).toBe(true);
    expect(index.allowed.has('a|2')).toBe(false);
    expect(isBroadlyAvailable(open, details.products['a|1'] as ProductDetail)).toBe(true);
    expect(isBroadlyAvailable(staff, details.products['a|2'] as ProductDetail)).toBe(false);
  });

  it('makes visibleAccountRows O(1) after install', async () => {
    const open = row({ product_key: 'b|1', product_name: 'Standard Variable' });
    const staff = row({ product_key: 'b|2', product_name: 'Staff Home Loan' });
    const core = {
      run_date: '2026-07-15',
      sections: { Mortgage: { rates: [open, staff] } },
    } as unknown as CorePayload;

    expect(getSuitabilityAllowed()).toBeNull();
    const index = await buildSuitabilityIndex(core, null, '');
    installSuitabilityIndex(index);
    expect(getSuitabilityIndex()?.allowed.size).toBeGreaterThan(0);
    expect(getSuitabilityAllowed()).toBe(index.allowed);

    const filtered = visibleAccountRows([open, staff], false, null);
    expect(filtered.map((r) => r.product_key)).toEqual(['b|1']);
  });

  it('clearSuitabilityIndex restores per-row assessAccess path', () => {
    setSuitabilityAllowed(new Set(['only']));
    clearSuitabilityIndex();
    expect(getSuitabilityAllowed()).toBeNull();
    expect(getSuitabilityIndex()).toBeNull();
  });
});
