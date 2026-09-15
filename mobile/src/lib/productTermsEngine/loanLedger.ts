import { calendarDate, dayNumber } from './calendar';
import { Decimal, decimalZero } from './decimal';
import { ContractFeeLedger } from './feeLedger';
import { dailyInterest } from './interestAccrual';
import { allocate, assertTotal, components, nonNegativeComponent, settleAccrued, total, values, type Components } from './loanComponents';
import { LOAN_COMPONENTS, type LoanExecution } from './loanTypes';
import type { CalculationReceipt, LedgerContract, LedgerScenario } from './types';
import { nonNegative, rate } from './validation';

export function runLoanLedger(c: LedgerContract, s: LedgerScenario, receipt: CalculationReceipt): CalculationReceipt {
  if (!c.loanContract!.opening.components) return receipt;
  return new LoanLedger(c, s, receipt).run();
}

class LoanLedger {
  private l;
  private state: Components;
  private feeLedger: ContractFeeLedger;
  private paid = components();
  private accrued = decimalZero();
  private posted = decimalZero();
  private adjustment = decimalZero();
  private advanced = decimalZero();
  private inflows = decimalZero();
  private outflows = decimalZero();
  private redraw;
  private redrawUsed = decimalZero();
  private extraUsed = decimalZero();
  private annualRate;
  private rateKnown = true;
  private rateEvidence: string[];
  private offsetEvidence: string[] = [];
  private tainted = false;
  private paidObligations = new Map<string, Decimal>();
  private due = new Map<string, Decimal | null>();
  private applied = new Map<string, { execution: LoanExecution; allocation: Components; redrawDelta: Decimal }>();
  constructor(private c: LedgerContract, private s: LedgerScenario, private receipt: CalculationReceipt) {
    this.l = c.loanContract!; this.state = components(this.l.opening.components!);
    this.redraw = nonNegative(this.l.opening.redrawAvailable); this.annualRate = rate(c.initialAnnualRate);
    this.rateEvidence = c.initialRateEvidenceIds;
    this.feeLedger = new ContractFeeLedger(c, s, receipt);
    this.tainted = receipt.issues.some(i => i.startsWith('loan_offset_') || i === 'loan_interestBearing_unknown');
  }
  private issue(reason: string) { this.receipt.issues.push(reason); this.tainted = true; }
  private line(date: string, id: string, amount: Decimal | null, evidenceIds: string[], note: string, type: 'cashflow' | 'interest_accrual' | 'interest_posting' = 'cashflow') {
    this.receipt.ledger.push({ date, id, type, amount: amount?.fixed(type === 'interest_accrual' ? 12 : 2) ?? null, balance: total(this.state).fixed(), evidenceIds, note });
  }
  private fees(date: string, dayOpen: Decimal) {
    this.feeLedger.tainted ||= this.tainted;
    const before = total(this.state), first = this.receipt.ledger.length;
    const after = this.feeLedger.apply(date, before, dayOpen);
    this.state.capitalizedCharges = this.state.capitalizedCharges.add(after.sub(before));
    for (const row of this.receipt.ledger.slice(first)) {
      const funding = this.l.feeFunding.find(f => f.occurrenceId === row.id);
      if (funding) row.evidenceIds = [...new Set([...row.evidenceIds, ...funding.evidenceIds])];
      if (funding?.method === 'redraw' && row.amount !== null) {
        const amount = nonNegative(row.amount);
        if (this.l.redraw.allowed !== true || amount.compare(this.redraw) > 0) throw new Error('loan_fee_redraw_unavailable');
        this.redraw = this.redraw.sub(amount); this.redrawUsed = this.redrawUsed.add(amount);
        this.checkRedrawCap();
        row.evidenceIds = [...new Set([...row.evidenceIds, ...funding.evidenceIds])];
      }
    }
    assertTotal(this.state, after);
    if (this.feeLedger.tainted) this.issue('loan_fee_balance_dependency_unknown');
  }
  private checkRedrawCap() {
    if (this.l.redraw.totalCap !== null && this.redrawUsed.compare(nonNegative(this.l.redraw.totalCap)) > 0) throw new Error('loan_redraw_cap_exceeded');
  }
  private execute(e: LoanExecution) {
    if (e.status !== this.s.loan!.mode) return;
    const amount = nonNegative(e.amount);
    if (e.type === 'reversal') { this.reverse(e, amount); return; }
    if (e.type === 'redraw') {
      if (this.l.redraw.allowed !== true) { this.issue('loan_redraw_permission_unknown_or_disallowed'); return; }
      if (amount.compare(this.redraw) > 0) throw new Error('loan_redraw_unavailable');
      this.state.principal = this.state.principal.add(amount); this.advanced = this.advanced.add(amount);
      this.redraw = this.redraw.sub(amount); this.redrawUsed = this.redrawUsed.add(amount); this.checkRedrawCap();
      this.outflows = this.outflows.add(amount); this.applied.set(e.id, { execution: e, allocation: components(), redrawDelta: decimalZero().sub(amount) });
      this.line(e.date, e.id, decimalZero().sub(amount), e.evidenceIds, 'Cleared/projected redraw increases principal once.'); return;
    }
    if (this.l.allocation === 'unknown' || this.l.paymentTiming === 'unknown' || this.l.paymentRounding === 'unknown' || this.l.accruedSettlement === 'unknown' || this.l.overpayment === 'unknown' || this.tainted) {
      this.issue('loan_payment_allocation_unavailable'); this.line(e.date, e.id, null, e.evidenceIds, 'Payment retained as unresolved; no inferred component allocation.'); return;
    }
    if (e.type === 'extra_payment') {
      if (this.l.extraPayments.allowed !== true || this.l.extraPayments.increasesRedraw === 'unknown') { this.issue('loan_extra_payment_policy_unknown_or_disallowed'); return; }
      this.extraUsed = this.extraUsed.add(amount);
      if (this.l.extraPayments.totalCap !== null && this.extraUsed.compare(nonNegative(this.l.extraPayments.totalCap)) > 0) throw new Error('loan_extra_payment_cap_exceeded');
    }
    this.adjustment = this.adjustment.add(settleAccrued(this.state, this.l.paymentRounding));
    const allocation = allocate(this.state, amount, this.l.allocation);
    for (const k of LOAN_COMPONENTS) this.paid[k] = this.paid[k].add(allocation[k]);
    const redrawDelta = e.type === 'extra_payment' && this.l.extraPayments.increasesRedraw === true ? allocation.principal : decimalZero();
    this.redraw = this.redraw.add(redrawDelta); this.inflows = this.inflows.add(amount);
    this.applied.set(e.id, { execution: e, allocation, redrawDelta });
    if (e.obligationId) this.paidObligations.set(e.obligationId, (this.paidObligations.get(e.obligationId) ?? decimalZero()).add(amount));
    this.line(e.date, e.id, amount, e.evidenceIds, 'Payment received; source-defined component allocation.');
  }
  private reverse(e: LoanExecution, amount: Decimal) {
    if (this.l.reversalPolicy === 'unknown') { this.issue('loan_reversal_policy_unknown'); return; }
    const original = this.applied.get(e.reversalOf!);
    if (!original) { this.issue('loan_reversal_original_unresolved'); return; }
    if (original.execution.type === 'redraw') {
      if (this.state.principal.compare(amount) < 0) throw new Error('loan_redraw_reversal_exceeds_principal');
      this.state.principal = this.state.principal.sub(amount); this.advanced = this.advanced.sub(amount);
      this.redrawUsed = this.redrawUsed.sub(amount); this.inflows = this.inflows.add(amount);
    } else {
      for (const k of LOAN_COMPONENTS) { this.state[k] = this.state[k].add(original.allocation[k]); this.paid[k] = this.paid[k].sub(original.allocation[k]); }
      this.outflows = this.outflows.add(amount);
      if (original.execution.type === 'extra_payment') this.extraUsed = this.extraUsed.sub(amount);
      if (original.execution.obligationId) this.paidObligations.set(original.execution.obligationId, this.paidObligations.get(original.execution.obligationId)!.sub(amount));
    }
    this.redraw = this.redraw.sub(original.redrawDelta);
    if (this.redraw.compare(decimalZero()) < 0) throw new Error('loan_reversal_redraw_already_used');
    this.line(e.date, e.id, original.execution.type === 'redraw' ? amount : decimalZero().sub(amount), e.evidenceIds, 'Reversal restores original component allocations; historical interest remains as accrued.');
  }
  private offset(date: string): Decimal {
    this.offsetEvidence = [];
    const o = this.l.offset; if (!o) return decimalZero();
    if (o.coverage !== 'complete' || o.balanceHistory !== 'complete_step_schedule') { this.issue('loan_offset_scope_or_history_unverified'); return decimalZero(); }
    let amount = decimalZero();
    for (const account of o.accountIds) {
      const snapshot = o.snapshots.filter(p => p.accountId === account && p.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!snapshot) { this.issue('loan_offset_balance_unknown'); continue; }
      this.offsetEvidence.push(...snapshot.evidenceIds);
      amount = amount.add(nonNegative(snapshot.allocations.find(a => a.loanId === this.l.accountId)!.amount));
    }
    return amount;
  }
  private measureDue(date: string) {
    for (const o of this.l.obligations.filter(o => o.dueDate === date)) this.due.set(o.id, o.amount.type === 'fixed' ? nonNegative(o.amount.value) :
      this.l.paymentRounding === 'unknown' || this.tainted ? null : this.state.accruedInterest.add(this.state.postedInterest).rounded(2, this.l.paymentRounding));
  }
  run(): CalculationReceipt {
    const executions = [...this.s.loan!.executions].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    for (let day = dayNumber(this.s.startDate); day < dayNumber(this.s.endDateExclusive); day++) {
      const date = calendarDate(day), dayOpen = total(this.state);
      const changedRate = this.l.rates.find(r => r.date === date);
      if (changedRate) { this.rateEvidence = changedRate.evidenceIds; this.rateKnown = changedRate.annualRate !== null; if (!this.rateKnown) this.issue('loan_future_rate_unknown'); else this.annualRate = rate(changedRate.annualRate!); }
      for (const a of this.l.advances.filter(a => a.date === date && a.status === this.s.loan!.mode)) {
        const amount = nonNegative(a.amount); this.state.principal = this.state.principal.add(amount); this.advanced = this.advanced.add(amount); this.outflows = this.outflows.add(amount);
        this.line(date, a.id, decimalZero().sub(amount), a.evidenceIds, 'Contract-owned funded advance.');
      }
      if (this.c.feeSchedule?.ordering !== 'after_scenario_events') this.fees(date, dayOpen);
      const today = executions.filter(e => e.date === date);
      if (this.l.paymentTiming !== 'after_accrual') { this.measureDue(date); today.forEach(e => this.execute(e)); }
      if (this.l.paymentTiming !== 'after_accrual' && this.c.feeSchedule?.ordering === 'after_scenario_events') this.fees(date, dayOpen);
      let basis = decimalZero();
      if (this.l.interestBearing === 'unknown') this.issue('loan_interest_basis_unknown');
      else for (const k of this.l.interestBearing) basis = basis.add(this.state[k]);
      basis = basis.sub(this.offset(date)); if (basis.compare(decimalZero()) < 0) basis = decimalZero();
      const interestKnown = !this.tainted && this.rateKnown && this.l.interestBearing !== 'unknown';
      const interest = interestKnown ? dailyInterest(basis, this.annualRate, date, this.c.interest) : decimalZero();
      this.accrued = this.accrued.add(interest); this.state.accruedInterest = this.state.accruedInterest.add(interest);
      this.line(date, `accrue:${date}`, interestKnown ? interest : null, [...new Set([...this.c.interest.evidenceIds, ...this.rateEvidence, ...this.offsetEvidence, ...this.l.evidenceIds])], this.tainted ? 'Known-component interest; unresolved dependencies.' : 'New daily interest cost.', 'interest_accrual');
      if (this.l.paymentTiming === 'after_accrual') { this.measureDue(date); today.forEach(e => this.execute(e)); }
      if (this.l.paymentTiming === 'after_accrual' && this.c.feeSchedule?.ordering === 'after_scenario_events') this.fees(date, dayOpen);
      if (this.c.interest.postingDates.includes(date)) {
        const before = total(this.state), adjustment = settleAccrued(this.state, this.c.interest.postingRounding), posted = this.state.accruedInterest;
        this.adjustment = this.adjustment.add(adjustment); this.state.postedInterest = this.state.postedInterest.add(posted); this.state.accruedInterest = decimalZero(); this.posted = this.posted.add(posted);
        assertTotal(this.state, before.add(adjustment)); this.line(date, `post:${date}`, posted, this.c.interest.evidenceIds, 'Transfer unposted interest into posted debt; no new cost.', 'interest_posting');
      }
      const expected = nonNegativeComponent(this.s.openingBalance).add(this.advanced).add(this.accrued).add(this.adjustment).add(this.feeLedger.debitedBalance).sub(total(this.paid));
      assertTotal(this.state, expected);
    }
    return this.finish();
  }
  private finish(): CalculationReceipt {
    const r = this.receipt, closing = total(this.state), principalRepaid = this.tainted || this.l.allocation === 'unknown' ? null : this.paid.principal.fixed();
    const obligations = this.l.obligations.map(o => {
      const due = this.due.get(o.id) ?? null, paid = this.paidObligations.get(o.id) ?? decimalZero();
      const status = due === null ? 'unknown' as const : paid.compare(due) >= 0 ? 'paid' as const : paid.compare(decimalZero()) === 0 ? 'unpaid' as const : 'partial' as const;
      if (status !== 'paid') r.issues.push(`loan_obligation_${status}:${o.id}`);
      return { id: o.id, dueDate: o.dueDate, due: due?.fixed() ?? null, paid: paid.fixed(), status };
    });
    if (this.l.closure?.requireSettled && closing.compare(decimalZero()) !== 0) r.issues.push('loan_closure_unsettled_components');
    r.loan = { componentStatus: this.tainted ? 'partial' : 'known', outstandingDebt: this.tainted ? null : closing.fixed(12), knownComponentDebt: closing.fixed(12), opening: values(components(this.l.opening.components!)), closing: values(this.state), principalAdvanced: this.advanced.fixed(), principalRepaid,
      interestPaid: this.paid.accruedInterest.add(this.paid.postedInterest).fixed(), chargesPaid: this.paid.capitalizedCharges.fixed(), redrawAvailable: this.redraw.fixed(), redrawUsed: this.redrawUsed.fixed(), obligations,
      perspective: 'product_account_with_external_fees_separate' };
    r.totals = { openingBalance: this.s.openingBalance, closingBalance: closing.fixed(), principalRepaid, externalInflows: this.inflows.fixed(), externalOutflows: this.outflows.fixed(), externalCashflowNet: this.inflows.sub(this.outflows).fixed(),
      interestAccrued: this.accrued.fixed(12), interestPosted: this.posted.fixed(), interestUnposted: this.state.accruedInterest.fixed(12), interestRoundingAdjustment: this.adjustment.fixed(12),
      feesCharged: this.feeLedger.charged.fixed(), feesDebitedBalance: this.feeLedger.debitedBalance.fixed(), feesPaidExternal: this.feeLedger.paidExternal.fixed() };
    return r;
  }
}

