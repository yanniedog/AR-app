import core from '../assets/sample/core.json';
import {
  buildAggregateRibbonFromHistory,
  chartModelFromBankInsights,
  selectBankHistoryChartModel,
  shouldEnsurePrebuiltBankHistory,
} from '../src/data/historySelectors';
import type { BankInsightsPayload } from '../src/data/bankInsights';
import { normalizeCoreSectionIntegrity } from '../src/data/sectionIntegrity';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import type { BankHistoryCache, CorePayload, SectionKey } from '../src/types';

const sample = core as CorePayload;

describe('historySelectors', () => {
  afterEach(() => setSuitabilityAllowed(null));

  it('requests prebuilt bank history only for broad-catalogue history', () => {
    expect(shouldEnsurePrebuiltBankHistory(true, true)).toBe(true);
    expect(shouldEnsurePrebuiltBankHistory(true, false)).toBe(false);
    expect(shouldEnsurePrebuiltBankHistory(false, true)).toBe(false);
  });

  it('falls back to current ribbon when history cache is absent', () => {
    const model = selectBankHistoryChartModel(
      { core: sample, includeNonStandard: true },
      'Mortgage',
    );
    expect(model).not.toBeNull();
    expect(model?.dates).toEqual([sample.run_date]);
    expect(model?.points[0].min).toBeCloseTo(sample.sections.Mortgage.ribbon.range.min!, 8);
    expect(model?.points[0].max).toBeCloseTo(sample.sections.Mortgage.ribbon.range.max!, 8);
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

  it('builds multi-day Spread/Calendar series from filtered bank insights', () => {
    const insights: BankInsightsPayload = {
      schema_version: 1,
      run_date: '2026-06-01',
      run_dates: ['2026-05-01T12:00:00Z', '2026-05-15', '2026-06-01'],
      banks: {
        AlphaBank: {
          Mortgage: {
            median: [0.06, 0.059, 0.057],
            best: [0.055, 0.054, 0.052],
            count: [10, 10, 10],
          },
        },
        BetaBank: {
          Mortgage: {
            median: [0.062, 0.061, 0.06],
            best: [0.058, 0.057, 0.056],
            count: [5, 5, 5],
          },
        },
      },
      events: [],
    };

    const fromInsights = chartModelFromBankInsights(insights, 'Mortgage', 'All');
    expect(fromInsights?.dates).toEqual(['2026-05-01', '2026-05-15', '2026-06-01']);
    expect(fromInsights?.points[0].min).toBeCloseTo(0.055, 4);
    expect(fromInsights?.points[0].max).toBeCloseTo(0.062, 4);
    expect(fromInsights?.points[0].median).toBeCloseTo(0.061, 4);

    const allowedRow = sample.sections.Mortgage.rates.find((row) =>
      row.taxonomy_path?.startsWith('HOME_LOAN'),
    );
    expect(allowedRow).toBeDefined();
    setSuitabilityAllowed(new Set([allowedRow!.product_key]));
    const model = selectBankHistoryChartModel(
      { core: sample, bankInsights: insights, includeNonStandard: false },
      'Mortgage',
      'All',
    );
    expect(model?.dates.length).toBe(3);
    expect(model?.points[2].median).toBeCloseTo(0.0585, 4);
  });

  it('does not use prebuilt history_banks under standard-only mode', () => {
    const allowedRow = sample.sections.Mortgage.rates.find((row) =>
      row.taxonomy_path?.startsWith('HOME_LOAN'),
    );
    expect(allowedRow).toBeDefined();
    setSuitabilityAllowed(new Set([allowedRow!.product_key]));
    const model = selectBankHistoryChartModel(
      {
        core: sample,
        includeNonStandard: false,
        historyBanks: {
          schema_version: 1,
          run_date: sample.run_date,
          run_dates: ['2026-05-01', sample.run_date],
          sections: {
            Mortgage: {
              points: [
                { date: '2026-05-01', min: 0.03, max: 0.08, mean: 0.05, median: 0.05, count: 100 },
                {
                  date: sample.run_date,
                  min: 0.031,
                  max: 0.081,
                  mean: 0.051,
                  median: 0.051,
                  count: 100,
                },
              ],
            },
          },
        },
      },
      'Mortgage',
      'All',
    );
    // Falls back to current-day ribbon rather than the unsafe full-catalogue series.
    expect(model?.dates).toEqual([sample.run_date]);
  });

  it('withholds contaminated prebuilt Savings history after section quarantine', () => {
    const normalized = normalizeCoreSectionIntegrity(sample);
    const insights: BankInsightsPayload = {
      schema_version: 1,
      run_date: normalized.run_date,
      run_dates: ['2026-08-04', normalized.run_date],
      banks: {
        'Clean Bank': {
          Savings: {
            median: [0.04, 0.041],
            best: [0.042, 0.043],
            count: [2, 2],
          },
        },
      },
      events: [],
    };

    const model = selectBankHistoryChartModel(
      {
        core: normalized,
        includeNonStandard: true,
        bankInsights: insights,
        historyBanks: {
          schema_version: 1,
          run_date: normalized.run_date,
          run_dates: ['2026-08-04', normalized.run_date],
          sections: {
            Savings: {
              points: [
                { date: '2026-08-04', min: 0.5, max: 0.6, mean: 0.55, median: 0.55, count: 10 },
                { date: normalized.run_date, min: 0.51, max: 0.61, mean: 0.56, median: 0.56, count: 10 },
              ],
            },
          },
        },
      },
      'Savings',
      'All',
    );

    expect(model?.dates).toEqual(['2026-08-04', normalized.run_date]);
    expect(model?.points[0].min).toBeCloseTo(0.04, 8);
    expect(model?.points[1].max).toBeCloseTo(0.043, 8);
  });
});
