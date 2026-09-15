import { example } from '../testSupport';
import { calculatePortfolio } from '../portfolio';
import { comparePortfolios, crossing } from '../portfolioComparison';
import type { PortfolioAccount, PortfolioInput } from '../portfolioTypes';
import type { LoanContract } from '../loanTypes';
import { calculateLedger } from '../ledger';
import { canonical, hashText } from '../validation';
import { feeOccurrences } from '../feeSchedule';
import { BudgetArray, EvaluationBudget } from '../evaluationBudget';

function account(id: string, opening: string): PortfolioAccount {
  const { contract: c, scenario: s } = example(), evidence = c.evidence[0].id;
  c.direction = 'asset'; c.initialAnnualRate = '0'; c.interest.offset = 'none'; c.interest.postingDates = []; c.interest.dailyAccrualScale = null;
  s.accountId = id; s.startDate = '2026-01-01'; s.endDateExclusive = '2026-01-22'; s.openingBalance = opening; s.initialOffset = '0'; s.events = []; s.assumptions = [];
  c.applicability = { cohortKey: s.cohortKey, from: s.startDate, toExclusive: s.endDateExclusive };
  c.review = { ...c.review, applicability: 'verified', materialTerms: 'verified', feeCoverage: 'verified', rateSchedule: 'verified' };
  c.eligibility = { id: 'eligible', op: 'compare', field: 'eligible', comparison: 'eq', expected: { type: 'boolean', value: true }, evidenceIds: [evidence] }; s.facts.eligible = { type: 'boolean', value: true };
  c.feeSchedule = { schemaVersion: 1, accountId: id, from: s.startDate, toExclusive: s.endDateExclusive, inventoryCoverage: 'reviewed_complete', deferredObligations: 'none_confirmed', evidenceIds: [evidence], ordering: 'before_scenario_events', inventory: [{ categoryId: 'fees', state: 'none_applicable', feeIds: [], evidenceIds: [evidence] }], fees: [] };
  return { id, timezone: 'Australia/Hobart', contract: c, scenario: s };
}
function loan(id: string): PortfolioAccount {
  const a = account(id, '500'), c = a.contract, s = a.scenario, evidence = c.evidence[0].id;
  c.direction = 'liability'; c.interest.balanceBasis = 'loan_declared_component_basis'; c.interest.eventOrder = 'loan_declared_payment_phase_then_posting';
  const l: LoanContract = { schemaVersion: 1, accountId: id, cohortKey: s.cohortKey, offerId: 'offer', sourceVersion: 'source', from: s.startDate, toExclusive: s.endDateExclusive, evidenceIds: [evidence],
    opening: { effectiveDate: s.startDate, snapshotId: 'snapshot', outstanding: '500', components: { principal: '500', postedInterest: '0', accruedInterest: '0', capitalizedCharges: '0', otherDebt: '0' }, redrawAvailable: '0', evidenceIds: [evidence] },
    interestBearing: ['principal'], allocation: ['accruedInterest', 'postedInterest', 'capitalizedCharges', 'otherDebt', 'principal'], paymentTiming: 'before_accrual', overpayment: 'reject', paymentRounding: 'half_up', accruedSettlement: 'round_before_each_payment', advancesTiming: 'start_of_day_before_fees', feeBalanceBasis: 'outstanding_including_unposted', obligationMeasurement: 'before_payment_phase', reversalPolicy: 'restore_components_no_interest_recalculation', scheduleCoverage: 'reviewed_complete', obligations: [], advances: [], rates: [], extraPayments: { allowed: true, totalCap: '1000', increasesRedraw: false, evidenceIds: [evidence] }, redraw: { allowed: false, totalCap: '0', evidenceIds: [evidence] }, feeFunding: [], offset: null, closure: null };
  c.loanContract = l; s.loan = { offerId: 'offer', sourceVersion: 'source', openingSnapshotId: 'snapshot', mode: 'cleared', executions: [] }; return a;
}
function portfolio(accounts: PortfolioAccount[], opening = '1000'): PortfolioInput {
  return { schemaVersion: 1, frame: { id: 'frame', currency: 'AUD', startDate: '2026-01-01', endDateExclusive: '2026-01-22', timezone: 'Australia/Hobart', settlement: 'same_civil_day', valuation: 'holding_with_accrued_interest', openingNetWorth: opening, scopeCoverage: 'reviewed_complete', externalFlows: [], externalFeeFunding: 'outside_frame_cost_adjustment', allowConditional: false, metric: 'terminal_net_worth' }, accounts, transfers: [], dependencyGraph: [], dependencyIds: ['engineering-model'] };
}
function fee(a: PortfolioAccount, value: string) {
  const f = a.contract.feeSchedule!, evidenceIds = [a.contract.evidence[0].id];
  f.inventory = [{ categoryId: 'fees', state: 'scheduled', feeIds: ['maintenance'], evidenceIds }];
  f.fees = [{ id: 'maintenance', chargeIdentity: 'maintenance', categoryId: 'fees', evidenceIds, scope: { type: 'account', accountId: a.id }, timing: { type: 'dated', from: a.scenario.startDate, toExclusive: a.scenario.endDateExclusive, triggerCoverage: 'reviewed_complete', occurrences: [{ incurredDate: '2026-01-21', dueDate: '2026-01-21', triggerId: 'one' }] }, order: 0, debit: { type: 'product_balance' }, price: { type: 'fixed', value }, applicability: null, waiver: null, discounts: [], discountPrecedence: 'exclusive', discountRounding: 'half_up' }];
}
test('identified internal transfer conserves customer wealth and has two exact legs', () => {
  const p = portfolio([account('A', '600'), account('B', '400')]);
  p.dependencyGraph = [{ from: 'A', to: 'B' }]; p.transfers = [{ id: 'transfer', from: 'A', to: 'B', date: '2026-01-02', order: 10, status: 'cleared', amount: { type: 'fixed', value: '100' }, evidenceIds: [p.accounts[0].contract.evidence[0].id] }];
  const r = calculatePortfolio(p); expect(r.issues).toEqual([]); expect(r.completeness).toBe('factual_complete'); expect(r.closingNetWorth).toBe('1000.000000000000');
  expect(r.accounts.A.totals?.closingBalance).toBe('500.00'); expect(r.accounts.B.totals?.closingBalance).toBe('500.00'); expect(r.externalContributionNet).toBe('0.00'); expect(r.transfers).toHaveLength(1);
  const standalone = calculateLedger(p.accounts[0].contract, p.accounts[0].scenario);
  expect(r.accounts.A.inputSha256).not.toBe(standalone.inputSha256);
  expect(r.accounts.A.portfolioBinding?.portfolioInputSha256).toBe(r.inputSha256);
  p.transfers[0].amount = { type: 'fixed', value: '50' };
  expect(calculatePortfolio(p).accounts.A.inputSha256).not.toBe(r.accounts.A.inputSha256);
});
test('day-open fee basis remains before incoming transfer and ordering is explicit', () => {
  const p = portfolio([account('A', '900'), account('B', '100')]); fee(p.accounts[1], '10');
  p.accounts[1].contract.feeSchedule!.fees[0].price = { type: 'percentage', fraction: '0.1', basis: { type: 'balance', accountId: 'B', point: 'day_open' }, rounding: 'half_up' };
  p.dependencyGraph = [{ from: 'A', to: 'B' }]; p.transfers = [{ id: 'transfer', from: 'A', to: 'B', date: '2026-01-21', order: 10, status: 'cleared', amount: { type: 'fixed', value: '100' }, evidenceIds: [p.accounts[0].contract.evidence[0].id] }];
  expect(calculatePortfolio(p).accounts.B.totals?.feesCharged).toBe('10.00');
  p.accounts[1].scenario.events = [{ id: 'collision', date: '2026-01-21', order: 10, type: 'cashflow', delta: '1', label: 'collision' }]; expect(calculatePortfolio(p).issues).toContain('portfolio_event_order_collision');
});
function oracle(alternative: 'A' | 'B') {
  const a = account('cash', '1000'), l = loan('loan'), p = portfolio([a, l], '500'), evidence = a.contract.evidence[0].id;
  a.contract.initialAnnualRate = alternative === 'A' ? '0.1825' : '0.219'; l.contract.initialAnnualRate = alternative === 'A' ? '0.73' : '0.657';
  a.contract.interest.postingDates = l.contract.interest.postingDates = ['2026-01-20'];
  a.scenario.events = [{ id: 'contribution', date: '2026-01-21', order: 0, type: 'cashflow', delta: '100', label: 'contribution' }, { id: 'zero-rate', date: '2026-01-21', order: 1, type: 'rate', annualRate: '0', evidenceIds: [evidence] }];
  l.contract.loanContract!.rates = [{ date: '2026-01-21', annualRate: '0', evidenceIds: [evidence] }]; fee(a, alternative === 'A' ? '5' : '10');
  p.frame.externalFlows = [{ id: 'contribution', date: '2026-01-21', delta: '100' }]; p.dependencyGraph = [{ from: 'cash', to: 'loan' }];
  p.transfers = [{ id: 'repayment', from: 'cash', to: 'loan', date: '2026-01-21', order: 10, status: 'cleared', amount: { type: 'fixed', value: alternative === 'A' ? '120' : '118' }, targetLoan: { type: 'extra_payment' }, evidenceIds: [evidence] }]; return p;
}
test('independent wealth oracle585/584 compares costs15/16, not repayment amounts120/118', () => {
  const a = calculatePortfolio(oracle('A')), b = calculatePortfolio(oracle('B'));
  expect(a.issues).toEqual([]); expect(a.closingNetWorth).toBe('585.000000000000'); expect(b.closingNetWorth).toBe('584.000000000000');
  expect(a.netInterestFeeCost).toBe('15.000000000000'); expect(b.netInterestFeeCost).toBe('16.000000000000');
  const comparison = comparePortfolios({ schemaVersion: 1, referenceId: 'B', alternatives: [{ id: 'A', input: oracle('A') }, { id: 'B', input: oracle('B') }] });
  expect(comparison.available).toBe(true); expect(comparison.results[0]).toMatchObject({ advantage: '1.000000000000', rank: 1 });
});
test('unknown fee never becomes zero or a ranked known subtotal', () => {
  const a = oracle('A'); a.accounts[0].contract.feeSchedule!.fees[0].price = { type: 'unknown', reason: 'not priced' };
  const r = comparePortfolios({ schemaVersion: 1, referenceId: 'B', alternatives: [{ id: 'A', input: a }, { id: 'B', input: oracle('B') }] });
  expect(r.available).toBe(false); expect(r.results[0].advantage).toBeNull();
});
test('crossing distinguishes initial equality, transient lead and final evaluated sustained interval', () => {
  expect(crossing(['D0', 'D1', 'D2', 'D3', 'D4'], ['0', '2', '-1', '3', '3'])).toEqual({ firstPositive: 'D1', sustainedFrom: 'D3', through: 'D4', transient: true, tiedDates: ['D0'] });
});

