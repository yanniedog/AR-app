import { example } from '../testSupport';
import { calculateLedger } from '../ledger';
import { EVALUATOR_VERSION, FEE_EVALUATOR_VERSION } from '../types';
import { feeOccurrences } from '../feeSchedule';
import type { LoanContract, LoanExecution } from '../loanTypes';

/** Literal arithmetic models only; no actual bank contract or customer offer is approved. */
function model() {
  const { contract: c, scenario: s } = example(), evidence = c.evidence[0].id;
  c.direction = 'liability'; c.initialAnnualRate = '0'; c.interest.offset = 'none'; c.interest.postingDates = []; c.interest.dailyAccrualScale = null;
  c.interest.balanceBasis = 'loan_declared_component_basis'; c.interest.eventOrder = 'loan_declared_payment_phase_then_posting';
  s.accountId = 'loan-A'; s.startDate = '2026-01-01'; s.endDateExclusive = '2026-01-04'; s.openingBalance = '100'; s.initialOffset = '0'; s.events = [];
  c.applicability = { cohortKey: s.cohortKey, from: s.startDate, toExclusive: s.endDateExclusive };
  const l: LoanContract = { schemaVersion: 1, accountId: s.accountId, cohortKey: s.cohortKey, offerId: 'offer-1', sourceVersion: 'source-1', from: s.startDate, toExclusive: s.endDateExclusive, evidenceIds: [evidence],
    opening: { snapshotId: 'opening-1', effectiveDate: s.startDate, outstanding: '100', components: { principal: '80', postedInterest: '10', accruedInterest: '5', capitalizedCharges: '5', otherDebt: '0' }, redrawAvailable: '20', evidenceIds: [evidence] },
    interestBearing: ['principal'], allocation: ['accruedInterest', 'postedInterest', 'capitalizedCharges', 'otherDebt', 'principal'], paymentTiming: 'before_accrual', overpayment: 'reject', paymentRounding: 'half_up',
    accruedSettlement: 'round_before_each_payment', advancesTiming: 'start_of_day_before_fees', feeBalanceBasis: 'outstanding_including_unposted', obligationMeasurement: 'before_payment_phase', reversalPolicy: 'restore_components_no_interest_recalculation',
    scheduleCoverage: 'reviewed_complete', obligations: [], advances: [], rates: [],
    extraPayments: { allowed: true, totalCap: '100', increasesRedraw: true, evidenceIds: [evidence] }, redraw: { allowed: true, totalCap: '100', evidenceIds: [evidence] }, feeFunding: [], offset: null, closure: null };
  c.loanContract = l; s.loan = { offerId: l.offerId, sourceVersion: l.sourceVersion, openingSnapshotId: l.opening.snapshotId, mode: 'cleared', executions: [] };
  c.feeSchedule = { schemaVersion: 1, accountId: s.accountId, from: s.startDate, toExclusive: s.endDateExclusive, inventoryCoverage: 'reviewed_complete', deferredObligations: 'none_confirmed', evidenceIds: [evidence], ordering: 'before_scenario_events',
    inventory: [{ categoryId: 'all-reviewed-fees', state: 'none_applicable', feeIds: [], evidenceIds: [evidence] }], fees: [] };
  const execution = (type: LoanExecution['type'], amount: string, date = '2026-01-02'): LoanExecution => ({ id: 'execution-1', accountId: s.accountId!, date, order: 0, status: 'cleared', type, amount, evidenceIds: [evidence] });
  return { c, s, l, evidence, execution };
}

test('v5 accepts existing v4 fees and v4 rejects a new loan contract', () => {
  const { c, s } = model(); c.evaluatorVersion = FEE_EVALUATOR_VERSION;
  expect(calculateLedger(c, s).issues).toContain('contract_version_unsupported');
  delete c.loanContract; delete s.loan;
  c.interest.balanceBasis = 'closing_balance_before_posted_interest'; c.interest.eventOrder = 'ordered_events_then_accrual_then_posting';
  expect(calculateLedger(c, s).issues).not.toContain('contract_version_unsupported');
  expect(calculateLedger(c, s).evaluatorVersion).toBe(EVALUATOR_VERSION);
  expect(calculateLedger(c, s).totals?.closingBalance).toBe('100.00');
});

