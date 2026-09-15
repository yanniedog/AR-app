import { assessSavingsActivity } from '../savingsActivity';
import { validateActivityData, validateActivityMetrics } from '../savingsActivityValidation';
import type { SavingsAssessment } from '../savingsTypes';
import type { SavingsActivityEvent, SavingsActivityMetric } from '../savingsActivityTypes';
import { savingsInterest } from '../savingsAccrual';
import { Decimal } from '../decimal';
import { example } from '../testSupport';

/** Developer-created customer activity, not observed bank/account data. GSB source patterns
 * cover processed purchases and growth excluding interest/fees/tax. Refund treatment and
 * period mapping below are explicit MODEL policies; no complete bank contract is asserted. */
const metric = (kind: SavingsActivityMetric['kind']): SavingsActivityMetric => ({ id: `model-${kind}`, field: kind, accountRole: 'source-declared-account-role', accountIds: ['savings'], kind,
  dateBasis: 'processed', settlement: 'settled_only', includedClassifications: ['external', 'card', 'cash'], excludedClassifications: ['internal'],
  refundPolicy: null, growthAdjustments: { interest: 'exclude', fee: 'exclude', tax: 'exclude' }, evidenceIds: ['gsb-web-reader-pattern-unactivated'] });
const event = (id: string, kind: SavingsActivityEvent['kind'], amount = '1.00'): SavingsActivityEvent => ({ id, accountId: 'savings', date: '2026-08-15', dateBasis: 'processed', status: 'settled', kind, amount, classification: 'external' });
function assessment(): SavingsAssessment {
  return { id: 'august-model', assessmentKey: 'monthly-model', accountId: 'savings', from: '2026-08-01', toExclusive: '2026-09-01',
    appliesFrom: '2026-09-01', appliesToExclusive: '2026-10-01', coverage: 'complete', facts: {}, evidenceIds: ['gsb-web-reader-pattern-unactivated'],
    activity: { events: [], coverage: [{ accountId: 'savings', from: '2026-08-01', toExclusive: '2026-09-01', status: 'complete' }],
      balances: [{ accountId: 'savings', from: '2026-08-01', toExclusive: '2026-09-01', opening: '1000', closing: '1285' }] } };
}
test('deposit total uses explicit classification, account, date and settled status', () => {
  const a = assessment(); a.activity!.events = [event('one', 'deposit', '200'), event('two', 'deposit', '50'),
    { ...event('internal', 'deposit', '999'), classification: 'internal' }, { ...event('pending', 'deposit', '999'), status: 'pending' },
    { ...event('other', 'deposit', '999'), accountId: 'other' }, { ...event('next', 'deposit', '999'), date: '2026-09-01' }];
  const r = assessSavingsActivity(a, [metric('deposit_total')]);
  expect(r.facts.deposit_total).toEqual({ type: 'decimal', value: '250.00', unit: 'AUD' });
});
test('linked account-role set aggregates two accounts only with complete coverage for both', () => {
  const a = assessment(), m = metric('deposit_total'); m.accountRole = 'everyday-edge-accounts'; m.accountIds = ['edge-one', 'edge-two'];
  a.activity!.events = [{ ...event('one', 'deposit', '1000'), accountId: 'edge-one' }, { ...event('two', 'deposit', '1000'), accountId: 'edge-two' },
    { ...event('unlisted', 'deposit', '9000'), accountId: 'unlisted' }];
  a.activity!.coverage = m.accountIds.map(accountId => ({ accountId, from: a.from, toExclusive: a.toExclusive, status: 'complete' }));
  expect(assessSavingsActivity(a, [m]).facts.deposit_total?.value).toBe('2000.00');
  a.activity!.coverage[1].status = 'unknown';
  expect(assessSavingsActivity(a, [m]).results[0].reason).toBe('activity_coverage_unknown');
});
test('complete no-withdrawal window produces explicit zero; incomplete cannot reuse supplied total', () => {
  const a = assessment(); a.facts.withdrawal_count = { type: 'decimal', value: '0', unit: 'count' };
  expect(assessSavingsActivity(a, [metric('withdrawal_count')]).facts.withdrawal_count).toEqual({ type: 'decimal', value: '0', unit: 'count' });
  a.activity!.coverage[0].status = 'unknown';
  const r = assessSavingsActivity(a, [metric('withdrawal_count')]);
  expect(r.facts.withdrawal_count).toBeUndefined(); expect(r.results[0].status).toBe('unknown');
});
test('processed purchases exclude pending, unresolved refunds block, explicit reversal policy counts once', () => {
  const a = assessment(); a.activity!.events = [event('purchase', 'purchase', '20'), { ...event('pending', 'purchase'), status: 'pending' }];
  const m = metric('purchase_count');
  expect(assessSavingsActivity(a, [m]).facts.purchase_count?.value).toBe('1');
  a.activity!.events.push({ ...event('refund', 'refund', '5'), originalPurchaseId: 'purchase' });
  expect(assessSavingsActivity(a, [m]).results[0].reason).toBe('refund_policy_unknown');
  m.refundPolicy = 'exclude_refunded_purchase';
  expect(assessSavingsActivity(a, [m]).facts.purchase_count?.value).toBe('0');
  a.activity!.events.push({ ...event('refund2', 'refund', '5'), originalPurchaseId: 'purchase' });
  expect(assessSavingsActivity(a, [m]).facts.purchase_count?.value).toBe('0');
  a.activity!.events[2].originalPurchaseId = 'outside-window';
  expect(assessSavingsActivity(a, [m]).results[0].reason).toBe('refund_purchase_scope_unknown');
});
test('growth excludes specified interest, fee and tax effects independently', () => {
  const a = assessment(); a.activity!.events = [event('interest', 'interest', '50'), event('fee', 'fee', '10'), event('tax', 'tax', '5')];
  const m = metric('balance_growth');
  expect(assessSavingsActivity(a, [m]).facts.balance_growth?.value).toBe('250.00'); //285 -50 +10 +5
  m.growthAdjustments = { interest: 'include', fee: 'include', tax: 'include' };
  expect(assessSavingsActivity(a, [m]).facts.balance_growth?.value).toBe('285.00');
});
test('unknown classification, date basis and source policies cannot become assumed success', () => {
  const a = assessment(), m = metric('deposit_total'); a.activity!.events = [{ ...event('unknown', 'deposit'), classification: 'unclassified' }];
  expect(assessSavingsActivity(a, [m]).results[0].reason).toBe('activity_classification_unknown');
  a.activity!.events[0].dateBasis = 'transaction';
  expect(assessSavingsActivity(a, [m]).results[0].reason).toBe('activity_date_basis_unknown');
  m.excludedClassifications = ['external'];
  expect(() => validateActivityMetrics([m], () => undefined)).toThrow('classifications');
  const growth = metric('balance_growth'); growth.growthAdjustments = null;
  expect(() => validateActivityMetrics([growth], () => undefined)).toThrow('growth_adjustments');
});
test('duplicate activity identity and non-cent amounts reject the input', () => {
  const a = assessment(); a.activity!.events = [event('same', 'deposit'), event('same', 'deposit')];
  expect(() => validateActivityData(a.activity!)).toThrow('activity_event');
  a.activity!.events = [event('fraction', 'deposit', '0.001')];
  expect(() => validateActivityData(a.activity!)).toThrow('activity_amount');
  a.activity!.events = [];
  a.activity!.coverage.push({ ...a.activity!.coverage[0], from: '2026-08-02', status: 'unknown' });
  expect(() => validateActivityData(a.activity!)).toThrow('activity_interval_overlap');
});
test('structured assessment drives a bonus and defeats a spoofed aggregate', () => {
  const a = assessment(), m = metric('deposit_total'); a.facts.deposit_total = { type: 'decimal', value: '999999', unit: 'AUD' };
  a.activity!.events = [event('real', 'deposit', '250')];
  const rates = { schemaVersion: 1 as const, dailyAccrualRounding: 'aggregate' as const, intervals: [{ id: 'model', from: a.appliesFrom, toExclusive: a.appliesToExclusive, evidenceIds: [],
    components: [{ id: 'bonus', kind: 'bonus' as const, allocation: 'whole_balance' as const, rateMeaning: 'additive' as const, evidenceIds: [],
      tiers: [{ id: 'all', upperInclusive: null, annualRate: '0.05', evidenceIds: [] }],
      qualification: { accountId: 'savings', assessmentKey: a.assessmentKey, activityMetrics: [m], windows: [{ from: a.from, toExclusive: a.toExclusive, appliesFrom: a.appliesFrom, appliesToExclusive: a.appliesToExclusive, evidenceIds: [] }], rule: { id: 'minimum', op: 'compare' as const, field: 'deposit_total', comparison: 'gte' as const, expected: { type: 'decimal' as const, value: '250', unit: 'AUD' } } } }] }] };
  const { contract } = example(); contract.interest.dailyAccrualScale = null;
  expect(savingsInterest(Decimal.parse('1000'), '2026-09-15', contract.interest, rates, [a]).contributions[0].status).toBe('applied');
  a.activity!.events[0].amount = '249.99';
  expect(savingsInterest(Decimal.parse('1000'), '2026-09-15', contract.interest, rates, [a]).contributions[0].status).toBe('does_not_meet');
  a.from = '2026-06-01'; a.toExclusive = '2026-07-01';
  a.activity!.coverage[0].from = a.from; a.activity!.coverage[0].toExclusive = a.toExclusive;
  a.activity!.events[0].date = '2026-06-15'; a.activity!.events[0].amount = '250';
  expect(savingsInterest(Decimal.parse('1000'), '2026-09-15', contract.interest, rates, [a]).contributions[0].status).toBe('needs_information');
  a.activity = undefined;
  expect(savingsInterest(Decimal.parse('1000'), '2026-09-15', contract.interest, rates, [a]).contributions[0].status).toBe('needs_information');
});
