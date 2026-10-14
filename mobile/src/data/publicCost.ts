import { Decimal, PUBLIC_ONE, PUBLIC_ZERO, decimalText } from './publicRateDecimal';
import type { PublicCostEstimate, PublicCostFee, PublicCostScenario } from './publicCostModel';
import type { RateResolution, RateScenario } from './publicRateModel';
import { evaluatePublicCondition, resolvePublicRate } from './publicRateResolver';

export type { PublicCostScenario, PublicCostEstimate, PublicCostFee } from './publicCostModel';
const TWELVE = Decimal.parse('12');
const MAX_MONEY = Decimal.parse('1000000000000');
const unique = (values: string[]) => [...new Set(values)];
function money(value: string): Decimal {
  const amount = Decimal.parse(value);
  if (amount.compare(PUBLIC_ZERO) < 0 || amount.compare(MAX_MONEY) > 0) throw new Error('amount_out_of_bounds');
  return amount;
}
function requestedMonths(scenario: PublicCostScenario): number {
  if (scenario.section === 'TD' && scenario.quotedTermDays !== undefined) {
    if (scenario.quotedTermMonths !== undefined || scenario.comparisonMonths !== undefined) throw new Error('ambiguous_term_unit');
    return 0;
  }
  const defaultMonths = scenario.section === 'Mortgage' ? Math.min(36, scenario.remainingTermMonths) : scenario.section === 'Savings' ? 12 : scenario.quotedTermMonths;
  const requested = scenario.comparisonMonths ?? defaultMonths;
  if (requested === undefined || !Number.isInteger(requested) || requested < 1 || requested > 600) throw new Error('comparison_period_unsupported');
  return requested;
}
function power(value: Decimal, exponent: number): Decimal {
  let result = PUBLIC_ONE, base = value, remaining = exponent;
  while (remaining > 0) { if (remaining % 2) result = result.mul(base); remaining = Math.floor(remaining / 2); if (remaining) base = base.mul(base); }
  return result;
}
/** Payment uses payable nominal interest. A comparison-rate component is never an input. */
export function publicMortgagePayment(principal: string, payableFraction: string, remainingMonths: number): string {
  if (!Number.isInteger(remainingMonths) || remainingMonths < 1 || remainingMonths > 600) throw new Error('remaining_term_unsupported');
  const balance = money(principal), annual = money(payableFraction);
  if (annual.compare(PUBLIC_ONE) > 0) throw new Error('rate_out_of_bounds');
  const monthly = annual.div(TWELVE);
  if (monthly.compare(PUBLIC_ZERO) === 0) return balance.div(Decimal.parse(String(remainingMonths))).fixed(2);
  const growth = power(PUBLIC_ONE.add(monthly), remainingMonths);
  return balance.mul(monthly).mul(growth).div(growth.sub(PUBLIC_ONE)).fixed(2);
}

function phaseRate(resolution: RateResolution, scenario: PublicCostScenario, month: number, balance: Decimal): Decimal {
  let current = resolution;
  if (scenario.section === 'Savings' && scenario.programme) current = resolvePublicRate(scenario.programme,
    { ...scenario.rateScenario, balance: balance.fixed(2) }, scenario.asOf);
  if (current.status !== 'exact' || current.payableRate === undefined) throw new Error('payable_rate_unresolved');
  if (scenario.fixedPeriodMonths !== undefined && month >= scenario.fixedPeriodMonths && !current.phases.some(phase => phase.startMonth <= month && (phase.endMonth === undefined || month < phase.endMonth))) throw new Error('reversion_rate_unknown');
  if (current.phases.length) {
    const matching = current.phases.filter(phase => phase.startMonth <= month && (phase.endMonth === undefined || month < phase.endMonth));
    if (matching.length > 1) throw new Error('overlapping_rate_phases');
    if (matching.length === 1) {
      if (matching[0].status !== 'exact' || matching[0].payableRate === undefined) throw new Error('future_phase_unresolved');
      return Decimal.parse(matching[0].payableRate);
    }
    if (month >= Math.min(...current.phases.map(phase => phase.startMonth))) throw new Error('reversion_rate_unknown');
  }
  return Decimal.parse(current.payableRate);
}