test('due obligations never credit principal without an execution', () => {
  const { c, s, l, evidence } = model(); l.obligations = [{ id: 'due-1', accountId: s.accountId!, dueDate: '2026-01-02', amount: { type: 'fixed', value: '30' }, evidenceIds: [evidence] }];
  const r = calculateLedger(c, s); expect(r.totals?.closingBalance).toBe('100.00'); expect(r.loan?.principalRepaid).toBe('0.00');
  expect(r.loan?.obligations[0]).toMatchObject({ due: '30.00', paid: '0.00', status: 'unpaid' });
});

test('a mixed-component payment conserves debt and does not count opening interest as new cost', () => {
  const { c, s, execution } = model(); s.loan!.executions = [execution('extra_payment', '30')];
  const r = calculateLedger(c, s);
  expect(r.loan?.closing).toMatchObject({ principal: '70.00', postedInterest: '0.00', accruedInterest: '0.000000000000', capitalizedCharges: '0.00' });
  expect(r.loan).toMatchObject({ principalRepaid: '10.00', interestPaid: '15.00', chargesPaid: '5.00', redrawAvailable: '30.00' });
  expect(r.totals).toMatchObject({ closingBalance: '70.00', interestAccrued: '0.000000000000', externalInflows: '30.00' });
});

test('posting transfers interest without duplicating cost or losing accrued debt', () => {
  const { c, s, l } = model(); c.initialAnnualRate = '0.365'; c.interest.postingDates = ['2026-01-02'];
  l.interestBearing = ['principal']; const r = calculateLedger(c, s);
  expect(r.totals).toMatchObject({ interestAccrued: '0.240000000000', interestPosted: '5.16', closingBalance: '100.24' });
  expect(r.loan?.closing).toMatchObject({ postedInterest: '15.16', accruedInterest: '0.080000000000' });
});

test('fractional unposted opening interest is conserved across horizons', () => {
  const { c, s, l } = model(); l.opening.components!.accruedInterest = '5.001234567890';
  l.opening.outstanding = s.openingBalance = '100.001234567890';
  const r = calculateLedger(c, s);
  expect(r.loan?.closing.accruedInterest).toBe('5.001234567890');
  expect(r.loan?.outstandingDebt).toBe('100.001234567890');
  expect(r.issues).not.toContain('money_requires_exact_cents');
  expect(r.totals?.interestAccrued).toBe('0.000000000000');
});

test('declared loan payment phase cannot contradict the generic interest order', () => {
  const { c, s, l, execution } = model(); l.paymentTiming = 'after_accrual'; c.initialAnnualRate = '0.365';
  s.loan!.executions = [execution('extra_payment', '30', '2026-01-01')];
  const after = calculateLedger(c, s); expect(after.totals?.interestAccrued).toBe('0.220160000000');
  c.interest.eventOrder = 'ordered_events_then_accrual_then_posting';
  expect(calculateLedger(c, s).issues).toContain('interest_pattern_unsupported');
});

test('projected payments do not become cleared payments', () => {
  const { c, s, execution } = model(); const e = execution('extra_payment', '30'); e.status = 'projected'; s.loan!.executions = [e];
  expect(calculateLedger(c, s).totals?.closingBalance).toBe('100.00');
  s.loan!.mode = 'projected'; expect(calculateLedger(c, s).totals?.closingBalance).toBe('70.00');
  expect(calculateLedger(c, s).issues).toContain('loan_projected_executions_assumption');
});

test('unknown allocation or timing does not infer interest-first repayment', () => {
  const { c, s, l, execution } = model(); s.loan!.executions = [execution('extra_payment', '30')]; l.allocation = 'unknown';
  expect(calculateLedger(c, s).loan?.principalRepaid).toBeNull(); expect(calculateLedger(c, s).totals?.closingBalance).toBe('100.00');
  expect(calculateLedger(c, s).issues).toContain('loan_payment_allocation_unavailable');
  expect(calculateLedger(c, s).ledger.find(e => e.id === 'accrue:2026-01-03')?.amount).toBeNull();
});

