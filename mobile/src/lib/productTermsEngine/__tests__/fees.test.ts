import { calculateLedger } from '../ledger';
import { example } from '../testSupport';
import { EVALUATOR_VERSION, TD_EVALUATOR_VERSION, type Rule } from '../types';
import type { FeeDefinition } from '../feeTypes';
import { feeOccurrences } from '../feeSchedule';

/** Engineering contracts only: these reviewed flags do not approve an actual bank's fees. */
function model() {
  const { contract: c, scenario: s } = example(); const evidence = c.evidence[0].id;
  s.accountId = 'deposit-A'; s.startDate = '2026-01-01'; s.endDateExclusive = '2026-01-04'; s.openingBalance = '100'; s.initialOffset = '0';
  c.direction = 'asset'; c.initialAnnualRate = '0'; c.interest.offset = 'none'; c.interest.postingDates = []; c.interest.dailyAccrualScale = null;
  c.applicability = { cohortKey: s.cohortKey, from: s.startDate, toExclusive: s.endDateExclusive };
  c.review = { ...c.review, applicability: 'verified', materialTerms: 'verified', feeCoverage: 'verified', rateSchedule: 'verified' };
  const rule = (id: string, field = id): Rule => ({ id, op: 'compare', field, comparison: 'eq', expected: { type: 'boolean', value: true }, evidenceIds: [evidence] });
  c.eligibility = rule('eligible'); s.facts.eligible = { type: 'boolean', value: true };
  const fee: FeeDefinition = { id: 'maintenance', chargeIdentity: 'maintenance-obligation', categoryId: 'account-fees', evidenceIds: [evidence],
    scope: { type: 'account', accountId: s.accountId }, order: 0, debit: { type: 'product_balance' },
    timing: { type: 'dated', from: s.startDate, toExclusive: s.endDateExclusive, triggerCoverage: 'reviewed_complete', occurrences: [{ incurredDate: '2026-01-02', dueDate: '2026-01-02', triggerId: 'period-one' }] },
    price: { type: 'fixed', value: '10' }, applicability: null, waiver: null, discounts: [], discountPrecedence: 'exclusive', discountRounding: 'half_up' };
  c.feeSchedule = { schemaVersion: 1, accountId: s.accountId, from: s.startDate, toExclusive: s.endDateExclusive, inventoryCoverage: 'reviewed_complete',
    deferredObligations: 'none_confirmed', evidenceIds: [evidence], ordering: 'before_scenario_events',
    inventory: [{ categoryId: 'account-fees', state: 'scheduled', feeIds: [fee.id], evidenceIds: [evidence] }], fees: [fee] };
  return { c, s, fee, rule, evidence, schedule: c.feeSchedule };
}
test('a legacy verified fee flag cannot claim completeness when the schedule is absent', () => {
  const { c, s } = model(); delete c.feeSchedule;
  const r = calculateLedger(c, s); expect(r.claimAvailable).toBe(false); expect(r.issues).toContain('fee_inventory_not_proven');
  expect(r.totals?.closingBalance).toBe('100.00');
});
test('mandatory fee is generated with no scenario event and preserves account reconciliation', () => {
  const { c, s } = model(); const r = calculateLedger(c, s);
  expect(r.status).toBe('complete'); expect(r.totals).toMatchObject({ feesCharged: '10.00', feesDebitedBalance: '10.00', feesPaidExternal: '0.00', externalCashflowNet: '0.00', closingBalance: '90.00' });
  expect(r.ledger.filter(e => e.type === 'fee')).toHaveLength(1);
  s.events.push({ id: 'different-id', date: '2026-01-02', order: 50, type: 'fee', chargeKey: 'different-key', evidenceIds: c.initialRateEvidenceIds, amount: { type: 'fixed', value: '0' } });
  expect(calculateLedger(c, s).issues).toContain('scenario_fee_override_rejected');
});
test('contractual identity survives display-ID changes and rejects duplicate obligations', () => {
  const { c, s, fee, schedule } = model(); const first = calculateLedger(c, s).ledger.find(e => e.type === 'fee')!.id;
  fee.id = 'renamed'; schedule.inventory[0].feeIds = [fee.id];
  expect(calculateLedger(c, s).ledger.find(e => e.type === 'fee')!.id).toBe(first);
  schedule.fees.push({ ...fee, id: 'duplicate', order: 1 }); schedule.inventory[0].feeIds.push('duplicate');
  expect(calculateLedger(c, s).issues).toContain('fee_identity_order_collision');
});
test('recurring month-end dates use their explicit convention and finite horizon', () => {
  const { c, s, fee, schedule } = model(); s.endDateExclusive = schedule.toExclusive = c.applicability.toExclusive = '2026-04-02';
  fee.timing = { type: 'recurring', anchor: '2026-01-31', unit: 'months', step: 1, monthConvention: 'preserve_month_end', from: s.startDate, toExclusive: s.endDateExclusive, calendarAdjustment: 'none', settlement: 'same_day' };
  expect(calculateLedger(c, s).ledger.filter(e => e.type === 'fee').map(e => e.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  fee.timing.calendarAdjustment = 'unknown';
  const unresolved = calculateLedger(c, s); expect(unresolved.issues).toContain('fee_timing_unknown:maintenance'); expect(unresolved.claimAvailable).toBe(false);
});
test('source ordering and named snapshots bind percentage bases; caps remain exact', () => {
  const { c, s, fee, schedule } = model(); s.events = [{ id: 'deposit', date: '2026-01-02', order: 999, type: 'cashflow', delta: '100', label: 'deposit' }];
  fee.price = { type: 'percentage', fraction: '0.1', basis: { type: 'balance', accountId: s.accountId!, point: 'before_fee' }, rounding: 'half_up', minimum: '5', maximum: '15' };
  expect(calculateLedger(c, s).totals?.feesCharged).toBe('10.00');
  schedule.ordering = 'after_scenario_events'; expect(calculateLedger(c, s).totals?.feesCharged).toBe('15.00');
  fee.price.basis = { type: 'balance', accountId: s.accountId!, point: 'day_open' };
  expect(calculateLedger(c, s).totals?.feesCharged).toBe('10.00');
});
test('percentage fact requires exact account, period and AUD unit', () => {
  const { c, s, fee } = model();
  fee.price = { type: 'percentage', fraction: '0.1', basis: { type: 'fact', name: 'source-basis', accountId: s.accountId!, unit: 'AUD', from: s.startDate, toExclusive: s.endDateExclusive }, rounding: 'half_up' };
  s.feeFacts = [{ name: 'source-basis', accountId: 'other', from: s.startDate, toExclusive: s.endDateExclusive, value: { type: 'decimal', value: '50', unit: 'AUD' } }];
  expect(calculateLedger(c, s).ledger.find(e => e.type === 'fee')?.amount).toBeNull();
  s.feeFacts[0].accountId = s.accountId!; expect(calculateLedger(c, s).totals?.feesCharged).toBe('5.00');
  s.feeFacts.push(s.feeFacts[0]); expect(calculateLedger(c, s).ledger.find(e => e.type === 'fee')?.amount).toBeNull();
});
test.each([true, false, undefined])('waiver %s preserves source traces and missing-state semantics', value => {
  const { c, s, fee, rule, evidence } = model(); fee.waiver = rule('waiver');
  fee.ruleAssessments = [{ dueDate: '2026-01-02', accountId: s.accountId!, from: s.startDate, toExclusive: s.endDateExclusive, factNames: ['waiver'], evidenceIds: [evidence] }];
  if (value !== undefined) s.feeFacts = [{ name: 'waiver', accountId: s.accountId!, from: s.startDate, toExclusive: s.endDateExclusive, value: { type: 'boolean', value } }];
  const r = calculateLedger(c, s), line = r.ledger.find(e => e.type === 'fee')!;
  expect(line.amount).toBe(value === undefined ? null : value ? '0.00' : '10.00');
  expect(line.feeRuleTraces?.[0].status).toBe(value === undefined ? 'needs_information' : value ? 'meets' : 'does_not_meet');
  expect(line.evidenceIds).toContain(evidence);
  if (value === undefined) expect(r.ledger.find(e => e.date === '2026-01-03' && e.type === 'interest_accrual')?.note).toContain('unresolved fees');
});
test('exclusive discount conflict is unpriced; explicit additive reductions do not compound', () => {
  const { c, s, fee, rule, evidence } = model();
  fee.ruleAssessments = [{ dueDate: '2026-01-02', accountId: s.accountId!, from: s.startDate, toExclusive: s.endDateExclusive, factNames: ['a', 'b'], evidenceIds: [evidence] }];
  s.feeFacts = ['a', 'b'].map(name => ({ name, accountId: s.accountId!, from: s.startDate, toExclusive: s.endDateExclusive, value: { type: 'boolean', value: true } }));
  fee.discounts = [{ id: 'a', rule: rule('a'), type: 'fraction', value: '0.1' }, { id: 'b', rule: rule('b'), type: 'fixed', value: '2' }];
  expect(calculateLedger(c, s).ledger.find(e => e.type === 'fee')?.amount).toBeNull();
  fee.discountPrecedence = 'additive'; expect(calculateLedger(c, s).totals?.feesCharged).toBe('7.00');
  fee.discountRounding = 'unknown'; expect(calculateLedger(c, s).ledger.find(e => e.type === 'fee')?.amount).toBeNull();
});
test('indexed gaps never substitute a nearby price; explicit zero is priced', () => {
  const { c, s, fee, evidence } = model(); fee.price = { type: 'indexed', indexId: 'source-index', observations: [{ from: '2026-01-01', toExclusive: '2026-01-02', value: '0', evidenceIds: [evidence] }] };
  expect(calculateLedger(c, s).ledger.find(e => e.type === 'fee')?.amount).toBeNull();
  fee.price.observations[0].toExclusive = '2026-01-03'; expect(calculateLedger(c, s).totals?.feesCharged).toBe('0.00');
});

test('monthly waivers require the reviewed occurrence account and assessment period', () => {
  const { c, s, fee, schedule, rule, evidence } = model();
  s.endDateExclusive = schedule.toExclusive = c.applicability.toExclusive = '2026-03-01';
  fee.timing = { type: 'recurring', anchor: '2026-01-02', unit: 'months', step: 1, monthConvention: 'clamp', from: s.startDate, toExclusive: s.endDateExclusive, calendarAdjustment: 'none', settlement: 'same_day' };
  fee.waiver = rule('eligible-waiver', 'eligible');
  expect(calculateLedger(c, s).ledger.filter(e => e.type === 'fee').map(e => e.amount)).toEqual([null, null]);
  fee.ruleAssessments = [{ dueDate: '2026-01-02', accountId: s.accountId!, from: '2025-12-01', toExclusive: '2026-01-01', factNames: ['eligible'], evidenceIds: [evidence] }];
  s.feeFacts = [{ name: 'eligible', accountId: s.accountId!, from: '2025-12-01', toExclusive: '2026-01-01', value: { type: 'boolean', value: true } }];
  expect(calculateLedger(c, s).ledger.filter(e => e.type === 'fee').map(e => e.amount)).toEqual(['0.00', null]);
  s.feeFacts[0].accountId = 'other'; expect(calculateLedger(c, s).ledger.find(e => e.type === 'fee')?.amount).toBeNull();
});

test('false discount does not require unused discount rounding', () => {
  const { c, s, fee, rule, evidence } = model();
  fee.discounts = [{ id: 'discount', rule: rule('discount'), type: 'fixed', value: '2' }]; fee.discountRounding = 'unknown';
  fee.ruleAssessments = [{ dueDate: '2026-01-02', accountId: s.accountId!, from: s.startDate, toExclusive: s.endDateExclusive, factNames: ['discount'], evidenceIds: [evidence] }];
  s.feeFacts = [{ name: 'discount', accountId: s.accountId!, from: s.startDate, toExclusive: s.endDateExclusive, value: { type: 'boolean', value: false } }];
  expect(calculateLedger(c, s).totals?.feesCharged).toBe('10.00');
});

test('distinct same-day conditional triggers cannot reuse a single date assessment', () => {
  const { c, s, fee, rule } = model(); fee.waiver = rule('waiver');
  if (fee.timing.type !== 'dated') throw new Error();
  fee.timing.occurrences.push({ ...fee.timing.occurrences[0], triggerId: 'second-transaction' });
  expect(calculateLedger(c, s).issues).toContain('fee_same_day_conditional_triggers_unsupported');
});

test('malformed prototype fee facts cannot provide undeclared waiver fields', () => {
  const { c, s, fee, rule, evidence } = model(); fee.waiver = rule('waiver', 'target');
  fee.ruleAssessments = [{ dueDate: '2026-01-02', accountId: s.accountId!, from: s.startDate, toExclusive: s.endDateExclusive, factNames: ['__proto__'], evidenceIds: [evidence] }];
  s.feeFacts = JSON.parse('[{"name":"__proto__","accountId":"deposit-A","from":"2026-01-01","toExclusive":"2026-01-04","value":{"target":{"type":"boolean","value":true}}}]');
  expect(calculateLedger(c, s).issues).toContain('fee_fact_scope_invalid');
  s.feeFacts![0].value = { type: 'boolean', value: true };
  expect(calculateLedger(c, s).ledger.find(e => e.type === 'fee')?.amount).toBeNull();
});

test('final supported calendar month does not compute an unused year 2201 date', () => {
  const { fee, schedule } = model();
  fee.timing = { type: 'recurring', anchor: '2200-12-01', unit: 'months', step: 1, monthConvention: 'clamp', from: '2200-12-01', toExclusive: '2200-12-31', calendarAdjustment: 'none', settlement: 'same_day' };
  expect(feeOccurrences(schedule).map(o => o.dueDate)).toEqual(['2200-12-01']);
});
test('external mortgage fees are separate and never capitalized into the loan', () => {
  const { c, s, fee } = model(); c.direction = 'liability'; fee.debit = { type: 'external_account', accountId: 'transaction-B' };
  expect(calculateLedger(c, s).totals).toMatchObject({ closingBalance: '100.00', feesCharged: '10.00', feesPaidExternal: '10.00', feesDebitedBalance: '0.00', externalCashflowNet: '0.00' });
  fee.debit = { type: 'product_balance' }; expect(calculateLedger(c, s).totals?.closingBalance).toBe('110.00');
});
test('package debtor pays once; other member does not inherit a duplicate charge or portfolio claim', () => {
  const { c, s, fee, schedule } = model(); fee.scope = { type: 'package', packageInstanceId: 'package-one', memberAccountIds: ['deposit-A', 'deposit-B'], debtorAccountId: 'deposit-A' };
  const a = calculateLedger(c, s); expect(a.totals?.feesCharged).toBe('10.00'); expect(a.issues).toContain('package_portfolio_coverage_unsupported');
  s.accountId = schedule.accountId = 'deposit-B'; expect(calculateLedger(c, s).totals?.feesCharged).toBe('0.00');
  fee.scope.memberAccountIds = ['deposit-A']; expect(calculateLedger(c, s).issues).toContain('fee_package_members_invalid');
});
test('unknown price taints downstream interest, while known fees change the deposit basis', () => {
  const { c, s, fee } = model(); c.initialAnnualRate = '0.365';
  expect(calculateLedger(c, s).totals?.interestAccrued).toBe('0.280000000000');
  fee.price = { type: 'unknown', reason: 'not supplied' };
  const r = calculateLedger(c, s); expect(r.issues).toContain('balance_interest_fee_dependency_unknown'); expect(r.claimAvailable).toBe(false);
});
test('incurred but later-payable obligations and unknown inventory prevent complete cost claims', () => {
  const { c, s, fee, schedule } = model(); if (fee.timing.type !== 'dated') throw new Error();
  fee.timing.occurrences[0].dueDate = '2026-02-01'; schedule.deferredObligations = 'listed';
  expect(calculateLedger(c, s).issues.some(i => i.startsWith('fee_payable_after_horizon:'))).toBe(true);
  schedule.deferredObligations = 'unknown'; expect(calculateLedger(c, s).issues).toContain('balance_interest_fee_dependency_unknown');
});
test('v3 cannot silently consume fee schedules; general fees cannot be appended to TD', () => {
  const { c, s } = model(); c.evaluatorVersion = TD_EVALUATOR_VERSION;
  expect(calculateLedger(c, s).issues).toContain('contract_version_unsupported');
  c.evaluatorVersion = EVALUATOR_VERSION; c.tdLifecycle = {} as NonNullable<typeof c.tdLifecycle>;
  expect(calculateLedger(c, s).issues).toContain('general_fees_with_td_unsupported');
});


