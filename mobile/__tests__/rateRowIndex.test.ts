import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { rowsForProductKey, rowsForProvider } from '../src/data/rateRowIndex';
import { findByKey, findEligibleByKey } from '../src/data/selectors';
import type { RateRow, SectionKey } from '../src/types';

const row = (product_key: string, provider = 'Bank', rate_index = 1): RateRow => ({
  product_key, provider, product_name: product_key, rate_index, rate: '0.05',
});
const sectionsFor = (Mortgage: RateRow[], Savings: RateRow[] = []) => ({
  Mortgage: { rates: Mortgage }, Savings: { rates: Savings }, TD: { rates: [] },
}) satisfies Record<SectionKey, { rates: RateRow[] }>;

afterEach(() => installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() }));

it('keeps exact tier order and isolates caller-owned arrays for products and providers', () => {
  const first = row('__proto__', 'Constructor', 4);
  const other = row('Other', 'Another');
  const last = row('__proto__', 'Constructor', 9);
  const rows = [first, other, last];
  expect(rowsForProductKey(rows, '__proto__')).toEqual([first, last]);
  expect(rowsForProvider(rows, 'Constructor')).toEqual([first, last]);
  rowsForProductKey(rows, '__proto__').reverse();
  rowsForProvider(rows, 'Constructor').pop();
  expect(rowsForProductKey(rows, '__proto__')).toEqual([first, last]);
  expect(rowsForProvider(rows, 'Constructor')).toEqual([first, last]);
  expect(rowsForProductKey(rows, 'missing')).toEqual([]);
  expect(rows).toEqual([first, other, last]);
});

it('does not rescan a full edition for repeat product or lender lookups', () => {
  let productReads = 0;
  let providerReads = 0;
  const rows = Array.from({ length: 1_000 }, (_, index) => ({
    product_name: `Product ${index}`, rate: '0.05',
    get product_key() { productReads += 1; return `P${index}`; },
    get provider() { providerReads += 1; return `Bank ${index % 20}`; },
  }));
  rowsForProductKey(rows, 'P900');
  rowsForProvider(rows, 'Bank 10');
  expect(productReads).toBe(rows.length);
  expect(providerReads).toBe(rows.length);
  for (let index = 0; index < 20; index += 1) {
    expect(rowsForProductKey(rows, `P${index}`)).toEqual([rows[index]]);
    expect(rowsForProvider(rows, `Bank ${index}`)).toEqual(rows.filter((_row, position) => position % 20 === index));
  }
  expect(productReads).toBe(rows.length);
  expect(providerReads).toBe(rows.length);
});

it('uses replaced section arrays immediately for corrected or removed rates', () => {
  const original = row('Product');
  const replacement = { ...original, rate: '0.06' };
  const sections = sectionsFor([original]);
  expect(findByKey(sections, 'Product')?.row).toBe(original);
  sections.Mortgage.rates = [replacement];
  expect(findByKey(sections, 'Product')?.row).toBe(replacement);
  expect(rowsForProvider(sections.Mortgage.rates, 'Bank')).toEqual([replacement]);
  sections.Mortgage.rates = [];
  expect(findByKey(sections, 'Product')).toBeNull();
});

it('applies every live eligibility revision after raw source lookup and preserves section precedence', () => {
  const loan = row('Shared');
  const savings = row('Shared', 'Saver');
  const sections = sectionsFor([loan], [savings]);
  expect(findEligibleByKey(sections, 'Shared')?.row).toBe(loan);
  installMandatoryEligibility({ active: true, loading: false, rows: new WeakSet([savings]), productKeys: new Set(['Shared']) });
  expect(findEligibleByKey(sections, 'Shared')?.row).toBe(savings);
  expect(findByKey(sections, 'Shared')?.row).toBe(loan);
  installMandatoryEligibility({ active: true, loading: false, rows: new WeakSet(), productKeys: new Set() });
  expect(findEligibleByKey(sections, 'Shared')).toBeNull();
  expect(rowsForProvider(sections.Mortgage.rates, 'Bank')).toEqual([loan]);
});
