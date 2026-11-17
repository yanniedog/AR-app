import sample from '../assets/sample/core.json';
import { childrenFromScoped, childrenFromScopedCooperatively, rowsUnder, rowsUnderCooperatively,
  statsFor, statsForCooperatively } from '../src/data/taxonomy';
import { resolveSectionRibbonStats, resolveSectionRibbonStatsCooperatively } from '../src/data/ribbonStats';
import { rankFraction } from '../src/data/selectors';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import type { CorePayload, RateRow, SectionKey } from '../src/types';

const core = sample as unknown as CorePayload;
const control = () => { let tick = 0; return { now: () => tick++, yieldControl: jest.fn(async () => undefined) }; };
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, null, null)));

test.each(['Mortgage', 'Savings', 'TD'] as SectionKey[])('cooperative %s scope, hierarchy and ribbons retain synchronous results', async section => {
  const sectionData = core.sections[section], rows = sectionData.rates;
  const scheduler = control();
  for (const path of [[], ['OO'], ['missing']]) {
    const scoped = rowsUnder(rows, section, path);
    expect(await rowsUnderCooperatively(rows, section, path, scheduler)).toEqual(scoped);
    for (const includeNonStandard of [false, true]) {
      for (const metric of ['base', 'max'] as const) for (const mortgageMetric of ['headline', 'comparison'] as const) {
        const fractionOf = (row: RateRow) => rankFraction(row, section, metric, mortgageMetric);
        expect(await statsForCooperatively(scoped, includeNonStandard, section, fractionOf, scheduler))
          .toEqual(statsFor(scoped, includeNonStandard, section, fractionOf));
        expect(await childrenFromScopedCooperatively(scoped, section, path, fractionOf, scheduler))
          .toEqual(childrenFromScoped(scoped, section, path, fractionOf));
        expect(await resolveSectionRibbonStatsCooperatively(sectionData, scoped, includeNonStandard, section, null, metric, mortgageMetric, scheduler))
          .toEqual(resolveSectionRibbonStats(sectionData, scoped, includeNonStandard, section, null, metric, mortgageMetric));
      }
    }
  }
});

test('large child buckets yield during aggregation and median sorting and preserve exact ascending sum', async () => {
  const rows: RateRow[] = Array.from({ length: 24_868 }, (_, index) => ({
    provider: `Bank ${index % 154}`, product_key: `product-${index % 1800}`, product_name: 'Loan',
    rate: String((index % 100 + 1) / 1000), taxonomy_path: 'HOME_LOAN.OO.PI.VARIABLE',
  }));
  const scheduler = control();
  expect(await childrenFromScopedCooperatively(rows, 'Mortgage', [], undefined, scheduler))
    .toEqual(childrenFromScoped(rows, 'Mortgage', []));
  expect(scheduler.yieldControl.mock.calls.length).toBeGreaterThan(100);
});

test('source admission changes during a yield invalidate every partial aggregate', async () => {
  const source = core.sections.Mortgage.rates;
  const changed = { yieldControl: async () => installMandatoryEligibility(selectMandatoryEligibility(null, null, null)) };
  expect(await rowsUnderCooperatively(source, 'Mortgage', [], changed)).toBeNull();
  expect(await statsForCooperatively(source, true, 'Mortgage', undefined, changed)).toBeNull();
  expect(await childrenFromScopedCooperatively(source, 'Mortgage', [], undefined, changed)).toBeNull();
  expect(await resolveSectionRibbonStatsCooperatively(core.sections.Mortgage, source, true, 'Mortgage', null, 'base', 'headline', changed)).toBeNull();
});

test('missing comparison rates and payload fallback retain canonical behavior', async () => {
  const source: RateRow[] = [{ provider: 'Bank', product_name: 'Loan', product_key: 'loan', rate: '0.05' }];
  for (const rows of [source, []]) for (const includeNonStandard of [true, false]) {
    for (const mortgageMetric of ['comparison', 'headline'] as const) {
      expect(await resolveSectionRibbonStatsCooperatively(core.sections.Mortgage, rows, includeNonStandard,
        'Mortgage', null, 'base', mortgageMetric, control())).toEqual(resolveSectionRibbonStats(core.sections.Mortgage,
        rows, includeNonStandard, 'Mortgage', null, 'base', mortgageMetric));
    }
  }
});
