import { scopedRateConditions, scopedRateConditionsForRows } from '../src/data/rateConditions';
import { mortgageComparisonRows, mortgageComparisonRowsCooperatively } from '../src/data/mortgageComparison';
import { prepareMortgageResultsIndex } from '../src/data/mortgageResultsIndex';
import { EMPTY_FILTERS, filterRows, sortRows } from '../src/data/selectors';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import type { PublicCatalogueView } from '../src/data/publicRateIntegration';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';

const unavailable: PublicCatalogueView = { status: 'unavailable', allLoaded: false, products: [], references: [],
  getProduct: () => undefined, getProgrammes: () => [] };
const filters = { ...EMPTY_FILTERS, loanPurposes: ['OWNER_OCCUPIED'], repaymentTypes: ['PRINCIPAL_AND_INTEREST'] };
const inputs = { loanAmount: '650000', lvr: '72' };
const scenario = { amount: '650000', lvr: '0.72', purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' };
function fixture() {
  const rows = Array.from({ length: 64 }, (_, i) => ({ product_key: 'loan', provider: 'Bank', product_name: `Loan ${i}`,
    rate_index: i + 1, rate: String(0.05 + i / 10000), comparison_rate: String(0.06 + i / 10000),
    account_class: 'standard', loan_purpose: i % 2 ? 'INVESTMENT' : 'OWNER_OCCUPIED',
    ribbon_repayment_type: 'PRINCIPAL_AND_INTEREST', lvr_tier: 'lvr_<=80%', balance_min: 100000, balance_max: 1000000 }));
  return selectedConstraintFixture('Mortgage', rows, rows.flatMap(row => [
    { rateIndex: row.rate_index, text: `LVR up to ${row.rate_index % 3 ? 80 : 70}%.` },
    { rateIndex: row.rate_index, text: 'Loan amount below $900000.', sourcePointer: `/data/lendingRates/${row.rate_index - 1}/applicabilityConditions/0/additionalInfo` },
  ]));
}
beforeEach(() => { jest.useFakeTimers(); installMandatoryEligibility(selectMandatoryEligibility(null, null, null)); setSuitabilityAllowed(null); });
afterEach(() => jest.useRealTimers());

test('legacy fixed rows prepare once and match canonical exact source bounds, facets, sorting and empty results', async () => {
  const f = fixture();
  const pending = prepareMortgageResultsIndex({ source: f.rows, catalogue: unavailable, context: f, includeNonStandard: false, cancelled: () => false });
  await jest.runAllTimersAsync(); const index = await pending;
  expect(index).not.toBeNull();
  for (const loanAmount of ['650000', '899999.99', '900000', 'invalid']) for (const lvr of ['70', '72', '80', '81']) {
    const value = { loanAmount, lvr };
    const expected = mortgageComparisonRows(f.rows, value, f);
    const actual = index!.select({ ...scenario, amount: loanAmount, lvr: String(Number(lvr) / 100) }, value)!;
    expect(actual.rawScope.rows).toEqual(expected.rows);
    expect(actual.rawScope.unverified).toBe(expected.unverified);
    for (const purpose of ['OWNER_OCCUPIED', 'INVESTMENT']) for (const sort of ['rate', 'comparison', 'bank'] as const) {
      const selectedFilters = { ...filters, loanPurposes: [purpose] };
      expect(actual.filtered(selectedFilters, sort, 'headline'))
        .toEqual(sortRows(filterRows(expected.rows, selectedFilters, f.details.products, null, 'Mortgage'), sort, 'Mortgage', 'max', 'headline'));
    }
  }
});

test('synchronous sibling validation retains exact provenance and never trusts a prior invocation after mutation', () => {
  const f = fixture(), sameProduct = f.rows.slice(0, 4);
  expect(scopedRateConditionsForRows(sameProduct, 'Mortgage', f)).toEqual(sameProduct.map(row => scopedRateConditions(row, 'Mortgage', f)));
  expect(scopedRateConditionsForRows([{ ...f.rows[0] }, f.rows[0]], 'Mortgage', f).map(value => value.status)).toEqual(['unavailable', 'available']);
  f.details.products.loan.rateConditions!.entries.at(-1)!.id = '0'.repeat(64);
  expect(scopedRateConditionsForRows(sameProduct, 'Mortgage', f).every(value => value.status === 'unavailable')).toBe(true);
});

test('legacy fast path never substitutes core rates for an unavailable declared catalogue, loading, error or audit cache miss', async () => {
  const f = fixture();
  for (const view of [{ ...unavailable, status: 'loading' as const }, { ...unavailable, status: 'error' as const },
    { ...unavailable, auditUnavailableReason: 'cache-miss' as const }]) {
    const pending = prepareMortgageResultsIndex({ source: f.rows, catalogue: view, context: f, includeNonStandard: false, cancelled: () => false });
    await jest.runAllTimersAsync(); expect(await pending).toBeNull();
  }
  const pending = prepareMortgageResultsIndex({ source: f.rows, catalogue: unavailable,
    context: { ...f, manifest: { ...f.manifest, public_rate_catalogue: {} as never } }, includeNonStandard: false, cancelled: () => false });
  await jest.runAllTimersAsync(); expect(await pending).toBeNull();
});

test('cooperative preparation cancels before publication and stale detail identity cannot admit source bounds', async () => {
  const f = fixture(); let cancelled = false;
  const pending = mortgageComparisonRowsCooperatively(f.rows, inputs, f, { cancelled: () => cancelled });
  cancelled = true; await jest.runAllTimersAsync(); expect(await pending).toBeNull();
  const stale = { ...f, details: { ...f.details, run_date: '2000-01-01' } };
  const stalePending = mortgageComparisonRowsCooperatively(f.rows, inputs, stale);
  await jest.runAllTimersAsync();
  expect(await stalePending).toEqual(mortgageComparisonRows(f.rows, inputs, stale));
});

test('mandatory or suitability changes revoke a prepared legacy index and its retained filter closure', async () => {
  const f = fixture();
  const pending = prepareMortgageResultsIndex({ source: f.rows, catalogue: unavailable, context: f, includeNonStandard: false, cancelled: () => false });
  await jest.runAllTimersAsync(); const index = (await pending)!;
  const selected = index.select(scenario, inputs)!;
  expect(selected.filtered(filters, 'rate', 'headline')!.length).toBeGreaterThan(0);
  setSuitabilityAllowed(new Set());
  expect(index.select(scenario, inputs)).toBeNull();
  expect(selected.filtered(filters, 'rate', 'headline')).toBeNull();
});