test('one shared package obligation debits its complete declared owner once', () => {
  const p = portfolio([account('A', '600'), account('B', '400')]), evidenceIds = [p.accounts[0].contract.evidence[0].id];
  for (const a of p.accounts) { fee(a, '10'); a.contract.feeSchedule!.fees[0].scope = { type: 'package', packageInstanceId: 'package', memberAccountIds: ['A', 'B'], debtorAccountId: 'A' }; }
  p.packages = [{ id: 'package', memberAccountIds: ['A', 'B'], debtorAccountId: 'A', from: p.frame.startDate, toExclusive: p.frame.endDateExclusive, evidenceIds }];
  const r = calculatePortfolio(p); expect(r.issues).toEqual([]); expect(r.completeness).toBe('factual_complete'); expect(r.closingNetWorth).toBe('990.000000000000');
  expect(r.accounts.A.totals?.feesCharged).toBe('10.00'); expect(r.accounts.B.totals?.feesCharged).toBe('0.00');
  for (const a of p.accounts) a.contract.feeSchedule!.fees[0].price = { type: 'percentage', fraction: '0.01', basis: { type: 'balance', accountId: 'A', point: 'day_open' }, rounding: 'half_up' };
  expect(calculatePortfolio(p).closingNetWorth).toBe('994.000000000000');
  p.packages[0].memberAccountIds = ['A']; expect(calculatePortfolio(p).issues).toContain('portfolio_package_membership_mismatch');
});

