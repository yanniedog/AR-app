import { EMPTY_FILTERS, filterRows, prepareSearchRows, sortRows, sortRowsCooperatively, type SortKey } from '../src/data/selectors';
import type { RateRow, SectionKey } from '../src/types';
import sample from '../assets/sample/core.json';

const control = () => {
  let tick = 0;
  return { now: () => tick++, yieldControl: jest.fn(async () => undefined) };
};
test.each(['Mortgage', 'Savings', 'TD'] as SectionKey[])('cooperative ranking/filtering preserves exact %s rows and ties', async section => {
  const rows = sample.sections[section].rates as RateRow[];
  for (const sort of ['rate', 'comparison', 'bank'] as SortKey[]) {
    for (const metric of ['base', 'max'] as const) {
      for (const mortgageMetric of ['headline', 'comparison'] as const) {
        const filters = { ...EMPTY_FILTERS, includeNonStandard: true };
        const before = rows.slice();
        const scheduler = control();
        expect(await sortRowsCooperatively(rows, sort, section, metric, mortgageMetric, scheduler))
          .toEqual(sortRows(rows, sort, section, metric, mortgageMetric));
        expect(await prepareSearchRows(rows, filters, sort, section, null, null, metric, mortgageMetric, scheduler))
          .toEqual(filterRows(sortRows(rows, sort, section, metric, mortgageMetric), filters, null, null, section));
        expect(rows).toEqual(before);
        expect(scheduler.yieldControl).toHaveBeenCalled();
      }
    }
  }
});

test('changed inputs can cancel a merge without publishing partial results', async () => {
  const rows = sample.sections.TD.rates as RateRow[];
  let cancelled = false;
  let tick = 0;
  let yields = 0;
  expect(await sortRowsCooperatively(rows, 'bank', 'TD', 'max', 'comparison', {
    cancelled: () => cancelled, now: () => tick++,
    yieldControl: async () => { if (++yields === 3) cancelled = true; },
  })).toBeNull();
  expect(yields).toBe(3);
});

test('a CPU slice does not queue a promise continuation for every merge checkpoint', async () => {
  const rows: RateRow[] = Array.from({ length: 4096 }, (_, i) => ({
    provider: `Bank ${4096 - i}`, product_name: 'Loan', product_key: `loan-${i}`, rate: '0.05',
  }));
  let settled = false;
  const yieldControl = jest.fn(async () => undefined);
  const result = sortRowsCooperatively(rows, 'bank', 'Mortgage', 'base', 'comparison', {
    now: () => 0, yieldControl,
  }).then(value => { settled = true; return value; });
  // The injected clock keeps this work inside one CPU slice. Only the initial
  // host yield may suspend it; merge checkpoints must not introduce thousands
  // of resolved-Promise/microtask hops before it can publish a result.
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(settled).toBe(true);
  expect(yieldControl).toHaveBeenCalledTimes(1);
  expect(await result).toEqual(sortRows(rows, 'bank', 'Mortgage'));
});

test('indexed filtering prepares one matching set and keeps corrected index identities', async () => {
  const rows = sample.sections.TD.rates as RateRow[];
  const target = rows[0].product_key;
  const index = { schema_version: 1, run_date: sample.run_date, products: { [target]: 'unique-search-term' } };
  const filters = { ...EMPTY_FILTERS, includeNonStandard: true, query: 'unique-search-term' };
  const scheduler = control();
  const result = await prepareSearchRows(rows, filters, 'bank', 'TD', null, index, 'max', 'comparison', scheduler);
  expect(result).toEqual(filterRows(sortRows(rows, 'bank', 'TD', 'max'), filters, null, index, 'TD'));
  expect(result?.length).toBeGreaterThan(0);
  expect(await prepareSearchRows(rows, filters, 'bank', 'TD', null, { ...index, products: {} }, 'max', 'comparison', scheduler))
    .toEqual([]);
});