interface FeeState { applicable: PublicCostFee[]; complete: boolean; reasons: string[]; evidenceIds: string[]; local: boolean }
function resolveFees(scenario: PublicCostScenario): FeeState {
  const state: FeeState = { applicable: [], complete: scenario.feesKnown, reasons: scenario.feesKnown ? [] : ['material_fee_coverage_unknown'], evidenceIds: [], local: false };
  if (scenario.fees.length > 128) throw new Error('fee_schedule_unsupported');
  const ids = new Set<string>();
  for (const fee of scenario.fees) {
    if (ids.has(fee.feeId)) throw new Error('duplicate_fee_identity'); ids.add(fee.feeId);
    const conditions = fee.conditions.map(condition => evaluatePublicCondition(condition, scenario.rateScenario ?? {}, scenario.asOf));
    if (conditions.includes('unmet')) continue;
    if (conditions.includes('unknown') || fee.amount === undefined) { state.complete = false; state.reasons.push(fee.kind === 'cashback' ? 'cashback_eligibility_unknown' : 'fee_amount_or_eligibility_unknown'); continue; }
    money(fee.amount);
    if (fee.origin === 'public' && !fee.evidenceIds.length) { state.complete = false; state.reasons.push('fee_evidence_missing'); continue; }
    if (!Number.isInteger(fee.atMonth ?? 0) || (fee.atMonth ?? 0) < 0 || (fee.everyMonths !== undefined && (!Number.isInteger(fee.everyMonths) || fee.everyMonths < 1))) throw new Error('fee_schedule_unsupported');
    if (fee.kind === 'recurring' && fee.everyMonths === undefined) { state.complete = false; state.reasons.push('fee_frequency_unknown'); continue; }
    if (fee.funding === 'financed' && (scenario.section !== 'Mortgage' || fee.kind === 'cashback')) throw new Error('financed_fee_unsupported');
    state.applicable.push(fee); state.evidenceIds.push(...fee.evidenceIds); state.local ||= fee.origin === 'user';
  }
  return state;
}
function due(fee: PublicCostFee, month: number): boolean {
  const first = fee.atMonth ?? 0;
  return month >= first && (fee.everyMonths === undefined ? month === first : (month - first) % fee.everyMonths === 0);
}
function initial(resolution: RateResolution): PublicCostEstimate {
  return { completeness: 'unsupported', requestedMonths: 0, projectedMonths: 0, points: [], reasonCodes: [...resolution.reasonCodes], assumptions: [], evidenceIds: [...resolution.evidenceIds], verifiedCurrent: false };
}
function prepare(resolution: RateResolution, scenario: PublicCostScenario, result: PublicCostEstimate): FeeState {
  result.requestedMonths = requestedMonths(scenario);
  if (resolution.status !== 'exact' || resolution.payableRate === undefined) throw new Error('exact_payable_rate_required');
  if (!Number.isFinite(Date.parse(scenario.asOf))) throw new Error('invalid_as_of');
  if (scenario.rateBehaviour === 'variable' && !scenario.holdCurrentRate) throw new Error('variable_rate_assumption_required');
  if (scenario.rateBehaviour === 'variable') result.assumptions.push('Variable and reference rates are held at the selected levels; published phases still apply.');
  if (resolution.origin === 'user_entered' || resolution.origin === 'locally_calculated') result.assumptions.push('The current rate is a local numerical assumption.');
  const fees = resolveFees(scenario);
  result.reasonCodes.push(...fees.reasons); result.evidenceIds.push(...fees.evidenceIds);
  result.completeness = resolution.freshness.state !== 'current' && resolution.origin !== 'user_entered' ? 'stale' : fees.complete ? 'complete' : 'partial';
  result.verifiedCurrent = resolution.verifiedCurrent && fees.complete && !fees.local;
  return fees;
}

