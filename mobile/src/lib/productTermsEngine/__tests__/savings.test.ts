import patterns from './fixtures/savings-patterns.json';
import { calculateLedger } from '../ledger';
import { savingsInterest } from '../savingsAccrual';
import { Decimal } from '../decimal';
import { canonical, hashText } from '../validation';
import { EVALUATOR_VERSION } from '../types';
import { example } from '../testSupport';
import type { SavingsRateComponent, SavingsRateSchedule } from '../savingsTypes';

const source = patterns.sources[0];
function schedule(index = 0): SavingsRateSchedule {
  const s = patterns.sources[index];
  return { schemaVersion: 1, dailyAccrualRounding: 'aggregate', intervals: [{ id: 'observed-model', from: '2026-09-15', toExclusive: '2026-09-16', evidenceIds: [s.id],
    components: [{ id: 'base', kind: 'base', allocation: s.allocation as SavingsRateComponent['allocation'], rateMeaning: 'additive', qualification: null, evidenceIds: [s.id],
      tiers: s.rates.map((annualRate, i) => ({ id: `tier-${i}`, upperInclusive: s.upperBalances[i], annualRate, evidenceIds: [s.id] })) }] }] };
}
function model() {
  const { contract: c, scenario: s } = example();
  c.direction = 'asset'; c.initialAnnualRate = '0'; c.savingsSchedule = schedule();
  c.evidence = [{ id: source.id, clauseId: source.id, sourceUrl: source.url, documentSha256: source.documentSha256!, locator: source.locator,
    quote: source.quote!, quoteSha256: hashText(source.quote!) }];
  c.dependencyIds = [source.documentSha256!]; c.review.benchmarkSha256 = hashText(canonical(patterns));
  c.initialRateEvidenceIds = [source.id]; c.interest.evidenceIds = [source.id]; c.interest.dailyAccrualScale = null;
  c.interest.postingDates = ['2026-09-15']; c.interest.offset = 'none';
  c.unsupportedTerms = ['allocation-model-only:bank-rounding-and-complete-product-terms-unproven'];
  s.startDate = '2026-09-15'; s.endDateExclusive = '2026-09-16'; s.openingBalance = source.balance; s.initialOffset = '0';
  s.assumptions = ['Developer calendar day and exact pre-rounding arithmetic; not complete bank terms.'];
  return { c, s };
}
test('Macquarie published marginal example yields exact20550/73 daily and remains incomplete', () => {
  const { c, s } = model(), receipt = calculateLedger(c, s);
  expect(receipt.totals?.interestAccrued).toBe(Decimal.parse('20550').div(Decimal.parse('73')).fixed(12));
  expect(receipt.totals?.interestPosted).toBe('281.51');
  expect(receipt.claimAvailable).toBe(false);
  expect(receipt.inputSha256).toBe(hashText(canonical({ evaluatorVersion: EVALUATOR_VERSION, contract: c, scenario: s })));
  expect(receipt.ledger.find(e => e.type === 'interest_accrual')?.savingsContributions?.[0].tiers.map(t => t.basis)).toEqual(['250000.00', '1750000.00', '100000.00']);
});
test('v1 flat contracts retain behavior but savings contracts require v2', () => {
  const { contract, scenario } = example(); contract.evaluatorVersion = 'product-terms-engine-v1';
  expect(calculateLedger(contract, scenario).totals?.interestPosted).toBe('21.11');
  const { c, s } = model(); c.evaluatorVersion = 'product-terms-engine-v1';
  expect(calculateLedger(c, s)).toMatchObject({ status: 'unsupported', totals: null, issues: ['contract_version_unsupported'] });
});
test.each([1, 2])('web-reader-only allocation%s is an arithmetic holdout, not a fabricated raw-evidence contract', index => {
  const row = patterns.sources[index], { c } = model();
  expect(row.documentSha256).toBeNull();
  const result = savingsInterest(Decimal.parse(row.balance), '2026-09-15', c.interest, schedule(index), []);
  expect(result.amount.mul(Decimal.parse('365')).fixed(8)).toBe(row.expectedAnnual);
});
test('whole-balance cap discontinuity and zero stay exact', () => {
  const { c } = model(), rates = schedule(2);
  const annual = (balance: string) => savingsInterest(Decimal.parse(balance), '2026-09-15', c.interest, rates, []).amount.mul(Decimal.parse('365')).fixed(8);
  expect(annual('0')).toBe('0.00000000'); expect(annual('2000000')).toBe('91000.00000000');
  expect(annual('2000000.01')).toBe('30000.00015000');
  rates.intervals[0].components[0].allocation = 'marginal';
  expect(annual('2000000.01')).toBe('91000.00015000');
});
test('missing successor, overlapping intervals, malformed tiers and flat rate events fail closed', () => {
  for (const mutate of [
    (c: ReturnType<typeof model>['c']) => { c.savingsSchedule = null as unknown as SavingsRateSchedule; },
    (c: ReturnType<typeof model>['c']) => { c.savingsSchedule!.intervals[0].toExclusive = '2026-09-15'; },
    (c: ReturnType<typeof model>['c']) => { c.savingsSchedule!.intervals.push({ ...c.savingsSchedule!.intervals[0], id: 'duplicate' }); },
    (c: ReturnType<typeof model>['c']) => { c.savingsSchedule!.intervals[0].components[0].tiers[0].upperInclusive = '0.001'; },
    (c: ReturnType<typeof model>['c']) => { c.savingsSchedule!.intervals[0].components[0].tiers.at(-1)!.upperInclusive = '3000000'; },
    (c: ReturnType<typeof model>['c']) => { c.savingsSchedule!.intervals[0].components[0].tiers[0].evidenceIds = ['missing']; },
  ]) { const { c, s } = model(); mutate(c); expect(calculateLedger(c, s)).toMatchObject({ status: 'unsupported', claimAvailable: false, totals: null }); }
  const { c, s } = model(); s.events.push({ id: 'flat', type: 'rate', date: s.startDate, order: 0, annualRate: '0.01', evidenceIds: [source.id] });
  expect(calculateLedger(c, s).issues).toContain('flat_rate_event_with_savings_schedule');
});
test('intro expiry requires successor covering the entire horizon', () => {
  const { c, s } = model(); s.endDateExclusive = '2026-09-17';
  const first = c.savingsSchedule!.intervals[0]; first.components[0].kind = 'intro';
  expect(calculateLedger(c, s).issues).toContain('savings_horizon_coverage_missing');
  c.savingsSchedule!.intervals.push({ ...first, id: 'successor', from: '2026-09-16', toExclusive: '2026-09-17',
    components: [{ ...first.components[0], id: 'ongoing', kind: 'base', tiers: [{ id: 'zero', upperInclusive: null, annualRate: '0', evidenceIds: [source.id] }] }] });
  const daily = calculateLedger(c, s).ledger.filter(e => e.type === 'interest_accrual');
  expect(daily[1].amount).toBe('0.000000000000');
});
test('dated bonus qualification distinguishes unknown from explicit false and true', () => {
  const { c, s } = model();
  const component = c.savingsSchedule!.intervals[0].components[0]; component.kind = 'bonus';
  component.qualification = { accountId: 'linked', assessmentKey: 'settled-purchases', windows: [{ from: '2026-08-01', toExclusive: '2026-09-01', appliesFrom: '2026-09-01', appliesToExclusive: '2026-10-01', evidenceIds: [source.id] }], rule: { id: 'purchases', op: 'compare', field: 'qualified', comparison: 'eq', expected: { type: 'boolean', value: true }, evidenceIds: [source.id] } };
  const unknown = calculateLedger(c, s);
  expect(unknown.issues).toContain('savings_qualification_unknown:observed-model:base');
  expect(unknown.ledger[0].savingsContributions?.[0].status).toBe('needs_information');
  s.savingsAssessments = [{ id: 'september', accountId: 'linked', assessmentKey: 'settled-purchases', from: '2026-08-01', toExclusive: '2026-09-01', appliesFrom: '2026-09-01', appliesToExclusive: '2026-10-01', coverage: 'complete', facts: { qualified: { type: 'boolean', value: false } }, evidenceIds: [source.id] }];
  const no = calculateLedger(c, s);
  expect(no.ledger[0].savingsContributions?.[0].status).toBe('does_not_meet'); expect(no.totals?.interestAccrued).toBe('0.000000000000');
  expect(no.issues).not.toContain('savings_qualification_unknown:observed-model:base');
  s.savingsAssessments[0].facts.qualified = { type: 'boolean', value: true };
  expect(calculateLedger(c, s).ledger[0].savingsContributions?.[0].status).toBe('applied');
  s.savingsAssessments[0].coverage = 'unknown';
  expect(calculateLedger(c, s).ledger[0].savingsContributions?.[0].status).toBe('needs_information');
  s.savingsAssessments[0].coverage = 'complete';
  s.savingsAssessments[0].from = '2026-06-01'; s.savingsAssessments[0].toExclusive = '2026-07-01';
  expect(calculateLedger(c, s)).toMatchObject({ status: 'unsupported', claimAvailable: false, totals: null });
  expect(calculateLedger(c, s).issues).toContain('savings_assessment_window_unreviewed');
});
test('explicit rounding stage changes penny outcomes and preserves posted/remainder conservation', () => {
  const { c, s } = model(); s.openingBalance = '200'; c.interest.dailyAccrualScale = 2;
  c.savingsSchedule!.intervals[0].components[0].tiers = [
    { id: 'one', upperInclusive: '100', annualRate: '0.02', evidenceIds: [source.id] },
    { id: 'two', upperInclusive: null, annualRate: '0.02', evidenceIds: [source.id] }];
  const aggregate = calculateLedger(c, s); expect(aggregate.totals?.interestPosted).toBe('0.01');
  c.savingsSchedule!.dailyAccrualRounding = 'per_tier';
  const tier = calculateLedger(c, s); expect(tier.totals?.interestPosted).toBe('0.02');
  expect(Decimal.parse(tier.totals!.interestPosted).add(Decimal.parse(tier.totals!.interestUnposted)).sub(Decimal.parse(tier.totals!.interestAccrued)).fixed(12)).toBe(tier.totals!.interestRoundingAdjustment);
});
test('schedule leap-day day count, additive components, known fees and balances reconcile', () => {
  const { c, s } = model(); s.startDate = '2024-02-29'; s.endDateExclusive = '2024-03-01'; s.openingBalance = '36600';
  c.interest.postingDates = [s.startDate]; c.interest.dayCount = 'actual_actual';
  const interval = c.savingsSchedule!.intervals[0]; interval.from = s.startDate; interval.toExclusive = s.endDateExclusive;
  interval.components[0].tiers = [{ id: 'base', upperInclusive: null, annualRate: '0.01', evidenceIds: [source.id] }];
  interval.components.push({ ...interval.components[0], id: 'bonus', kind: 'bonus' });
  s.events.push({ id: 'linked-fee', type: 'fee', date: s.startDate, order: 0, chargeKey: 'linked:one-occurrence', amount: { type: 'fixed', value: '366' }, evidenceIds: [source.id] });
  const r = calculateLedger(c, s); expect(r.totals?.interestPosted).toBe('1.98');
  expect(r.totals?.closingBalance).toBe('36235.98'); expect(r.totals?.feesCharged).toBe('366.00');
  c.interest.dayCount = 'actual_365_fixed'; expect(calculateLedger(c, s).totals?.interestAccrued).not.toBe(r.totals?.interestAccrued);
});