test('TD lifecycle and external general fee route once, with identified linked payout', () => {
  const td = account('TD', '1000'), target = account('linked', '0'), p = portfolio([td, target]), evidenceIds = [td.contract.evidence[0].id];
  td.contract.initialAnnualRate = '0.365';
  td.contract.tdLifecycle = { schemaVersion: 1, mode: 'digital_notice_no_interest', cohortKey: td.scenario.cohortKey, evidenceIds, confirmationEvidenceIds: evidenceIds, investmentAmount: '1000', fundedDate: '2026-01-01', accrualStartDate: '2026-01-01', term: { unit: 'days', count: 20, monthConvention: 'clamp' }, nominalMaturityDate: '2026-01-21', calendar: null, roundingReviewed: true, taxTreatment: 'none_confirmed', payments: { cadence: 'maturity', destination: 'linked_account', firstPeriodEnd: null, monthConvention: 'clamp', periodEnds: [], evidenceIds }, closure: { kind: 'maturity', confirmedDate: '2026-01-21', acceptedNoticeDate: null, feeDecision: 'waived', principalRecovery: 'confirmed_if_required', evidenceIds } };
  fee(td, '5'); td.contract.feeSchedule!.fees[0].debit = { type: 'external_account', accountId: 'outside-funding' };
  td.contract.feeSchedule!.inventory.push({ categoryId: 'break', state: 'lifecycle_owned', lifecycleOccurrenceId: 'td:break-fee', feeIds: [], evidenceIds });
  p.tdFeeRoutes = [{ accountId: 'TD', generalFees: 'external_only', lifecycleOccurrenceId: 'td:break-fee', evidenceIds }];
  p.dependencyGraph = [{ from: 'TD', to: 'linked' }]; p.transfers = [{ id: 'maturity', from: 'TD', to: 'linked', date: '2026-01-21', order: 10, status: 'cleared', amount: { type: 'generated_cashflow', occurrenceId: 'td:closure' }, evidenceIds }];
  const r = calculatePortfolio(p); expect(r.issues).toEqual([]); expect(r.completeness).toBe('factual_complete'); expect(r.closingNetWorth).toBe('1015.000000000000');
  expect(r.accounts.linked.totals?.closingBalance).toBe('1020.00'); expect(r.accounts.TD.totals?.feesPaidExternal).toBe('5.00');
});