function mortgage(resolution: RateResolution, scenario: Extract<PublicCostScenario, { section: 'Mortgage' }>, result: PublicCostEstimate, fees: FeeState): void {
  if (!Number.isInteger(scenario.remainingTermMonths) || scenario.remainingTermMonths < 1 || scenario.remainingTermMonths > 600 || !['principal_and_interest', 'interest_only'].includes(scenario.repayment)) throw new Error('mortgage_terms_unsupported');
  let balance = money(scenario.principal), offset = money(scenario.offsetBalance ?? '0');
  const openingBalance = balance;
  let pricing = resolution, pricingScenario = scenario;
  if (offset.compare(PUBLIC_ZERO) > 0 && scenario.offsetSupported !== true) throw new Error('offset_support_unknown');
  const extra = money(scenario.extraMonthlyRepayment ?? '0');
  let interestTotal = PUBLIC_ZERO, feeTotal = PUBLIC_ZERO, cashbackTotal = PUBLIC_ZERO, principalTotal = PUBLIC_ZERO;
  let previousRate = '', scheduledPayment = PUBLIC_ZERO;
  const limit = Math.min(result.requestedMonths, scenario.remainingTermMonths);
  result.assumptions.push('Monthly nominal accrual and month-end repayments; rounded to cents monthly. Offset balance stays constant unless fees draw from it.');
  for (let month = 0; month < limit; month += 1) {
    let monthlyFees = PUBLIC_ZERO, monthlyCashback = PUBLIC_ZERO, nextBalance = balance, nextOffset = offset, financed = PUBLIC_ZERO;
    for (const fee of fees.applicable.filter(fee => due(fee, month))) {
      const amount = money(fee.amount!);
      if (fee.kind === 'cashback') monthlyCashback = monthlyCashback.add(amount);
      else { monthlyFees = monthlyFees.add(amount); if (fee.funding === 'financed') { nextBalance = nextBalance.add(amount); financed = financed.add(amount); }
        else if (fee.funding === 'offset') { if (nextOffset.compare(amount) < 0) throw new Error('offset_fee_funding_insufficient'); nextOffset = nextOffset.sub(amount); } }
    }
    let rate: Decimal;
    try {
      if (financed.compare(PUBLIC_ZERO) > 0 && scenario.programme) {
        if (month > 0) throw new Error('future_financed_fee_applicability_unknown');
        const scope: RateScenario = { ...scenario.rateScenario, amount: nextBalance.fixed(2) };
        if (scenario.rateScenario?.amount !== undefined && money(scenario.rateScenario.amount).compare(openingBalance) !== 0) throw new Error('financed_fee_scope_inconsistent');
        if (scenario.rateScenario?.lvr !== undefined) {
          const originalLvr = Decimal.parse(scenario.rateScenario.lvr);
          if (originalLvr.compare(PUBLIC_ZERO) <= 0 || openingBalance.compare(PUBLIC_ZERO) <= 0) throw new Error('financed_fee_scope_unknown');
          scope.lvr = decimalText(nextBalance.mul(originalLvr).div(openingBalance));
        }
        const adjusted = resolvePublicRate(scenario.programme, scope, scenario.asOf);
        result.evidenceIds.push(...adjusted.evidenceIds);
        if (adjusted.status !== 'exact' || adjusted.payableRate === undefined) {
          result.reasonCodes.push(...adjusted.reasonCodes);
          throw new Error(adjusted.conditions.unmet.length ? 'financed_fees_invalidate_pricing_scope' : 'financed_fee_scope_unknown');
        }
        const updatedScenario = { ...scenario, rateScenario: scope };
        if (phaseRate(adjusted, updatedScenario, month, nextBalance).compare(phaseRate(resolution, scenario, month, balance)) !== 0) throw new Error('financed_fees_change_payable_rate');
        pricing = adjusted; pricingScenario = updatedScenario;
        result.assumptions.push('Financed upfront fees are included in the loan amount and LVR before validating the selected pricing programme.');
      } else if (financed.compare(PUBLIC_ZERO) > 0 && ['published', 'publicly_calculated'].includes(resolution.origin)) {
        result.reasonCodes.push('financed_fee_scope_unknown'); result.completeness = result.completeness === 'stale' ? 'stale' : 'partial';
      }
      rate = phaseRate(pricing, pricingScenario, month, nextBalance);
    } catch (error) {
      if (month === 0) throw error;
      result.reasonCodes.push(error instanceof Error ? error.message : 'future_rate_unknown'); result.completeness = result.completeness === 'stale' ? 'stale' : 'partial'; break;
    }
    balance = nextBalance; offset = nextOffset;
    const rateKey = rate.fixed(24), bearing = balance.sub(offset).compare(PUBLIC_ZERO) > 0 ? balance.sub(offset) : PUBLIC_ZERO;
    const interest = bearing.mul(rate).div(TWELVE).rounded(2, 'half_up');
    if (previousRate !== rateKey || fees.applicable.some(fee => fee.funding === 'financed' && due(fee, month))) {
      scheduledPayment = scenario.repayment === 'interest_only' ? PUBLIC_ZERO : Decimal.parse(publicMortgagePayment(balance.fixed(2), rateKey, scenario.remainingTermMonths - month)); previousRate = rateKey;
    }
    const planned = scenario.repayment === 'interest_only' ? extra : scheduledPayment.add(extra).sub(interest);
    if (planned.compare(PUBLIC_ZERO) < 0) throw new Error('repayment_below_interest');
    const principal = planned.compare(balance) > 0 ? balance : planned;
    balance = balance.sub(principal).rounded(2, 'half_up'); principalTotal = principalTotal.add(principal);
    interestTotal = interestTotal.add(interest); feeTotal = feeTotal.add(monthlyFees); cashbackTotal = cashbackTotal.add(monthlyCashback);
    result.points.push({ month: month + 1, balance: balance.fixed(2), interest: interest.fixed(2), principalRepaid: principal.fixed(2), knownFees: monthlyFees.fixed(2), cashback: monthlyCashback.fixed(2) });
    result.projectedMonths = month + 1;
  }
  result.interest = interestTotal.fixed(2); result.knownFees = feeTotal.fixed(2); result.cashback = cashbackTotal.fixed(2);
  result.knownCostSubtotal = interestTotal.add(feeTotal).sub(cashbackTotal).fixed(2);
  result.principalRepaid = principalTotal.fixed(2); result.endingBalance = balance.fixed(2); result.endingOffset = offset.fixed(2);
  if (fees.complete) result.fees = feeTotal.fixed(2);
  if (result.completeness === 'complete' && result.projectedMonths === limit) result.interestAndFeeCost = result.knownCostSubtotal;
}

