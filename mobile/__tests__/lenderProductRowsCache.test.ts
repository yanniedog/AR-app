import { lenderProductRows, sortRows, excludeTokenDepositRates } from '../src/data/selectors';
import { visibleAccountRows } from '../src/data/format';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import type { RateRow, SectionKey } from '../src/types';
const resetGate = () => installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() });
beforeEach(() => { resetGate(); setSuitabilityAllowed(null); });
afterEach(() => { resetGate(); setSuitabilityAllowed(null); });
const rows: RateRow[] = Array.from({ length: 192 }, (_, index) => ({ product_key: `p-${index % 24}`, product_name: `Product ${index % 24}`,
  provider: 'Bank', rate_index: index, rate: index % 13 === 0 ? '' : String(0.04 + index % 4 / 1000),
  comparison_rate: index % 7 === 0 ? undefined : String(0.045 + index % 3 / 1000),
  account_class: 'standard', term_months: 12 }));

test.each(['Mortgage', 'Savings', 'TD'] as SectionKey[])('%s winners preserve the full-sort contract across metrics and tied tiers', section => {
  for (const metric of ['base', 'max'] as const) for (const mortgage of ['headline', 'comparison'] as const) {
    const seen = new Set<string>();
    const expected = sortRows(excludeTokenDepositRates(visibleAccountRows(rows, true), section), 'rate', section, metric, mortgage)
      .filter(row => seen.has(row.product_key) ? false : (seen.add(row.product_key), true));
    expect(lenderProductRows(rows, section, metric, mortgage, true)).toEqual(expected);
  }
});

test('winner cache reuses only immutable row/details inputs under the same membership gates', () => {
  const first = lenderProductRows(rows, 'Mortgage', 'base', 'headline', true);
  expect(lenderProductRows(rows, 'Mortgage', 'base', 'headline', true)).toBe(first);
  expect(lenderProductRows([...rows], 'Mortgage', 'base', 'headline', true)).not.toBe(first);
  const details = {};
  const detailed = lenderProductRows(rows, 'Mortgage', 'base', 'headline', true, details);
  expect(lenderProductRows(rows, 'Mortgage', 'base', 'headline', true, details)).toBe(detailed);
  expect(lenderProductRows(rows, 'Mortgage', 'base', 'headline', true, {})).not.toBe(detailed);
  resetGate();
  const newGate = lenderProductRows(rows, 'Mortgage', 'base', 'headline', true);
  expect(newGate).not.toBe(first);
  setSuitabilityAllowed(new Set(['p-1']));
  expect(lenderProductRows(rows, 'Mortgage', 'base', 'headline', true)).not.toBe(newGate);
  installMandatoryEligibility({ active: true, loading: false, rows: new WeakSet(rows.filter(row => row.product_key === 'p-1')), productKeys: new Set(['p-1']) });
  expect(lenderProductRows(rows, 'Mortgage', 'base', 'headline', true).map(row => row.product_key)).toEqual(['p-1']);
});