test('reversal restores the actual allocation and available redraw', () => {
  const { c, s, execution } = model(); s.loan!.executions = [execution('extra_payment', '30'), { ...execution('reversal', '30', '2026-01-03'), id: 'reversal-1', reversalOf: 'execution-1' }];
  expect(calculateLedger(c, s).loan).toMatchObject({ principalRepaid: '0.00', redrawAvailable: '20.00', interestPaid: '0.00' });
  expect(calculateLedger(c, s).totals?.closingBalance).toBe('100.00');
  const r = calculateLedger(c, s);
  expect(r.ledger.filter(e => e.type === 'cashflow').map(e => e.amount)).toEqual(['30.00', '-30.00']);
  expect(r.totals).toMatchObject({ externalInflows: '30.00', externalOutflows: '30.00', externalCashflowNet: '0.00' });
});

test('redraw reversal has positive cashflow and preserves both gross directions', () => {
  const { c, s, execution } = model(); s.loan!.executions = [execution('redraw', '10'), { ...execution('reversal', '10', '2026-01-03'), id: 'reversal-1', reversalOf: 'execution-1' }];
  const r = calculateLedger(c, s);
  expect(r.ledger.filter(e => e.type === 'cashflow').map(e => e.amount)).toEqual(['-10.00', '10.00']);
  expect(r.totals).toMatchObject({ closingBalance: '100.00', externalInflows: '10.00', externalOutflows: '10.00', externalCashflowNet: '0.00' });
});

test('announced rate changes cite the active rate clause in accrual traces', () => {
  const { c, s, l } = model(); c.evidence.push({ ...c.evidence[0], id: 'new-rate-source' });
  l.rates = [{ date: '2026-01-02', annualRate: '0.365', evidenceIds: ['new-rate-source'] }];
  const r = calculateLedger(c, s);
  expect(r.ledger.find(e => e.id === 'accrue:2026-01-02')?.evidenceIds).toContain('new-rate-source');
  expect(r.ledger.find(e => e.id === 'accrue:2026-01-01')?.evidenceIds).not.toContain('new-rate-source');
  expect(r.totals?.interestAccrued).toBe('0.160000000000');
});

test('IO amounts measure actual accrued debt before payment; confirmed P&I replacement remains distinct', () => {
  const { c, s, l, evidence, execution } = model();
  l.obligations = [{ id: 'io', accountId: s.accountId!, dueDate: '2026-01-02', amount: { type: 'interest_due' }, evidenceIds: [evidence] }, { id: 'pi', accountId: s.accountId!, dueDate: '2026-01-03', amount: { type: 'fixed', value: '10' }, evidenceIds: [evidence] }];
  s.loan!.executions = [{ ...execution('payment', '15'), obligationId: 'io' }, { ...execution('payment', '10', '2026-01-03'), id: 'payment-2', obligationId: 'pi' }];
  expect(calculateLedger(c, s).loan?.obligations.map(o => [o.due, o.paid, o.status])).toEqual([['15.00', '15.00', 'paid'], ['10.00', '10.00', 'paid']]);
});

test('offsets require complete cross-loan allocation and cap the interest basis', () => {
  const { c, s, l, evidence, execution } = model(); c.initialAnnualRate = '0.365'; c.interest.offset = 'capped_at_balance';
  l.offset = { coverage: 'complete', balanceHistory: 'complete_step_schedule', from: s.startDate, toExclusive: s.endDateExclusive, accountIds: ['offset-A'], loanIds: ['loan-A', 'loan-B'], snapshots: [{ date: s.startDate, accountId: 'offset-A', clearedBalance: '200', allocations: [{ loanId: 'loan-A', amount: '100' }, { loanId: 'loan-B', amount: '100' }], evidenceIds: [evidence] }] };
  expect(calculateLedger(c, s).totals?.interestAccrued).toBe('0.000000000000');
  l.offset.coverage = 'unknown'; s.loan!.executions = [execution('extra_payment', '30')];
  const unknown = calculateLedger(c, s); expect(unknown.loan?.principalRepaid).toBeNull();
  expect(unknown.loan).toMatchObject({ componentStatus: 'partial', outstandingDebt: null });
  expect(unknown.ledger.find(e => e.type === 'interest_accrual')?.amount).toBeNull();
  l.offset.coverage = 'complete'; s.loan!.executions = [];
  l.offset.balanceHistory = 'observations_only';
  expect(calculateLedger(c, s).issues).toContain('loan_offset_balance_history_unverified');
  expect(calculateLedger(c, s).ledger.find(e => e.type === 'interest_accrual')?.amount).toBeNull();
  l.offset.balanceHistory = 'complete_step_schedule';
  l.offset.snapshots[0].clearedBalance = '150'; expect(calculateLedger(c, s).issues).toContain('loan_offset_overallocated');
});