function interestMonths(frequency: 'monthly' | 'quarterly' | 'annually' | 'maturity' | 'daily' | 'unknown'): number | null {
  return frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : frequency === 'annually' ? 12 : frequency === 'maturity' ? 0 : frequency === 'daily' ? -1 : null;
}
function monthDays(asOf: string, month: number): number {
  const anchor = new Date(asOf), year = anchor.getUTCFullYear(), index = anchor.getUTCMonth() + month;
  const day = anchor.getUTCDate();
  const start = Date.UTC(year, index, Math.min(day, new Date(Date.UTC(year, index + 1, 0)).getUTCDate()));
  const end = Date.UTC(year, index + 1, Math.min(day, new Date(Date.UTC(year, index + 2, 0)).getUTCDate()));
  return (end - start) / 86400000;
}
function deposit(resolution: RateResolution, scenario: Extract<PublicCostScenario, { section: 'Savings' | 'TD' }>, result: PublicCostEstimate, fees: FeeState): void {
  const frequency = interestMonths(scenario.interestPayment);
  if (frequency === null) throw new Error('interest_payment_frequency_unsupported');
  if (scenario.section === 'TD' && frequency === -1) throw new Error('interest_payment_frequency_unsupported');
  if (frequency === -1 && scenario.interestBasis !== 'actual_365') throw new Error('daily_interest_basis_unknown');
  if (scenario.section === 'TD' && (scenario.quotedTermMonths === undefined || !Number.isInteger(scenario.quotedTermMonths) || scenario.quotedTermMonths < 1 || scenario.quotedTermMonths > 600)) throw new Error('quoted_maturity_unknown');
  let balance = money(scenario.section === 'Savings' ? scenario.startingBalance : scenario.deposit);
  const contribution = money(scenario.section === 'Savings' ? scenario.monthlyContribution ?? '0' : '0');
  const withdrawal = money(scenario.section === 'Savings' ? scenario.monthlyWithdrawal ?? '0' : '0');
  let interestTotal = PUBLIC_ZERO, accrued = PUBLIC_ZERO, feeTotal = PUBLIC_ZERO, cashbackTotal = PUBLIC_ZERO;
  const limit = scenario.section === 'TD' ? Math.min(result.requestedMonths, scenario.quotedTermMonths!) : result.requestedMonths;
  if (scenario.section === 'TD' && result.requestedMonths > scenario.quotedTermMonths!) { result.completeness = 'partial'; result.reasonCodes.push('renewal_rate_unknown'); }
  result.assumptions.push(scenario.interestBasis === 'actual_365' ? 'Interest uses actual calendar days divided by 365; balance changes occur at month boundaries.' : 'Monthly nominal interest; contributions and withdrawals occur at month boundaries.');
  if (scenario.section === 'TD') result.assumptions.push('Calculation stops at quoted maturity. Future renewal pricing is absent.');
  if (scenario.section === 'TD') {
    result.assumptions.push('Quoted term-deposit principal stays fixed; periodic interest is paid outside the deposit.');
    if (scenario.reinvestPaidInterest === true && frequency > 0 && frequency < limit) {
      result.completeness = result.completeness === 'stale' ? 'stale' : 'partial';
      result.reasonCodes.push('reinvestment_return_unknown');
      result.assumptions.push('Returns from reinvesting periodic interest require a separate local rate assumption and are excluded.');
    }
  }
  for (let month = 0; month < limit; month += 1) {
    balance = balance.add(contribution).sub(withdrawal);
    if (balance.compare(PUBLIC_ZERO) < 0) throw new Error('withdrawal_exceeds_balance');
    let rate: Decimal;
    try { rate = phaseRate(resolution, scenario, month, balance); } catch (error) { result.reasonCodes.push(error instanceof Error ? error.message : 'future_rate_unknown'); result.completeness = result.completeness === 'stale' ? 'stale' : 'partial'; break; }
    let interest = PUBLIC_ZERO;
    if (frequency === -1) {
      for (let day = 0; day < monthDays(scenario.asOf, month); day += 1) {
        const dailyRate = scenario.programme ? phaseRate(resolution, scenario, month, balance) : rate;
        const daily = balance.mul(dailyRate).div(Decimal.parse('365')).rounded(2, 'half_up');
        balance = balance.add(daily); interest = interest.add(daily);
      }
      interestTotal = interestTotal.add(interest);
    } else {
      interest = scenario.interestBasis === 'actual_365' ? balance.mul(rate).mul(Decimal.parse(String(monthDays(scenario.asOf, month)))).div(Decimal.parse('365')) : balance.mul(rate).div(TWELVE);
      accrued = accrued.add(interest);
    }
    const pays = frequency > 0 && (month + 1) % frequency === 0 || scenario.section === 'TD' && month + 1 === scenario.quotedTermMonths;
    if (pays) {
      const paid = accrued.rounded(2, 'half_up');
      if (scenario.section === 'Savings') balance = balance.add(paid);
      interestTotal = interestTotal.add(paid);
      accrued = PUBLIC_ZERO;
    }
    let monthlyFees = PUBLIC_ZERO, monthlyCashback = PUBLIC_ZERO;
    for (const fee of fees.applicable.filter(fee => due(fee, month))) {
      const amount = money(fee.amount!);
      if (fee.kind === 'cashback') monthlyCashback = monthlyCashback.add(amount); else monthlyFees = monthlyFees.add(amount);
    }
    if (scenario.section === 'Savings') balance = balance.sub(monthlyFees).add(monthlyCashback);
    if (balance.compare(PUBLIC_ZERO) < 0) throw new Error('fees_exceed_balance');
    feeTotal = feeTotal.add(monthlyFees); cashbackTotal = cashbackTotal.add(monthlyCashback);
    result.points.push({ month: month + 1, balance: balance.fixed(2), interest: interest.fixed(2), principalRepaid: '0.00', knownFees: monthlyFees.fixed(2), cashback: monthlyCashback.fixed(2) }); result.projectedMonths = month + 1;
  }
  const earned = interestTotal.add(accrued);
  result.interest = earned.fixed(2); result.knownFees = feeTotal.fixed(2); result.cashback = cashbackTotal.fixed(2);
  result.knownReturnSubtotal = earned.sub(feeTotal).add(cashbackTotal).fixed(2); result.endingBalance = balance.fixed(2);
  if (fees.complete) result.fees = feeTotal.fixed(2);
  if (result.completeness === 'complete' && result.projectedMonths === limit) result.netReturn = result.knownReturnSubtotal;
}

