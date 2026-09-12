import fixture from './fixtures/bankwest-easy-saver-eligibility-20260913.json';
import { cache } from '../src/data/cache';
import { quickEstimateUnavailableReason } from '../src/data/calc';
import { visibleAccountRows } from '../src/data/format';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import {
  buildSuitabilityIndex,
  clearSuitabilityIndex,
  hydrateSuitabilityIndex,
  installSuitabilityIndex,
  SUITABILITY_INDEX_SCHEMA_VERSION,
} from '../src/data/suitabilityIndex';
import type { CorePayload, DetailsPayload, RateRow } from '../src/types';

jest.mock('../src/data/cache', () => ({
  cache: {
    readSuitabilityIndex: jest.fn(async () => null),
    writeSuitabilityIndex: jest.fn(async () => undefined),
  },
}));

function retainedPair(unknownDuration: boolean) {
  const rates = fixture.rates.map((row) => ({ ...row })) as RateRow[];
  const prize = rates.find((row) => row.account_class === 'non_standard')!;
  const ordinary = rates.find((row) => row.account_class === 'standard')!;
  if (unknownDuration) {
    // Controlled unit variant, not an observed/accepted payload: the producer
    // retains a winners-only restriction when duration is absent or conflicting,
    // without inventing an introductory window. Keep both real source rates.
    delete prize.term_months;
    delete prize.ongoing_rate;
    prize.ribbon_deposit_kind = 'base';
    prize.taxonomy_path = 'SAVINGS.SAVINGS_ACCT.BASE.TIERED';
  }
  const core = normalizeCoreWithIntegrity({
    run_date: fixture.provenance.run_date,
    sections: { Savings: { rates } },
  } as unknown as CorePayload).core;
  const details = {
    run_date: core.run_date,
    products: { [prize.product_key]: fixture.detail },
  } as unknown as DetailsPayload;
  return { core, details, rates: core.sections.Savings.rates, prize, ordinary };
}

describe('rate eligibility with a shared product suitability key', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSuitabilityIndex();
  });
  afterEach(clearSuitabilityIndex);

  it.each([
    ['retained four-month prize', false, 'rebuilt'],
    ['retained four-month prize', false, 'hydrated'],
    ['controlled unknown-duration prize', true, 'rebuilt'],
    ['controlled unknown-duration prize', true, 'hydrated'],
  ] as const)('keeps %s restricted (unknown duration: %s; gate: %s)', async (_label, unknownDuration, mode) => {
    const { core, details, rates, prize, ordinary } = retainedPair(unknownDuration);
    expect(prize.rate).toBe('0.115');
    expect(ordinary.rate).toBe('0.05');
    expect(prize.product_key).toBe(ordinary.product_key);
    expect(visibleAccountRows(rates, false, details.products)).toEqual([ordinary]);

    // Use the actual production builder, including loaded product disclosures.
    const index = await buildSuitabilityIndex(core, details, 'details-pair', 'core-pair');
    expect(index.allowed.has(ordinary.product_key)).toBe(true);
    if (mode === 'hydrated') {
      jest.mocked(cache.readSuitabilityIndex).mockResolvedValue({
        schemaVersion: SUITABILITY_INDEX_SCHEMA_VERSION,
        runDate: index.runDate,
        coreSha: index.coreSha,
        detailsSha: index.detailsSha,
        allowed: [...index.allowed],
      });
      expect(await hydrateSuitabilityIndex(index.runDate, index.coreSha, index.detailsSha))
        .not.toBeNull();
    } else {
      installSuitabilityIndex(index);
    }

    expect(visibleAccountRows(rates, false, details.products)).toEqual([ordinary]);
    expect(visibleAccountRows(rates, true, details.products)).toBe(rates);
    expect(quickEstimateUnavailableReason(prize, 'Savings')).not.toBeNull();
    expect(quickEstimateUnavailableReason(ordinary, 'Savings')).toBeNull();
  });
});
