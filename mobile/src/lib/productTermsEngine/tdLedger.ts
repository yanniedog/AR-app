import { calendarDate, dayNumber } from './calendar';
import { Decimal, decimalZero } from './decimal';
import { dailyInterest } from './interestAccrual';
import { tdSchedule } from './tdSchedule';
import type { CalculationReceipt, LedgerContract, LedgerScenario } from './types';

/** One confirmed investment; generated postings cannot be omitted or replaced by scenario events. */
export function runTdLedger(contract: LedgerContract, scenario: LedgerScenario, receipt: CalculationReceipt): CalculationReceipt {
  const td = contract.tdLifecycle!, schedule = tdSchedule(td);
  if (!schedule.accrualToExclusive) return receipt;
  const principal = Decimal.parse(scenario.openingBalance), rate = Decimal.parse(contract.initialAnnualRate);
  let balance = principal, accrued = decimalZero(), unposted = decimalZero(), posted = decimalZero(), fees = decimalZero(), outflows = decimalZero();
  const payments = new Set(schedule.postingDates);
  const settlementKnown = td.roundingReviewed && td.taxTreatment === 'none_confirmed' &&
    td.payments.destination !== 'unknown' &&
    !schedule.issues.some(issue => /calendar|fee_decision|unsupported|unconfirmed/.test(issue));
  const policy = td.roundingReviewed ? contract.interest : { ...contract.interest, dailyAccrualScale: null, dailyRateRounding: null };
  function payInterest(date: string) {
    const amount = unposted.rounded(2, contract.interest.postingRounding);
    unposted = decimalZero(); posted = posted.add(amount); balance = balance.add(amount);
    receipt.ledger.push({ id: `td:interest:${date}`, date, type: 'interest_posting', amount: amount.fixed(), balance: balance.fixed(), evidenceIds: td.payments.evidenceIds });
    return amount;
  }
  function payout(date: string, amount: Decimal, id: string) {
    balance = balance.sub(amount); outflows = outflows.add(amount);
    receipt.ledger.push({ id, date, type: 'cashflow', amount: amount.mul(Decimal.parse('-1')).fixed(), balance: balance.fixed(), evidenceIds: td.closure.evidenceIds, note: 'Transferred to the confirmed linked account.' });
  }
  for (let day = dayNumber(scenario.startDate); day < dayNumber(scenario.endDateExclusive); day++) {
    const date = calendarDate(day);
    if (settlementKnown && date === schedule.closure) {
      if (td.closure.feeDecision === 'charge_25_percent' && td.closure.principalRecovery === 'unknown' &&
          accrued.mul(Decimal.parse('0.25')).rounded(2, contract.interest.postingRounding).compare(balance.sub(principal).add(unposted.rounded(2, contract.interest.postingRounding))) > 0) {
        receipt.issues.push('td_principal_recovery_decision_unknown'); return receipt;
      }
      payInterest(date);
      if (td.mode === 'legacy_noncompounding' && td.closure.kind === 'early_notice' && td.closure.feeDecision === 'charge_25_percent') {
        fees = accrued.mul(Decimal.parse('0.25')).rounded(2, contract.interest.postingRounding);
        if (fees.compare(balance) > 0) throw new Error('td_fee_exceeds_total_payout');
        balance = balance.sub(fees);
        receipt.ledger.push({ id: 'td:break-fee', date, type: 'fee', amount: fees.fixed(), balance: balance.fixed(), evidenceIds: td.closure.evidenceIds, note: 'Confirmed fee; unpaid interest is used first, then principal if required.' });
      }
      payout(date, balance, 'td:closure');
    } else if (settlementKnown && payments.has(date)) {
      const amount = payInterest(date);
      if (td.payments.destination === 'linked_account') payout(date, amount, `td:payment:${date}`);
    }
    if (date < td.accrualStartDate || date >= schedule.accrualToExclusive) continue;
    // Credited interest never increases the legacy basis; Digital has no interim credits.
    const amount = dailyInterest(principal, rate, date, policy);
    accrued = accrued.add(amount); unposted = unposted.add(amount);
    receipt.ledger.push({ id: `td:accrue:${date}`, date, type: 'interest_accrual', amount: amount.fixed(12), balance: balance.fixed(), evidenceIds: td.evidenceIds });
  }
  if (!settlementKnown) return receipt; // Daily known arithmetic retained; unknown settlement is not reported as zero.
  receipt.totals = { openingBalance: principal.fixed(), externalCashflowNet: outflows.mul(Decimal.parse('-1')).fixed(),
    principalRepaid: null, externalInflows: '0.00', externalOutflows: outflows.fixed(), interestAccrued: accrued.fixed(12),
    interestPosted: posted.fixed(), interestUnposted: unposted.fixed(12), interestRoundingAdjustment: posted.add(unposted).sub(accrued).fixed(12),
    feesCharged: fees.fixed(), closingBalance: balance.fixed() };
  return receipt;
}