test('acknowledged projected transfers enable conditional comparison without becoming cleared facts', () => {
  const p = oracle('A'); for (const a of p.accounts) a.contract.evaluatorVersion = 'product-terms-engine-v6'; p.frame.allowConditional = true; p.transfers[0].status = 'projected'; p.accounts[1].scenario.loan!.mode = 'projected';
  p.projectedTransferAssumption = { id: 'future-payments', acknowledged: true, transfersSha256: hashText(canonical(p.transfers)) };
  const r = calculatePortfolio(p); expect(r.completeness).toBe('conditional_complete'); expect(r.transfers[0].status).toBe('projected');
  expect(r.accounts.loan.issueDetails?.[0].kind).toBe('acknowledged_assumption');
  p.transfers[0].amount = { type: 'fixed', value: '119' }; expect(calculatePortfolio(p).completeness).toBe('incomplete');
});

test('opposite transfers on different dates form no chronological cycle', () => {
  const p = portfolio([account('A', '600'), account('B', '400')]), evidenceIds = [p.accounts[0].contract.evidence[0].id];
  p.dependencyGraph = [{ from: 'A', to: 'B', date: '2026-01-02' }, { from: 'B', to: 'A', date: '2026-01-03' }];
  p.transfers = [{ id: 'there', from: 'A', to: 'B', date: '2026-01-02', order: 10, status: 'cleared', amount: { type: 'fixed', value: '100' }, evidenceIds }, { id: 'back', from: 'B', to: 'A', date: '2026-01-03', order: 10, status: 'cleared', amount: { type: 'fixed', value: '100' }, evidenceIds }];
  expect(calculatePortfolio(p).closingNetWorth).toBe('1000.000000000000');
  p.dependencyGraph[1].date = p.transfers[1].date = '2026-01-02'; p.transfers[1].order = 11;
  expect(calculatePortfolio(p).issues).toContain('portfolio_dependency_cycle');
});

