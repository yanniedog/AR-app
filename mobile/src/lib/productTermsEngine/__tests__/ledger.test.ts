import { calculateLedger } from '../ledger';
import { Decimal } from '../decimal';
import { hashText } from '../validation';
import type { LedgerEvent } from '../types';
import { example, source, sources } from '../testSupport';

describe('official source benchmark and separate example holdout', () => {
  test.each(['macquarie-daily-example', 'macquarie-offset-example'])('%s reproduces published arithmetic without claiming complete product cost', id => {
    const { contract, scenario } = example(id), row = source(id);
    const receipt = calculateLedger(contract, scenario);
    expect(receipt.totals?.interestPosted).toBe(row.values.expectedDailyInterest);
    expect(receipt.status).toBe('incomplete'); expect(receipt.claimAvailable).toBe(false);
    expect(receipt.issues).toContain('unverified:feeCoverage');
    expect(receipt.issues).toContain('applicability_not_proven_for_horizon');
  });
  test('Ubank daily-rate unit ambiguity is exposed rather than silently resolved', () => {
    const { contract, scenario } = example('ubank-daily-rate-rounding');
    contract.unsupportedTerms = ['daily-rate-rounding-unit-conflicts-with-published-example'];
    contract.interest.dailyRateRounding = { scale: 6, unit: 'percent', mode: 'half_up' };
    const literal = calculateLedger(contract, scenario);
    expect(literal.totals?.interestPosted).toBe('41.81');
    contract.interest.dailyRateRounding.unit = 'fraction';
    const alternate = calculateLedger(contract, scenario);
    expect(alternate.totals?.interestPosted).toBe(source('ubank-daily-rate-rounding').values.expectedDailyInterest);
    expect(alternate.totals?.interestPosted).toBe('41.71');
    expect(literal.claimAvailable).toBe(false); expect(alternate.claimAvailable).toBe(false);
  });
  test('fixture quotes and full downloaded byte hashes are explicit', () => {
    for (const row of sources) {
      expect(hashText(row.quote)).toBe(row.quoteSha256);
      expect(row.documentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(row.limitations.length).toBeGreaterThan(0);
    }
    expect(sources.some(row => row.split === 'holdout')).toBe(true);
  });
});

describe('dated ledger accounting primitives using source-bound scenarios', () => {
  test('actual365 remains365 on leap day; actualactual uses366', () => {
    const { contract, scenario } = example();
    scenario.startDate = '2024-02-28'; scenario.endDateExclusive = '2024-03-01';
    contract.interest.postingDates = ['2024-02-29'];
    const fixed = calculateLedger(contract, scenario);
    expect(fixed.ledger.filter(row => row.type === 'interest_accrual').map(row => row.date)).toEqual(['2024-02-28', '2024-02-29']);
    expect(fixed.totals?.interestPosted).toBe('42.22');
    contract.interest.dayCount = 'actual_actual';
    expect(calculateLedger(contract, scenario).totals?.interestPosted).toBe('42.10');
  });
  test('cashflows occur in explicit order before closing-balance accrual and posting', () => {
    const { contract, scenario } = example();
    scenario.events = [
      { id: 'repay', date: scenario.startDate, order: 2, type: 'cashflow', delta: '-50000.00', label: 'User scenario repayment' },
      { id: 'advance', date: scenario.startDate, order: 1, type: 'cashflow', delta: '50000.00', label: 'User scenario advance' },
    ];
    const receipt = calculateLedger(contract, scenario);
    expect(receipt.ledger.map(row => row.id)).toEqual(['advance', 'repay', 'accrue:2026-09-14', 'post:2026-09-14']);
    expect(receipt.totals).toMatchObject({ externalCashflowNet: '0.00', principalRepaid: null, externalInflows: '50000.00', externalOutflows: '50000.00', interestPosted: '21.11', feesCharged: '0.00' });
    expect(receipt.issues).toContain('repayment_principal_allocation_unsupported');
    expect(receipt.totals?.closingBalance).toBe('140101.11');
  });
  test('explicit rate event affects its own day and input order does not affect receipt', () => {
    const { contract, scenario } = example();
    scenario.endDateExclusive = '2026-09-16'; contract.interest.postingDates = ['2026-09-15'];
    scenario.events = [{ id: 'stop-interest', date: '2026-09-15', order: 1, type: 'rate', annualRate: '0', evidenceIds: contract.initialRateEvidenceIds }];
    const receipt = calculateLedger(contract, scenario);
    expect(receipt.totals?.interestPosted).toBe('21.11');
    expect(calculateLedger(contract, scenario)).toEqual(receipt);
  });
  test('unrounded accrual is rounded only at posting; adjustment is disclosed', () => {
    const { contract, scenario } = example();
    contract.interest.dailyAccrualScale = null;
    const receipt = calculateLedger(contract, scenario), totals = receipt.totals!;
    expect(totals.interestPosted).toBe('21.11');
    expect(totals.interestAccrued).toBe('21.107945205479');
    expect(totals.interestRoundingAdjustment).toBe('0.002054794521');
  });
  test('unknown fee waiver does not become a free account or complete subtotal', () => {
    const { contract, scenario } = example();
    // Literal fee amount tests arithmetic only; this is not fabricated bank acceptance data.
    scenario.events = [{ id: 'fee', date: scenario.startDate, order: 1, type: 'fee', chargeKey: 'scenario-fee',
      evidenceIds: contract.initialRateEvidenceIds, amount: { type: 'fixed', value: '1.00' },
      waiver: { id: 'unknown-waiver', op: 'unknown', reason: 'condition_not_yet_digitised' } }];
    const receipt = calculateLedger(contract, scenario);
    expect(receipt.issues).toContain('fee_waiver_unknown:fee'); expect(receipt.claimAvailable).toBe(false);
    expect(receipt.ledger.find(row => row.id === 'fee')?.amount).toBeNull();
  });
  test('percentage fee cap/rounding and principal remain separate', () => {
    const { contract, scenario } = example();
    scenario.events = [{ id: 'fee', date: scenario.startDate, order: 1, type: 'fee', chargeKey: 'arithmetic-only', evidenceIds: contract.initialRateEvidenceIds,
      amount: { type: 'percentage', fraction: '0.1', basis: '100.00', maximum: '2.00', minimum: '1.00', rounding: 'half_up' } }];
    const receipt = calculateLedger(contract, scenario), totals = receipt.totals!;
    expect(totals.feesCharged).toBe('2.00'); expect(totals.externalCashflowNet).toBe('0.00');
    expect(Decimal.parse(totals.openingBalance).add(Decimal.parse(totals.externalCashflowNet)).add(Decimal.parse(totals.feesCharged)).add(Decimal.parse(totals.interestPosted)).fixed()).toBe(totals.closingBalance);
    const duplicate = { ...scenario.events[0], id: 'duplicate', order: 2 } as LedgerEvent;
    scenario.events.push(duplicate);
    expect(calculateLedger(contract, scenario).issues).toContain('duplicate_or_missing_charge_key');
  });
});

describe('refusal at trust and unsupported-pattern boundaries', () => {
  test.each(['applicability', 'materialTerms', 'feeCoverage', 'rateSchedule'] as const)('unverified %s cannot become complete', field => {
    const { contract, scenario } = example();
    contract.review[field] = 'unknown';
    expect(calculateLedger(contract, scenario).claimAvailable).toBe(false);
  });
  test('changed quote, missing provenance and unknown policy are rejected', () => {
    let { contract, scenario } = example();
    contract.evidence[0].quote += ' altered';
    expect(calculateLedger(contract, scenario).issues).toContain('source_evidence_invalid');
    ({ contract, scenario } = example()); contract.evidence = [];
    expect(calculateLedger(contract, scenario).issues).toContain('source_evidence_required');
    ({ contract, scenario } = example()); contract.interest.dayCount = 'monthly' as never;
    expect(calculateLedger(contract, scenario).issues).toContain('interest_pattern_unsupported');
  });
  test('unsafe numeric/currency/date/cohort inputs never obtain cost claims', () => {
    let { contract, scenario } = example(); scenario.openingBalance = '0.001';
    expect(calculateLedger(contract, scenario).totals).toBeNull();
    ({ contract, scenario } = example()); contract.currency = 'USD' as never;
    expect(calculateLedger(contract, scenario).status).toBe('unsupported');
    ({ contract, scenario } = example()); contract.applicability = { cohortKey: 'other', from: '2026-01-01', toExclusive: '2027-01-01' };
    expect(calculateLedger(contract, scenario).issues).toContain('applicability_not_proven_for_horizon');
  });
});
