import official from './__tests__/fixtures/official-patterns.json';
import { canonical, hashText } from './validation';
import { EVALUATOR_VERSION, type EvidenceReference, type LedgerContract, type LedgerScenario, type Rule } from './types';

export interface OfficialFixture {
  id: string; url: string; locator: string; quote: string; quoteSha256: string; documentSha256: string;
  split: string; pattern: string; values: Record<string, string | number>; limitations: string[];
}
export const sources = official.sources as unknown as OfficialFixture[];
export const benchmarkSha256 = hashText(canonical(official));
export function source(id: string): OfficialFixture { return sources.find(row => row.id === id)!; }
export function evidence(id: string): EvidenceReference {
  const row = source(id);
  return { id: row.id, clauseId: `benchmark-clause:${row.id}`, documentSha256: row.documentSha256,
    sourceUrl: row.url, locator: row.locator, quote: row.quote, quoteSha256: row.quoteSha256 };
}
export function ageRule(id = 'ubank-account-age'): Rule {
  return { id: 'age', op: 'compare', field: 'age', comparison: 'gte',
    expected: { type: 'decimal', value: String(source(id).values.minimumAge), unit: 'years' }, evidenceIds: [id] };
}

/** These are isolated source-clause scenarios, deliberately NOT approved whole-product contracts. */
export function example(id = 'macquarie-daily-example'): { contract: LedgerContract; scenario: LedgerScenario } {
  const row = source(id);
  return {
    contract: {
      schemaVersion: 1, evaluatorVersion: EVALUATOR_VERSION, id: `clause-example:${id}`, productId: `clause:${id}`,
      direction: 'liability', currency: 'AUD',
      review: { applicability: 'unknown', materialTerms: 'unknown', feeCoverage: 'unknown', rateSchedule: 'unknown', benchmarkSha256 },
      applicability: { cohortKey: null, from: null, toExclusive: null },
      evidence: [evidence(id)], dependencyIds: [row.documentSha256, row.quoteSha256], unsupportedTerms: [],
      eligibility: { id: 'whole-product', op: 'unknown', reason: 'example_is_not_product_eligibility' },
      interest: { dayCount: 'actual_365_fixed', balanceBasis: 'closing_balance_before_posted_interest',
        eventOrder: 'ordered_events_then_accrual_then_posting', dailyAccrualScale: 2, dailyRateRounding: null,
        accrualRounding: 'half_up', postingRounding: 'half_up', postingDates: ['2026-09-14'],
        offset: row.values.offset ? 'capped_at_balance' : 'none', evidenceIds: [id] },
      initialAnnualRate: String(row.values.annualRate), initialRateEvidenceIds: [id],
    },
    scenario: {
      productId: `clause:${id}`, cohortKey: 'unverified-example', startDate: '2026-09-14', endDateExclusive: '2026-09-15',
      openingBalance: String(row.values.balance), initialOffset: String(row.values.offset ?? '0.00'), facts: {}, events: [],
      assumptions: ['Single-day published arithmetic example; date/posting used only to exercise the engine, not a bank schedule or complete cost claim.'],
    },
  };
}