test('source-generated fee reconciles once into scoped savings growth, with explicit fee exclusion', () => {
  const a = account('A', '600'), b = account('B', '400'), p = portfolio([a, b]), evidenceIds = [b.contract.evidence[0].id]; fee(a, '10');
  const timing = a.contract.feeSchedule!.fees[0].timing; if (timing.type !== 'dated') throw new Error(); timing.occurrences[0].incurredDate = timing.occurrences[0].dueDate = '2026-01-01';
  const tier = { id: 'tier', upperInclusive: null, annualRate: '0', evidenceIds };
  b.contract.savingsSchedule = { schemaVersion: 1, dailyAccrualRounding: 'aggregate', intervals: [
    { id: 'first', from: '2026-01-01', toExclusive: '2026-01-02', evidenceIds, components: [{ id: 'base', kind: 'base', allocation: 'whole_balance', rateMeaning: 'additive', tiers: [tier], qualification: null, evidenceIds }] },
    { id: 'later', from: '2026-01-02', toExclusive: '2026-01-22', evidenceIds, components: [{ id: 'bonus', kind: 'bonus', allocation: 'whole_balance', rateMeaning: 'additive', tiers: [{ ...tier, annualRate: '0.365' }], evidenceIds,
      qualification: { accountId: 'A', assessmentKey: 'growth', windows: [{ from: '2026-01-01', toExclusive: '2026-01-02', appliesFrom: '2026-01-02', appliesToExclusive: '2026-01-22', evidenceIds }],
        rule: { id: 'growth-rule', op: 'compare', field: 'growth', comparison: 'gte', expected: { type: 'decimal', value: '0', unit: 'AUD' }, evidenceIds },
        activityMetrics: [{ id: 'growth-metric', field: 'growth', accountRole: 'linked', accountIds: ['A'], kind: 'balance_growth', dateBasis: 'processed', settlement: 'settled_only', includedClassifications: [], excludedClassifications: [], refundPolicy: 'ignore', growthAdjustments: { interest: 'exclude', fee: 'exclude', tax: 'exclude' }, evidenceIds }] } }] } ] };
  b.scenario.savingsAssessments = [{ id: 'assessment', assessmentKey: 'growth', accountId: 'A', from: '2026-01-01', toExclusive: '2026-01-02', appliesFrom: '2026-01-02', appliesToExclusive: '2026-01-22', coverage: 'complete', facts: {}, evidenceIds,
    activity: { events: [], coverage: [{ accountId: 'A', from: '2026-01-01', toExclusive: '2026-01-02', status: 'complete' }], balances: [{ accountId: 'A', from: '2026-01-01', toExclusive: '2026-01-02', opening: '600', closing: '590' }] } }];
  p.activityBindings = [{ accountId: 'B', assessmentId: 'assessment', sourceAccountIds: ['A'], evidenceIds, entries: [{ sourceAccountId: 'A', sourceType: 'fee', sourceOccurrenceId: feeOccurrences(a.contract.feeSchedule!)[0].id, date: '2026-01-01', activityId: 'actual-fee', kind: 'fee', classification: 'fee', dateBasis: 'processed', status: 'settled' }] }];
  const r = calculatePortfolio(p); expect(r.issues).toEqual([]); expect(r.completeness).toBe('factual_complete'); expect(r.closingNetWorth).toBe('998.000000000000');
  expect(b.scenario.savingsAssessments[0].activity!.events).toEqual([]); // Caller input remains immutable.
  p.activityBindings![0].entries[0].status = 'pending';
  expect(calculatePortfolio(p).accounts.B.issues).toContain('portfolio_activity_reconciliation_unknown');
  p.activityBindings![0].entries[0].status = 'settled';
  const negative = JSON.parse(JSON.stringify(p)) as PortfolioInput;
  negative.accounts[0].contract.feeSchedule!.fees = [];
  negative.accounts[0].contract.feeSchedule!.inventory[0].state = 'none_applicable';
  negative.accounts[0].contract.feeSchedule!.inventory[0].feeIds = [];
  negative.accounts[0].contract.initialAnnualRate = '-0.365';
  negative.accounts[0].contract.interest.postingDates = ['2026-01-01'];
  negative.accounts[1].scenario.savingsAssessments![0].activity!.balances[0].closing = '599.40';
  Object.assign(negative.activityBindings![0].entries[0], { sourceType: 'interest_posting', sourceOccurrenceId: 'post:2026-01-01', kind: 'interest' });
  const signedPosting = calculatePortfolio(negative);
  expect(signedPosting.accounts.A.ledger.find(row => row.id === 'post:2026-01-01')?.amount).toBe('-0.60');
  expect(signedPosting.accounts.B.issues).toContain('portfolio_activity_reconciliation_unknown');
  expect(signedPosting.completeness).toBe('incomplete');
  a.contract.feeSchedule!.fees[0].price = { type: 'unknown', reason: 'unpriced' };
  const unknown = calculatePortfolio(p); expect(unknown.completeness).toBe('incomplete');
  expect(unknown.accounts.B.issues).toContain('portfolio_activity_reconciliation_unknown');
});