function dayTermDeposit(resolution: RateResolution, scenario: Extract<PublicCostScenario, { section: 'TD' }>, result: PublicCostEstimate, fees: FeeState): void {
  const days = scenario.quotedTermDays, requested = scenario.comparisonDays ?? days;
  if (days === undefined || requested === undefined || !Number.isInteger(days) || days < 1 || days > 18300 || !Number.isInteger(requested) || requested < 1 || requested > 18300) throw new Error('quoted_maturity_unknown');
  if (scenario.interestBasis !== 'actual_365') throw new Error('day_term_interest_basis_unknown');
  const frequency = interestMonths(scenario.interestPayment);
  if (frequency === null || frequency < 0) throw new Error('interest_payment_frequency_unsupported');
  result.requestedDays = requested; result.projectedDays = 0;
  const anchor = new Date(scenario.asOf), year = anchor.getUTCFullYear(), initialMonth = anchor.getUTCMonth(), initialDay = anchor.getUTCDate();
  const anniversary = (month: number) => Date.UTC(year, initialMonth + month, Math.min(initialDay, new Date(Date.UTC(year, initialMonth + month + 1, 0)).getUTCDate()));
  const opening = anniversary(0), limit = Math.min(days, requested);
  let balance = money(scenario.deposit), earned = PUBLIC_ZERO, accrued = PUBLIC_ZERO, feeTotal = PUBLIC_ZERO, cashback = PUBLIC_ZERO, month = 0;
  if (requested > days) { result.completeness = 'partial'; result.reasonCodes.push('renewal_rate_unknown'); }
  result.assumptions.push('Actual calendar days divided by 365; quoted day maturity ends the calculation. Charges are paid outside the fixed deposit principal.');
  for (let day = 0; day < limit; day += 1) {
    const date = opening + day * 86400000;
    while (date >= anniversary(month + 1)) month += 1;
    let rate: Decimal;
    try { rate = phaseRate(resolution, scenario, month, balance); } catch (error) { result.reasonCodes.push(error instanceof Error ? error.message : 'future_rate_unknown'); result.completeness = result.completeness === 'stale' ? 'stale' : 'partial'; break; }
    if (date === anniversary(month)) for (const fee of fees.applicable.filter(fee => due(fee, month))) {
      if (fee.kind === 'cashback') cashback = cashback.add(money(fee.amount!)); else feeTotal = feeTotal.add(money(fee.amount!));
    }
    accrued = accrued.add(balance.mul(rate).div(Decimal.parse('365')));
    const tomorrow = date + 86400000, paymentMonth = month + 1;
    if (tomorrow === anniversary(paymentMonth) && frequency > 0 && paymentMonth % frequency === 0 || day + 1 === days) {
      const paid = accrued.rounded(2, 'half_up'); earned = earned.add(paid); accrued = PUBLIC_ZERO;
      if (scenario.reinvestPaidInterest && day + 1 < limit && !result.reasonCodes.includes('reinvestment_return_unknown')) {
        result.completeness = result.completeness === 'stale' ? 'stale' : 'partial';
        result.reasonCodes.push('reinvestment_return_unknown');
        result.assumptions.push('Periodic term-deposit interest is paid outside the locked principal; returns from reinvesting it require a separate local rate assumption and are excluded.');
      }
    }
    result.projectedDays = day + 1; result.projectedMonths = month;
  }
  const interest = earned.add(accrued);
  result.interest = interest.fixed(2); result.knownFees = feeTotal.fixed(2); result.cashback = cashback.fixed(2); result.endingBalance = balance.fixed(2);
  result.knownReturnSubtotal = interest.sub(feeTotal).add(cashback).fixed(2);
  if (fees.complete) result.fees = feeTotal.fixed(2);
  if (result.completeness === 'complete' && result.projectedDays === limit) result.netReturn = result.knownReturnSubtotal;
}

