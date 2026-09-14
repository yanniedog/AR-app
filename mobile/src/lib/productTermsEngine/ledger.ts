import { calendarDate, dayNumber } from './calendar';
import { Decimal, decimalZero } from './decimal';
import { evaluateEligibility } from './eligibility';
import { canonical, hashText, money, nonNegative, rate, validateLedger } from './validation';
import { EVALUATOR_VERSION, type CalculationReceipt, type LedgerContract, type LedgerEvent, type LedgerScenario } from './types';
import { dailyInterest } from './interestAccrual';
import { savingsInterest, type SavingsActivityCache } from './savingsAccrual';

function feeAmount(event: Extract<LedgerEvent, { type: 'fee' }>): Decimal {
  if (event.amount.type === 'fixed') return money(event.amount.value);
  const rule = event.amount;
  let amount = Decimal.parse(rule.fraction).mul(money(rule.basis));
  if (rule.minimum !== undefined && amount.compare(money(rule.minimum)) < 0) amount = money(rule.minimum);
  if (rule.maximum !== undefined && amount.compare(money(rule.maximum)) > 0) amount = money(rule.maximum);
  return amount.rounded(2, rule.rounding);
}

/** Pure synchronous evaluator, bounded at fifty years/10k explicit events; performs no I/O. */
export function calculateLedger(contract: LedgerContract, scenario: LedgerScenario): CalculationReceipt {
  const receipt: CalculationReceipt = {
    schemaVersion: 1, evaluatorVersion: EVALUATOR_VERSION, inputSha256: '', contractId: contract?.id ?? '',
    dependencies: [], status: 'unsupported', claimAvailable: false, issues: [], assumptions: [], eligibility: null, totals: null, ledger: [],
  };
  try {
    const input = canonical({ evaluatorVersion: EVALUATOR_VERSION, contract, scenario });
    if (input.length > 4_000_000) throw new Error('input_size_exceeded');
    receipt.inputSha256 = hashText(input);
    receipt.issues = validateLedger(contract, scenario);
    receipt.dependencies = [...contract.dependencyIds]; receipt.assumptions = [...scenario.assumptions];
    receipt.eligibility = evaluateEligibility(contract.eligibility, scenario.facts);
    if (receipt.eligibility.status !== 'meets') receipt.issues.push(`eligibility:${receipt.eligibility.status}`);
    const result = runLedger(contract, scenario, receipt);
    result.issues = [...new Set(result.issues)];
    result.status = result.issues.length ? 'incomplete' : 'complete';
    result.claimAvailable = result.status === 'complete';
    return result;
  } catch (error) {
    receipt.status = 'unsupported'; receipt.claimAvailable = false; receipt.totals = null; receipt.ledger = [];
    receipt.issues.push(error instanceof Error ? error.message : 'invalid_contract');
    return receipt;
  }
}

function runLedger(contract: LedgerContract, scenario: LedgerScenario, receipt: CalculationReceipt): CalculationReceipt {
  let balance = money(scenario.openingBalance), offset = money(scenario.initialOffset), annualRate = rate(contract.initialAnnualRate);
  let accrued = decimalZero(), unposted = decimalZero(), posted = decimalZero(), fees = decimalZero();
  let inflows = decimalZero(), outflows = decimalZero();
  const events = [...scenario.events].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const postingDates = new Set(contract.interest.postingDates);
  let eventIndex = 0;
  const activityCache: SavingsActivityCache = new Map();
  for (let day = dayNumber(scenario.startDate); day < dayNumber(scenario.endDateExclusive); day++) {
    const date = calendarDate(day);
    while (eventIndex < events.length && events[eventIndex].date === date) {
      const event = events[eventIndex++];
      let amount: Decimal | null = decimalZero(), note: string | undefined;
      if (event.type === 'cashflow') {
        amount = money(event.delta); balance = balance.add(amount);
        if (contract.direction === 'liability' && amount.compare(decimalZero()) < 0) receipt.issues.push('repayment_principal_allocation_unsupported');
        if (amount.compare(decimalZero()) >= 0) inflows = inflows.add(amount); else outflows = outflows.sub(amount);
      } else if (event.type === 'rate') { annualRate = rate(event.annualRate); amount = null; }
      else if (event.type === 'offset') { offset = nonNegative(event.balance); amount = null; }
      else {
        const waiver = event.waiver ? evaluateEligibility(event.waiver, scenario.facts) : null;
        if (waiver?.status === 'needs_information') {
          receipt.issues.push(`fee_waiver_unknown:${event.id}`); amount = null; note = 'Unpriced waiver; downstream amounts are evaluated known components only.';
        } else if (waiver?.status === 'meets') { amount = decimalZero(); note = 'Waived by supplied criterion.'; }
        else {
          amount = feeAmount(event); fees = fees.add(amount);
          balance = contract.direction === 'asset' ? balance.sub(amount) : balance.add(amount);
        }
      }
      if (balance.compare(decimalZero()) < 0) throw new Error('negative_balance_unsupported');
      receipt.ledger.push({ date, id: event.id, type: event.type, amount: amount?.fixed() ?? null, balance: balance.fixed(), evidenceIds: 'evidenceIds' in event ? event.evidenceIds : [], ...(note ? { note } : {}) });
    }
    let basis = balance.sub(offset);
    if (basis.compare(decimalZero()) < 0) basis = decimalZero();
    const savings = contract.savingsSchedule ? savingsInterest(basis, date, contract.interest, contract.savingsSchedule, scenario.savingsAssessments ?? [], activityCache) : null;
    const interest = savings?.amount ?? dailyInterest(basis, annualRate, date, contract.interest);
    if (savings) receipt.issues.push(...savings.issues);
    accrued = accrued.add(interest); unposted = unposted.add(interest);
    receipt.ledger.push({ date, id: `accrue:${date}`, type: 'interest_accrual', amount: interest.fixed(12), balance: balance.fixed(), evidenceIds: contract.interest.evidenceIds,
      ...(savings ? { savingsContributions: savings.contributions } : {}) });
    if (postingDates.has(date)) {
      const payment = unposted.rounded(2, contract.interest.postingRounding);
      // The remainder is disclosed in accrued totals; no invented penny carry after posting.
      unposted = decimalZero(); posted = posted.add(payment); balance = balance.add(payment);
      if (balance.compare(decimalZero()) < 0) throw new Error('negative_balance_unsupported');
      receipt.ledger.push({ date, id: `post:${date}`, type: 'interest_posting', amount: payment.fixed(), balance: balance.fixed(), evidenceIds: contract.interest.evidenceIds });
    }
  }
  receipt.totals = {
    openingBalance: money(scenario.openingBalance).fixed(), externalCashflowNet: inflows.sub(outflows).fixed(), principalRepaid: null,
    externalInflows: inflows.fixed(), externalOutflows: outflows.fixed(), interestAccrued: accrued.fixed(12),
    interestPosted: posted.fixed(), interestUnposted: unposted.fixed(12), feesCharged: fees.fixed(), closingBalance: balance.fixed(),
    interestRoundingAdjustment: posted.add(unposted).sub(accrued).fixed(12),
  };
  return receipt;
}