test('external fee funded by another portfolio account reduces wealth once with an identified payment', () => {
  const p = portfolio([account('A', '600'), account('B', '400')]), evidenceIds = [p.accounts[0].contract.evidence[0].id]; fee(p.accounts[0], '10');
  p.accounts[0].contract.feeSchedule!.fees[0].debit = { type: 'external_account', accountId: 'B' };
  p.dependencyGraph = [{ from: 'A', to: 'B' }]; p.feeFundingRoutes = [{ sourceAccountId: 'A', fundingAccountId: 'B', occurrenceId: feeOccurrences(p.accounts[0].contract.feeSchedule!)[0].id, date: '2026-01-21', order: 10, status: 'cleared', evidenceIds }];
  const r = calculatePortfolio(p); expect(r.completeness).toBe('factual_complete'); expect(r.closingNetWorth).toBe('990.000000000000'); expect(r.fundedFees).toHaveLength(1);
  expect(r.externalContributionNet).toBe('0.00'); expect(r.accounts.A.totals?.closingBalance).toBe('600.00'); expect(r.accounts.B.totals?.closingBalance).toBe('390.00');
  p.accounts[0].contract.feeSchedule!.fees[0].price = { type: 'unknown', reason: 'unpriced' };
  const unknown = calculatePortfolio(p); expect(unknown.completeness).toBe('incomplete'); expect(unknown.accounts.B.ledger.find(e => e.id === 'accrue:2026-01-21')?.amount).toBeNull();
});

test('same-day fee assessments bind each distinct trigger and its period', () => {
  const a = account('A', '1000'); a.contract.evaluatorVersion = 'product-terms-engine-v6'; fee(a, '10'); const f = a.contract.feeSchedule!.fees[0], evidenceIds = [a.contract.evidence[0].id];
  if (f.timing.type !== 'dated') throw new Error(); f.timing.occurrences.push({ incurredDate: '2026-01-21', dueDate: '2026-01-21', triggerId: 'two' });
  f.waiver = { id: 'waiver', op: 'compare', field: 'waived', comparison: 'eq', expected: { type: 'boolean', value: true }, evidenceIds };
  f.ruleAssessments = [{ triggerId: 'one', dueDate: '2026-01-21', accountId: 'A', from: '2026-01-01', toExclusive: '2026-01-02', factNames: ['waived'], evidenceIds }, { triggerId: 'two', dueDate: '2026-01-21', accountId: 'A', from: '2026-01-02', toExclusive: '2026-01-03', factNames: ['waived'], evidenceIds }];
  a.scenario.feeFacts = f.ruleAssessments.map((r, i) => ({ name: 'waived', accountId: 'A', from: r.from, toExclusive: r.toExclusive, value: { type: 'boolean', value: i === 0 } }));
  const r = calculateLedger(a.contract, a.scenario); expect(r.ledger.filter(e => e.type === 'fee').map(e => e.amount)).toEqual(['0.00', '10.00']);
});

