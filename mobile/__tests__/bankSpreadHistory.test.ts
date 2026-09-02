import {
  buildBankSpreadChartModel,
  filterBankSpreadHistoryForIntegrity,
  normalizeBankSpreadHistoryPayload,
  type BankSpreadHistoryPayload,
} from '../src/data/bankSpreadHistory';
import type { RbaCalendar } from '../src/data/rbaCalendar';
import type { CoreIntegrityContext } from '../src/data/sectionIntegrity';
import type { CorePayload } from '../src/types';

const raw = {
  schema_version: 1,
  run_date: '2026-05-22',
  run_dates: ['2026-05-19', '2026-05-20', '2026-05-22'],
  method: 'mean_rate_rows_per_product_then_mean_products_per_provider',
  cohorts: { mortgage: 'variable owner-occupied P&I', savings: 'base/ongoing at-call' },
  banks: {
    Zeta: {
      mortgage_mean: [0.061, null, 0.06], savings_mean: [0.041, null, 0.04], gap: [0.02, null, 0.02],
      mortgage_count: [2, 0, 2], savings_count: [2, 0, 2],
      mortgage_hash: ['m1', '', 'm1'], savings_hash: ['s1', '', 's1'],
      quality: ['complete', 'missing_both', 'complete'],
    },
    Alpha: {
      mortgage_mean: [0.06, 0.06, 0.059], savings_mean: [0.04, 0.04, 0.039], gap: [0.02, 0.02, 0.02],
      mortgage_count: [1, 1, 1], savings_count: [1, 1, 1],
      mortgage_hash: ['ma', 'ma', 'ma'], savings_hash: ['sa', 'sa', 'sa'],
      quality: ['complete', 'complete', 'complete'],
    },
  },
};

describe('bank spread history', () => {
  it('validates aligned series and rejects contradictory or derived values', () => {
    expect(normalizeBankSpreadHistoryPayload(raw)).not.toBeNull();
    expect(normalizeBankSpreadHistoryPayload({
      ...raw,
      banks: { ...raw.banks, Alpha: { ...raw.banks.Alpha, gap: [0.01, 0.02, 0.02] } },
    })).toBeNull();
    expect(normalizeBankSpreadHistoryPayload({
      ...raw,
      banks: { ...raw.banks, Alpha: { ...raw.banks.Alpha, mortgage_count: [0, 1, 1] } },
    })).toBeNull();
  });

  it('shows every eligible bank A-Z, preserves missing-day gaps and uses decisions as x markers', () => {
    const payload = normalizeBankSpreadHistoryPayload(raw) as BankSpreadHistoryPayload;
    const calendar: RbaCalendar = {
      timezone: 'Australia/Sydney', schedule: [],
      decisions: [
        { date: '2026-05-20', effective: null, rate: 4.35, delta_bps: 0, outcome: 'hold' },
        { date: '2026-05-21', effective: '2026-05-22', rate: 4.1, delta_bps: -25, outcome: 'cut' },
      ],
    };
    const model = buildBankSpreadChartModel(payload, calendar);
    expect(model.lines.map((line) => line.provider)).toEqual(['Alpha', 'Zeta']);
    expect(model.lines[1].points.map((point) => point.runIndex)).toEqual([0, 2]);
    expect(model.lines[1].points[1].membershipChanged).toBe(false);
    expect(model.lines[0].points[0].gapPp).toBeCloseTo(2);
    expect(model.decisions.map((decision) => decision.outcome)).toEqual(['hold', 'cut']);
    expect(model.minGapPp).toBeLessThan(2);
    expect(model.maxGapPp).toBeGreaterThan(2);
  });

  it('fails closed without matching core integrity and retains only clean provider series', () => {
    const payload = normalizeBankSpreadHistoryPayload(raw) as BankSpreadHistoryPayload;
    const core = {
      schema_version: 1,
      run_date: payload.run_date,
      sections: {
        Mortgage: { rates: [], ribbon: { counts: { rates: 0, products: 0, providers: 0 }, range: { min: null, max: null, mean: null, median: null }, providers: [] } },
        Savings: { rates: [], ribbon: { counts: { rates: 0, products: 0, providers: 0 }, range: { min: null, max: null, mean: null, median: null }, providers: [] } },
        TD: { rates: [], ribbon: { counts: { rates: 0, products: 0, providers: 0 }, range: { min: null, max: null, mean: null, median: null }, providers: [] } },
      },
      brands: {},
      rba: [],
    } satisfies CorePayload;
    const integrity: CoreIntegrityContext = {
      schemaVersion: 1,
      core,
      contract: 'v1',
      runDate: payload.run_date,
      generationDigest: null,
      coreSha256: 'a'.repeat(64),
      normalizationVersion: 'test',
      quarantines: {
        bankHistoryPairs: new Set(['Savings\u0000Zeta']),
        rowsByReason: { explicit_term_deposit_in_savings: 1 },
        countImpacts: { rates: 1, products: 1, providers: 0 },
      },
    };

    expect(filterBankSpreadHistoryForIntegrity(payload, null)).toBeNull();
    expect(filterBankSpreadHistoryForIntegrity(payload, { ...integrity, runDate: '2026-05-21' })).toBeNull();
    const filtered = filterBankSpreadHistoryForIntegrity(payload, integrity);
    expect(Object.keys(filtered?.banks ?? {})).toEqual(['Alpha']);
    expect(filtered?.banks.Alpha).toBe(payload.banks.Alpha);
  });
});
