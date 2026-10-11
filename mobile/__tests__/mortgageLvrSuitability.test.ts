import fixture from './fixtures/unspecified-lvr-fee-assistance-20260928.json';
import { hasUnspecifiedMortgageLvr } from '../src/data/accountClass';
import { formatRate, isNonStandard, visibleAccountRows } from '../src/data/format';
import { bestRow, EMPTY_FILTERS, filterRows, groupByProvider } from '../src/data/selectors';
import { statsFor } from '../src/data/taxonomy';
import { cache } from '../src/data/cache';
import {
  buildSuitabilityIndex, clearSuitabilityIndex, hydrateSuitabilityIndex,
  installSuitabilityIndex, rebuildAndInstallSuitabilityIndex,
} from '../src/data/suitabilityIndex';
import type { CorePayload, RateRow } from '../src/types';

jest.mock('../src/data/cache', () => ({ cache: {
  readSuitabilityIndex: jest.fn(async () => null),
  writeSuitabilityIndex: jest.fn(async () => undefined),
} }));

const observed: RateRow = fixture.row;
const ordinary: RateRow = {
  ...observed, product_key: 'ordinary-loan', product_name: 'Ordinary Home Loan',
  rate: '0.06', lvr_tier: 'lvr_70-80%', taxonomy_path: 'HOME_LOAN.OO.PI.VARIABLE.LVR_70_80',
};
const core = (rows: RateRow[]) => ({ run_date: fixture.provenance.run_date,
  sections: { Mortgage: { rates: rows }, Savings: { rates: [] }, TD: { rates: [] } },
}) as unknown as CorePayload;

beforeEach(() => { jest.clearAllMocks(); clearSuitabilityIndex(); });
afterEach(clearSuitabilityIndex);

test.each([undefined, '', ' ', 'lvr_unspecified', 'LVR_UNSP', 'LVR_NA', 'n/a', 'unknown', 'lvr_0%', 'broken']) (
  'missing or unusable mortgage LVR is non-standard: %s', lvr_tier => {
    expect(isNonStandard({ ...observed, lvr_tier })).toBe(true);
  },
);

test.each(['lvr_=60%', 'lvr_60-70%', 'lvr_70-80%', 'lvr_85-90%', 'lvr_90-95%', 'LVR_LE60', '95+', '≤80%']) (
  'a declared LVR band remains standard: %s', lvr_tier => {
    expect(isNonStandard({ ...ordinary, lvr_tier })).toBe(false);
  },
);

test('legacy hierarchy bands work and deposits without LVR remain available', () => {
  expect(hasUnspecifiedMortgageLvr({ ...ordinary, lvr_tier: undefined })).toBe(false);
  expect(hasUnspecifiedMortgageLvr({ ...ordinary, lvr_tier: 'n/a' })).toBe(true);
  expect(hasUnspecifiedMortgageLvr({ ...ordinary, lvr_tier: undefined, taxonomy_path: undefined })).toBe(true);
  for (const category of ['TRANS_AND_SAVINGS_ACCOUNTS', 'TERM_DEPOSITS']) {
    const deposit = { provider: 'Bank', product_key: category, product_name: 'Deposit', rate: '0.04', category };
    expect(visibleAccountRows([deposit])).toEqual([deposit]);
  }
});

test('observed zero-rate fee-assistance loan is opt-in across lists, best rates, banks and statistics', async () => {
  const rows = [observed, ordinary];
  expect(formatRate(observed.rate)).toBe('0.00%'); // Preserve the published value.
  const check = () => {
    expect(visibleAccountRows(rows)).toEqual([ordinary]);
    expect(filterRows(rows, EMPTY_FILTERS, null, null, 'Mortgage')).toEqual([ordinary]);
    expect(bestRow(rows, 'Mortgage')).toBe(ordinary);
    expect(groupByProvider(core(rows).sections)[0].rows).toEqual([ordinary]);
    expect(statsFor(rows, false, 'Mortgage')).toMatchObject({ min: 0.06, count: 1, products: 1 });
    expect(visibleAccountRows(rows, true)).toEqual(rows);
    expect(bestRow(rows, 'Mortgage', true)).toBe(observed);
  };
  check();
  installSuitabilityIndex(await buildSuitabilityIndex(core(rows), null));
  check();
});

test.each([false, true])('unknown and ordinary LVR siblings remain distinct in either order (reverse=%s)', async reverse => {
  const unknown = { ...ordinary, lvr_tier: 'lvr_unspecified', rate: '0' };
  const rows = reverse ? [ordinary, unknown] : [unknown, ordinary];
  const index = await buildSuitabilityIndex(core(rows), null);
  expect(index.allowed).toEqual(new Set([ordinary.product_key]));
  installSuitabilityIndex(index);
  expect(visibleAccountRows(rows)).toEqual([ordinary]);
  expect(visibleAccountRows(rows, true)).toEqual(rows);
});

test('an upgrade rejects the old allowlist, rebuilds and rehydrates the new LVR policy', async () => {
  const rows = [observed, ordinary];
  const identity = { runDate: fixture.provenance.run_date, coreSha: 'core', detailsSha: 'details' };
  jest.mocked(cache.readSuitabilityIndex).mockResolvedValue({
    schemaVersion: 3, ...identity, allowed: rows.map(row => row.product_key),
  } as never);
  expect(await hydrateSuitabilityIndex(identity.runDate, 'core', 'details')).toBeNull();
  await rebuildAndInstallSuitabilityIndex(core(rows), null, 'details', () => true, 'core');
  const persisted = jest.mocked(cache.writeSuitabilityIndex).mock.calls[0][0];
  expect(persisted).toMatchObject({ schemaVersion: 5, allowed: [ordinary.product_key] });
  clearSuitabilityIndex();
  jest.mocked(cache.readSuitabilityIndex).mockResolvedValue(persisted);
  expect(await hydrateSuitabilityIndex(identity.runDate, 'core', 'details')).not.toBeNull();
  expect(visibleAccountRows(rows)).toEqual([ordinary]);
});