/** Scenario estimates keep principal and closing balance separate from interest-and-fee costs. */
export function estimatePublicCost(resolution: RateResolution, scenario: PublicCostScenario): PublicCostEstimate {
  const result = initial(resolution);
  try {
    const fees = prepare(resolution, scenario, result);
    if (scenario.section === 'Mortgage') mortgage(resolution, scenario, result, fees);
    else if (scenario.section === 'TD' && scenario.quotedTermDays !== undefined) dayTermDeposit(resolution, scenario, result, fees);
    else deposit(resolution, scenario, result, fees);
  } catch (error) {
    result.completeness = 'unsupported'; result.reasonCodes.push(error instanceof Error ? error.message : 'cost_unsupported');
    result.verifiedCurrent = false;
  }
  result.reasonCodes = unique(result.reasonCodes); result.evidenceIds = unique(result.evidenceIds);
  if (result.completeness !== 'complete') result.verifiedCurrent = false;
  return result;
}

export interface PublicCostCandidate { id: string; resolution: RateResolution; cost?: PublicCostEstimate }
export function rankPublicCandidates(candidates: PublicCostCandidate[], allLoaded: boolean, scope?: { section: 'Mortgage' | 'Savings' | 'TD'; eligibleCount: number }) {
  if (new Set(candidates.map(candidate => candidate.id)).size !== candidates.length) throw new Error('duplicate_comparison_candidate');
  const priced = candidates.filter(candidate => candidate.resolution.status === 'exact' && candidate.resolution.payableRate !== undefined && candidate.resolution.verifiedCurrent);
  const completeCosts = priced.filter(candidate => candidate.cost?.completeness === 'complete');
  const rateRanking = [...priced].sort((a, b) => Decimal.parse(a.resolution.payableRate!).compare(Decimal.parse(b.resolution.payableRate!)) * (scope?.section === 'Mortgage' || !scope ? 1 : -1));
  const costRanking = [...completeCosts].filter(candidate => candidate.cost?.interestAndFeeCost !== undefined || candidate.cost?.netReturn !== undefined).sort((a, b) => {
    if (a.cost!.interestAndFeeCost !== undefined && b.cost!.interestAndFeeCost !== undefined) return Decimal.parse(a.cost!.interestAndFeeCost).compare(Decimal.parse(b.cost!.interestAndFeeCost));
    if (a.cost!.netReturn !== undefined && b.cost!.netReturn !== undefined) return Decimal.parse(b.cost!.netReturn).compare(Decimal.parse(a.cost!.netReturn));
    return 0;
  });
  const completeScope = allLoaded && scope !== undefined && scope.eligibleCount === candidates.length;
  return { allLoaded, completeScope, priced: priced.length, unresolved: candidates.length - priced.length, completeCosts: completeCosts.length,
    rateRanking, costRanking, ...(completeScope && rateRanking.length && scope.section === 'Mortgage' ? { lowestRate: rateRanking[0] } : {}),
    ...(completeScope && rateRanking.length && scope.section !== 'Mortgage' ? { highestRate: rateRanking[0] } : {}),
    ...(completeScope && costRanking[0]?.cost?.interestAndFeeCost !== undefined ? { lowestCost: costRanking[0] } : {}),
    ...(completeScope && costRanking[0]?.cost?.netReturn !== undefined ? { highestReturn: costRanking[0] } : {}) };
}
