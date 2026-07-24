import core from '../assets/sample/core.json';
import {
  buildAggregateRibbonFromHistory,
  selectBankHistoryChartModel,
} from '../src/data/historySelectors';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import type { BankHistoryCache, CorePayload, SectionKey } from '../src/types';

const sample = core as CorePayload;

describe('historySelectors', () => {
  afterEach(() => setSuitabilityAllowed(null));

  it('falls back to current ribbon when history cache is absent', () => {
    const model = selectBankHistoryChartModel(
      { core: sample, includeNonStandard: true },
      'Mortgage',
    );
    expect(model).not.toBeNull();
    expect(model?.dates).toEqual([sample.run_date]);
    expect(model?.points[0].min).toBeCloseTo(0.0279, 4);
    expect(model?.points[0].max).toBeCloseTo(0.1177, 4);
  });

  it('builds aggregate ribbon from cached history rows', () => {
    const rows = sample.sections.Mortgage.rates.slice(0, 40).map((row, i) => ({
      ...row,
      run_date: i < 20 ? '2026-05-01' : '2026-05-15',
    }));
    const cache: BankHistoryCache = {
      run_dates: ['2026-05-01', '2026-05-15'],
      rates: rows,
      section: 'Mortgage',
    };
    const model = selectBankHistoryChartModel(
      { core: sample, historyCache: cache },
      'Mortgage',
      'All',
    );
    expect(model?.dates).toEqual(['2026-05-01', '2026-05-15']);
    expect(model?.points.every((p) => p.min != null && p.max != null)).toBe(true);
  });

  it('keeps standard-only history closed until the refreshed gate is rebuilt', () => {
    setSuitabilityAllowed(new Set());
    expect(selectBankHistoryChartModel({ core: sample }, 'Mortgage')).toBeNull();

    const allowedRow = sample.sections.Mortgage.rates.find((row) =>
      row.taxonomy_path?.startsWith('HOME_LOAN'),
    );
    expect(allowedRow).toBeDefined();
    setSuitabilityAllowed(new Set([allowedRow!.product_key]));

    expect(selectBankHistoryChartModel({ core: sample }, 'Mortgage')).not.toBeNull();
  });

  it('aggregates rates per run date', () => {
    const section = 'Savings' as SectionKey;
    const rows = sample.sections[section].rates.slice(0, 6).map((row, i) => ({
      ...row,
      run_date: i % 2 === 0 ? '2026-04-01' : '2026-05-01',
    }));
    const agg = buildAggregateRibbonFromHistory(rows, ['2026-04-01', '2026-05-01'], 'All');
    expect(agg.dates).toEqual(['2026-04-01', '2026-05-01']);
    expect(agg.points[0].count).toBeGreaterThan(0);
  });
});