test('common two-account thirty-year envelope fits while oversized combined work is rejected before execution', () => {
  const p = portfolio([account('A', '600'), account('B', '400')]); p.frame.endDateExclusive = '2056-01-01';
  for (const a of p.accounts) a.scenario.endDateExclusive = a.contract.applicability.toExclusive = a.contract.feeSchedule!.toExclusive = p.frame.endDateExclusive;
  const r = calculatePortfolio(p); expect(r.completeness).toBe('factual_complete'); expect(r.closingNetWorth).toBe('1000.000000000000');
  const comparison = comparePortfolios({ schemaVersion: 1, referenceId: '0', alternatives: Array.from({ length: 8 }, (_, i) => ({ id: String(i), input: p })) });
  expect(comparison.issues).toContain('evaluation_account_day_budget_exceeded'); expect(comparison.results).toEqual([]);
});

test('receipt emission rejects an oversized row before appending it', () => {
  const rows = new BudgetArray<string>(new EvaluationBudget(), true); rows.push('small');
  expect(() => rows.push('x'.repeat(12 * 1024 * 1024))).toThrow('evaluation_output_budget_exceeded'); expect(rows).toHaveLength(1);
});

test('loan offset uses the actual portfolio balance and rejects an unchanged stale allocation snapshot', () => {
  const cash = account('cash', '1000'), debt = loan('loan'), p = portfolio([cash, debt], '500'), evidenceIds = [debt.contract.evidence[0].id];
  debt.contract.initialAnnualRate = '0.365'; debt.contract.interest.offset = 'capped_at_balance';
  debt.contract.loanContract!.offset = { coverage: 'complete', balanceHistory: 'complete_step_schedule', from: p.frame.startDate, toExclusive: p.frame.endDateExclusive, accountIds: ['cash'], loanIds: ['loan'], snapshots: [{ date: p.frame.startDate, accountId: 'cash', clearedBalance: '1000', allocations: [{ loanId: 'loan', amount: '500' }], evidenceIds }] };
  p.dependencyGraph = [{ from: 'cash', to: 'loan' }]; expect(calculatePortfolio(p).accounts.loan.totals?.interestAccrued).toBe('0.000000000000');
  fee(cash, '10'); const r = calculatePortfolio(p);
  expect(r.completeness).toBe('incomplete'); expect(r.accounts.loan.issues).toContain('loan_offset_portfolio_binding_unknown');
  expect(r.accounts.loan.ledger.find(e => e.id === 'accrue:2026-01-21')?.amount).toBeNull();
});

test('final envelopes include UTF8 issues and comparison metadata in exact byte caps', () => {
  const budget = new EvaluationBudget(true), r = calculatePortfolio(portfolio([account('A', '1000')]));
  expect(() => budget.verifyPortfolio(r)).not.toThrow();
  r.issues = ['\u754c'.repeat(4 * 1024 * 1024)];
  expect(() => budget.verifyPortfolio(r)).toThrow('evaluation_output_budget_exceeded');
  const comparison = comparePortfolios({ schemaVersion: 1, referenceId: 'a', alternatives: [{ id: 'a', input: portfolio([account('A', '1000')]) }, { id: 'b', input: portfolio([account('A', '1000')]) }] });
  comparison.issues = ['\u754c'.repeat(8 * 1024 * 1024)];
  expect(() => budget.verifyComparison(comparison)).toThrow('evaluation_output_budget_exceeded');
});

test('literal v1-v6 flat input compatibility survives v7 execution', () => {
  const { contract, scenario } = example(); const expected = calculateLedger(contract, scenario);
  for (const version of ['product-terms-engine-v1', 'product-terms-engine-v2', 'product-terms-engine-v3', 'product-terms-engine-v4', 'product-terms-engine-v5', 'product-terms-engine-v6'] as const) {
    const result = calculateLedger({ ...contract, evaluatorVersion: version }, scenario);
    expect(result.totals).toEqual(expected.totals); expect(result.issues).toEqual(expected.issues);
    expect(result.ledger).toEqual(expected.ledger);
  }
});
