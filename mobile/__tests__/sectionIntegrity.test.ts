import rawSampleCore from '../assets/sample/core.json';
import { sampleCore } from '../src/data/sample';
import {
  bankHistoryPairKey,
  isExplicitTermDepositProduct,
  normalizeCoreSectionIntegrity,
  normalizeCoreWithIntegrity,
  quarantinedBankHistoryPairs,
} from '../src/data/sectionIntegrity';
import type { CorePayload, RateRow, Ribbon } from '../src/types';

function row(overrides: Partial<RateRow>): RateRow {
  return {
    provider: 'Example Bank',
    product_key: 'Example Bank|saver',
    product_name: 'Everyday Saver',
    rate: '0.0400',
    ...overrides,
  };
}

function ribbon(rates: readonly RateRow[]): Ribbon {
  const values = rates.map((item) => Number(item.rate)).sort((left, right) => left - right);
  return {
    counts: {
      rates: rates.length,
      products: new Set(rates.map((item) => item.product_key)).size,
      providers: new Set(rates.map((item) => item.provider)).size,
    },
    range: {
      min: values[0] ?? null,
      max: values.at(-1) ?? null,
      mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      median: values.length ? values[Math.floor(values.length / 2)] : null,
    },
    providers: [],
  };
}

function coreWithSavings(savingsRates: RateRow[], tdRates: RateRow[] = []): CorePayload {
  const mortgageRates: RateRow[] = [];
  return {
    schema_version: 1,
    run_date: '2026-08-10',
    sections: {
      Mortgage: { rates: mortgageRates, ribbon: ribbon(mortgageRates) },
      Savings: { rates: savingsRates, ribbon: ribbon(savingsRates) },
      TD: { rates: tdRates, ribbon: ribbon(tdRates) },
    },
    brands: {},
    rba: [],
  };
}

describe('core section integrity', () => {
  it('recognizes only an explicit leading term-deposit product identity', () => {
    expect(isExplicitTermDepositProduct(row({ product_name: 'Term Deposit' }))).toBe(true);
    expect(isExplicitTermDepositProduct(row({ product_name: ' Term   Deposit 1 year ' }))).toBe(true);
    expect(isExplicitTermDepositProduct(row({ product_name: 'Fixed Term Deposit - 12 months' }))).toBe(true);

    expect(isExplicitTermDepositProduct(row({
      product_name: 'Business Line of Credit - Secured by a Term Deposit',
    }))).toBe(false);
    expect(isExplicitTermDepositProduct(row({
      product_name: 'Farm Management Deposit Fixed Term',
    }))).toBe(false);
    expect(isExplicitTermDepositProduct(row({ product_name: 'Term investment saver' }))).toBe(false);
  });

  it('quarantines misbucketed TD rows without moving or changing valid products', () => {
    const saver = row({ product_key: 'Saver|1', product_name: 'Everyday Saver' });
    const move = row({
      provider: 'MOVE Bank',
      product_key: 'MOVE Bank|td',
      product_name: 'Term Deposit',
      rate: '0.054',
      rate_type: 'FIXED',
      term: 'P7M',
    });
    const greatSouthern = row({
      provider: 'Great Southern Bank Business+',
      product_key: 'GSB|td-1y',
      product_name: 'Term Deposit 1 year',
      rate: '0.0525',
    });
    const validTd = row({
      provider: 'TD Bank',
      product_key: 'TD|12m',
      product_name: 'Term Deposit',
      rate: '0.05',
    });
    const input = coreWithSavings([saver, move, greatSouthern], [validTd]);

    const { core: normalized, integrity } = normalizeCoreWithIntegrity(input);

    expect(normalized).not.toBe(input);
    expect(normalized.sections.Savings.rates).toEqual([saver]);
    expect(normalized.sections.TD).toBe(input.sections.TD);
    expect(normalized.sections.TD.rates).toEqual([validTd]);
    expect([...quarantinedBankHistoryPairs(integrity)]).toEqual([
      bankHistoryPairKey('MOVE Bank', 'Savings'),
      bankHistoryPairKey('Great Southern Bank Business+', 'Savings'),
    ]);
  });

  it('rebuilds Savings range, counts and per-provider aggregates', () => {
    const rates = [
      row({ provider: 'Bank A', product_key: 'A|1', rate: '0.03' }),
      row({ provider: 'Bank A', product_key: 'A|1', rate_index: 2, rate: '0.04' }),
      row({ provider: 'Bank B', product_key: 'B|1', rate: '0.05' }),
      row({ provider: 'Bank C', product_key: 'C|invalid', rate: 'not-published' }),
      row({ provider: 'Bank D', product_key: 'D|empty', rate: '' }),
      row({ provider: 'Bank E', product_key: 'E|zero', rate: '0' }),
      row({ provider: 'MOVE Bank', product_key: 'MOVE|td', product_name: 'Term Deposit', rate: '0.054' }),
    ];

    const normalized = normalizeCoreSectionIntegrity(coreWithSavings(rates));
    const rebuilt = normalized.sections.Savings.ribbon;

    expect(rebuilt.counts).toEqual({ rates: 3, products: 2, providers: 2 });
    expect(rebuilt.range).toEqual({ min: 0.03, max: 0.05, mean: 0.04, median: 0.04 });
    expect(rebuilt.providers).toEqual([
      {
        provider: 'Bank A',
        rates: 2,
        products: 1,
        min: 0.03,
        max: 0.04,
        mean: 0.035,
        median: 0.035,
      },
      {
        provider: 'Bank B',
        rates: 1,
        products: 1,
        min: 0.05,
        max: 0.05,
        mean: 0.05,
        median: 0.05,
      },
    ]);
  });

  it('is idempotent and preserves no-op object identity', () => {
    const clean = coreWithSavings([row({ product_key: 'clean' })]);
    expect(normalizeCoreSectionIntegrity(clean)).toBe(clean);

    const contaminated = coreWithSavings([
      row({ product_key: 'clean' }),
      row({ product_key: 'td', product_name: 'Term Deposit' }),
    ]);
    const once = normalizeCoreSectionIntegrity(contaminated);
    const twice = normalizeCoreSectionIntegrity(once);
    expect(twice).toBe(once);
  });

  it('carries immutable provenance and quarantine counts without object identity state', () => {
    const result = normalizeCoreWithIntegrity(coreWithSavings([
      row({ product_key: 'clean' }),
      row({ product_key: 'td', product_name: 'Term Deposit' }),
    ]), {
      contract: 'v1',
      coreSha256: 'a'.repeat(64),
    });

    expect(result.integrity.core).toBe(result.core);
    expect(result.integrity.coreSha256).toBe('a'.repeat(64));
    expect(result.integrity.quarantines.rowsByReason).toEqual({
      explicit_term_deposit_in_savings: 1,
    });
  });

  it('exports the bundled sample through the same normalizer', () => {
    const raw = rawSampleCore as CorePayload;
    const rawMisclassified = raw.sections.Savings.rates.filter(isExplicitTermDepositProduct);

    expect(rawMisclassified.length).toBeGreaterThan(0);
    expect(sampleCore).toEqual(normalizeCoreSectionIntegrity(raw));
    expect(sampleCore.sections.Savings.rates.some(isExplicitTermDepositProduct)).toBe(false);
  });
});