test('unknown future rate, missing opening decomposition and wrong customer offer stay unavailable', () => {
  const { c, s, l, evidence } = model(); l.rates = [{ date: '2026-01-02', annualRate: null, evidenceIds: [evidence] }];
  expect(calculateLedger(c, s).issues).toContain('loan_future_rate_unknown');
  expect(calculateLedger(c, s).ledger.find(e => e.id === 'accrue:2026-01-02')?.amount).toBeNull();
  l.opening.components = null; expect(calculateLedger(c, s).totals).toBeNull();
  s.loan!.offerId = 'other'; expect(calculateLedger(c, s).issues).toContain('loan_scope_mismatch');
});

test('redraw availability, caps and component opening identity are enforced', () => {
  const { c, s, l, execution } = model(); s.loan!.executions = [execution('redraw', '21')];
  expect(calculateLedger(c, s).issues).toContain('loan_redraw_unavailable');
  s.loan!.executions[0].amount = '10'; expect(calculateLedger(c, s).loan).toMatchObject({ principalAdvanced: '10.00', redrawAvailable: '10.00', redrawUsed: '10.00' });
  l.opening.components!.principal = '81'; expect(calculateLedger(c, s).issues).toContain('loan_opening_components_mismatch');
});

test('funded fee uses redraw atomically, external fee does not increase debt', () => {
  const { c, s, l, evidence, execution } = model(); const f = c.feeSchedule!;
  f.inventory = [{ categoryId: 'fee', state: 'scheduled', feeIds: ['fee'], evidenceIds: [evidence] }];
  f.fees = [{ id: 'fee', chargeIdentity: 'charge', categoryId: 'fee', evidenceIds: [evidence], scope: { type: 'account', accountId: s.accountId! }, timing: { type: 'dated', from: s.startDate, toExclusive: s.endDateExclusive, triggerCoverage: 'reviewed_complete', occurrences: [{ incurredDate: '2026-01-02', dueDate: '2026-01-02', triggerId: 'funding' }] }, order: 0, debit: { type: 'product_balance' }, price: { type: 'fixed', value: '10' }, applicability: null, waiver: null, discounts: [], discountPrecedence: 'exclusive', discountRounding: 'half_up' }];
  l.feeFunding = [{ occurrenceId: feeOccurrences(f)[0].id, method: 'redraw', evidenceIds: [evidence] }];
  expect(calculateLedger(c, s).loan).toMatchObject({ redrawAvailable: '10.00', redrawUsed: '10.00', closing: { capitalizedCharges: '15.00' } });
  expect(calculateLedger(c, s).totals?.closingBalance).toBe('110.00');
  s.loan!.executions = [execution('redraw', '10')]; expect(calculateLedger(c, s).issues).toContain('loan_same_day_fee_and_independent_redraw_unsupported');
  s.loan!.executions = []; l.feeFunding = []; f.fees[0].debit = { type: 'external_account', accountId: 'external-A' };
  expect(calculateLedger(c, s).totals).toMatchObject({ closingBalance: '100.00', feesPaidExternal: '10.00' });
  l.rates = [{ date: '2026-01-02', annualRate: null, evidenceIds: [evidence] }];
  f.fees[0].price = { type: 'percentage', fraction: '0.1', basis: { type: 'balance', accountId: s.accountId!, point: 'before_fee' }, rounding: 'half_up' };
  const unknown = calculateLedger(c, s);
  expect(unknown.ledger.find(e => e.type === 'fee')?.amount).toBeNull();
  expect(unknown.issues.some(i => i.startsWith('fee_balance_basis_tainted:'))).toBe(true);
});

test('early payoff cannot erase unposted interest', () => {
  const { c, s, l, execution, evidence } = model(); l.closure = { date: '2026-01-03', requireSettled: true, evidenceIds: [evidence] };
  s.loan!.executions = [execution('extra_payment', '95', '2026-01-03')];
  expect(calculateLedger(c, s).issues).toContain('loan_closure_unsettled_components');
  s.loan!.executions[0].amount = '100'; expect(calculateLedger(c, s).totals?.closingBalance).toBe('0.00');
});
