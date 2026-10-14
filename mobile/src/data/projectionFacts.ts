/** Numeric presentation snapshots from existing financial engine locals. */
export type ProjectionFrequency = 'weekly' | 'fortnightly' | 'monthly';
export type ProjectionSeriesId = 'rate-lower' | 'rate-base' | 'rate-higher'
  | 'offset-none' | 'offset-steady' | 'offset-plan' | 'offset-boost';
export interface ProjectionHistorySnapshot {
  anchorDay: string;
  anchorBalance: number;
  anchorRateFraction: number;
  simulatedEndBalance: number;
  currentEnteredBalance: number;
  balanceDifference: number;
  balanceMismatchReported: boolean;
  offset?: {
    simulatedEndAmount: number;
    currentEnteredAmount: number;
    difference: number;
    mismatchReported: boolean;
  };
}
interface ProjectionSnapshotBase {
  months: number;
  rateRange: readonly [number, number, number];
  history: ProjectionHistorySnapshot | null;
}
export type ProjectionFactSnapshot =
  | (ProjectionSnapshotBase & {
    section: 'Mortgage';
    fixed: boolean;
    remainingYears: number;
    repayment: { monthlyAmount: number; source: 'entered' | 'illustrative'; enteredFrequency: ProjectionFrequency };
    extraRepayment: { monthlyAmount: number; enteredFrequency: ProjectionFrequency };
    offset: { openingAmount: number; openingSource: 'entered' | 'simulated-history'; growthMonthlyAmount: number;
      boostMonthlyAmount: number; enteredFrequency: ProjectionFrequency };
    outcomes: readonly { id: ProjectionSeriesId; negativeAmortisation: boolean; closingBalance: number }[];
  })
  | (ProjectionSnapshotBase & {
    section: 'Savings'; horizonYears: number;
    contribution: { monthlyAmount: number; enteredFrequency: ProjectionFrequency };
    withdrawal: { monthlyAmount: number; enteredFrequency: ProjectionFrequency };
    bonus: { conditionsMet: boolean; months: number; conditionalRateFraction: number; ongoingRateFraction: number } | null;
  })
  | (ProjectionSnapshotBase & {
    section: 'TD'; termMonths: number; rollovers: number; reinvestInterest: boolean;
    currentRateFraction: number;
  });

export type ProjectionFact =
  | { readonly kind: 'projection-basis'; readonly value: 'illustrative'; readonly forecast: 'none' }
  | { readonly kind: 'projection-horizon'; readonly scope: 'full-term' | 'fixed-period' | 'savings-horizon' | 'deposit-maturity'; readonly months: number }
  | { readonly kind: 'remaining-term'; readonly years: number }
  | { readonly kind: 'savings-horizon-years'; readonly years: number }
  | { readonly kind: 'rate-scenarios'; readonly lowerFraction: number; readonly baseFraction: number; readonly higherFraction: number; readonly holding: 'constant' }
  | { readonly kind: 'monthly-repayment'; readonly amount: number; readonly source: 'entered' | 'illustrative'; readonly enteredFrequency: ProjectionFrequency }
  | { readonly kind: 'monthly-extra-repayment'; readonly amount: number; readonly enteredFrequency: ProjectionFrequency }
  | { readonly kind: 'offset-model'; readonly openingAmount: number; readonly openingSource: 'entered' | 'simulated-history'; readonly role: 'interest-reduction'; readonly repayment: 'excluded' }
  | { readonly kind: 'monthly-offset-contribution'; readonly amount: number; readonly boostAmount: number; readonly enteredFrequency: ProjectionFrequency }
  | { readonly kind: 'net-offset-difference'; readonly state: 'unavailable'; readonly feeCoverage: 'unverified' }
  | { readonly kind: 'future-reversion-rate'; readonly state: 'unknown' }
  | { readonly kind: 'history-model'; readonly basis: 'approximate'; readonly anchorDay: string; readonly anchorBalance: number; readonly anchorRateFraction: number; readonly reanchor: 'current-entered-balance' }
  | { readonly kind: 'history-activity'; readonly rateChanges: 'unknown'; readonly paymentChanges: 'unknown'; readonly offsetChanges: 'unknown' | 'not-applicable'; readonly depositTerm: 'repeated-input' | 'not-applicable'; readonly maturityTreatment: 'repeated-input' | 'not-applicable' }
  | { readonly kind: 'history-balance-mismatch'; readonly differenceAmount: number; readonly simulatedEndAmount: number; readonly currentEnteredAmount: number }
  | { readonly kind: 'history-offset-mismatch'; readonly differenceAmount: number; readonly simulatedEndAmount: number; readonly currentEnteredAmount: number; readonly forwardSource: 'simulated-history' }
  | { readonly kind: 'negative-amortisation'; readonly scenarios: readonly ProjectionSeriesId[] }
  | { readonly kind: 'residual-loan-balance'; readonly scenarios: readonly { readonly id: ProjectionSeriesId; readonly amount: number }[] }
  | { readonly kind: 'monthly-contribution'; readonly amount: number; readonly enteredFrequency: ProjectionFrequency }
  | { readonly kind: 'monthly-withdrawal'; readonly amount: number; readonly enteredFrequency: ProjectionFrequency }
  | { readonly kind: 'deposit-interest-model'; readonly accrual: 'monthly-nominal'; readonly payment: 'maturity'; readonly providerDayCount: 'unverified'; readonly providerPaymentTiming: 'unverified' }
  | { readonly kind: 'deposit-interest-treatment'; readonly value: 'reinvest-at-maturity' | 'paid-out-at-maturity' }
  | { readonly kind: 'deposit-term'; readonly months: number; readonly currentRateFraction: number }
  | { readonly kind: 'deposit-rollovers'; readonly count: number; readonly rateBasis: 'scenario'; readonly futureRenewalRate: 'unknown' }
  | { readonly kind: 'savings-interest-model'; readonly compounding: 'monthly'; readonly providerTiming: 'unverified'; readonly bonusApplicability: 'unverified' }
  | { readonly kind: 'savings-bonus-model'; readonly conditions: 'entered-met' | 'entered-unmet'; readonly periodMonths: number; readonly conditionalRateFraction: number; readonly ongoingRateFraction: number; readonly startingRate: 'conditional' | 'ongoing' }
  | { readonly kind: 'projection-exclusions'; readonly tax: 'excluded'; readonly actualFutureRateChanges: 'unknown' };

function money(value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new TypeError('Invalid projection money snapshot');
}
function rate(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new TypeError('Invalid projection rate snapshot');
}
function months(value: number, zero = false): void {
  if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1)) throw new TypeError('Invalid projection period snapshot');
}
function frequency(value: ProjectionFrequency): void {
  if (!['weekly', 'fortnightly', 'monthly'].includes(value)) throw new TypeError('Invalid projection frequency snapshot');
}
function day(value: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new TypeError('Invalid projection date snapshot');
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d)
    throw new TypeError('Invalid projection date snapshot');
}

/** New facts are emitted beside existing simulations; never parse warning prose. */
export function projectionFacts(snapshot: ProjectionFactSnapshot): readonly ProjectionFact[] {
  months(snapshot.months, true); snapshot.rateRange.forEach(rate);
  const scope = snapshot.section === 'Mortgage' ? snapshot.fixed ? 'fixed-period' : 'full-term'
    : snapshot.section === 'TD' ? 'deposit-maturity' : 'savings-horizon';
  const facts: ProjectionFact[] = [
    { kind: 'projection-basis', value: 'illustrative', forecast: 'none' },
    { kind: 'projection-horizon', scope, months: snapshot.months },
    { kind: 'rate-scenarios', lowerFraction: snapshot.rateRange[0], baseFraction: snapshot.rateRange[1],
      higherFraction: snapshot.rateRange[2], holding: 'constant' },
    { kind: 'projection-exclusions', tax: 'excluded', actualFutureRateChanges: 'unknown' },
  ];
  const history = snapshot.history;
  if (history) {
    day(history.anchorDay); money(history.anchorBalance); rate(history.anchorRateFraction);
    money(history.simulatedEndBalance); money(history.currentEnteredBalance); money(history.balanceDifference);
    facts.push({ kind: 'history-model', basis: 'approximate', anchorDay: history.anchorDay,
      anchorBalance: history.anchorBalance, anchorRateFraction: history.anchorRateFraction,
      reanchor: 'current-entered-balance' });
    facts.push({ kind: 'history-activity', rateChanges: 'unknown', paymentChanges: 'unknown',
      offsetChanges: snapshot.section === 'Mortgage' ? 'unknown' : 'not-applicable',
      depositTerm: snapshot.section === 'TD' ? 'repeated-input' : 'not-applicable',
      maturityTreatment: snapshot.section === 'TD' ? 'repeated-input' : 'not-applicable' });
    if (history.balanceMismatchReported) facts.push({ kind: 'history-balance-mismatch',
      differenceAmount: history.balanceDifference, simulatedEndAmount: history.simulatedEndBalance,
      currentEnteredAmount: history.currentEnteredBalance });
    if (history.offset) {
      money(history.offset.simulatedEndAmount); money(history.offset.currentEnteredAmount); money(history.offset.difference);
      if (history.offset.mismatchReported) facts.push({ kind: 'history-offset-mismatch',
        differenceAmount: history.offset.difference, simulatedEndAmount: history.offset.simulatedEndAmount,
        currentEnteredAmount: history.offset.currentEnteredAmount, forwardSource: 'simulated-history' });
    }
  }
  if (snapshot.section === 'Mortgage') {
    if (!Number.isFinite(snapshot.remainingYears) || snapshot.remainingYears <= 0)
      throw new TypeError('Invalid remaining term snapshot');
    money(snapshot.repayment.monthlyAmount); money(snapshot.extraRepayment.monthlyAmount);
    frequency(snapshot.repayment.enteredFrequency); frequency(snapshot.extraRepayment.enteredFrequency); frequency(snapshot.offset.enteredFrequency);
    if (!['entered', 'illustrative'].includes(snapshot.repayment.source) || !['entered', 'simulated-history'].includes(snapshot.offset.openingSource))
      throw new TypeError('Invalid projection input source snapshot');
    money(snapshot.offset.openingAmount); money(snapshot.offset.growthMonthlyAmount); money(snapshot.offset.boostMonthlyAmount);
    facts.push({ kind: 'remaining-term', years: snapshot.remainingYears },
      { kind: 'monthly-repayment', amount: snapshot.repayment.monthlyAmount, source: snapshot.repayment.source,
        enteredFrequency: snapshot.repayment.enteredFrequency },
      { kind: 'monthly-extra-repayment', amount: snapshot.extraRepayment.monthlyAmount,
        enteredFrequency: snapshot.extraRepayment.enteredFrequency },
      { kind: 'offset-model', openingAmount: snapshot.offset.openingAmount, openingSource: snapshot.offset.openingSource,
        role: 'interest-reduction', repayment: 'excluded' },
      { kind: 'monthly-offset-contribution', amount: snapshot.offset.growthMonthlyAmount,
        boostAmount: snapshot.offset.boostMonthlyAmount, enteredFrequency: snapshot.offset.enteredFrequency },
      { kind: 'net-offset-difference', state: 'unavailable', feeCoverage: 'unverified' });
    if (snapshot.fixed) facts.push({ kind: 'future-reversion-rate', state: 'unknown' });
    snapshot.outcomes.forEach(outcome => {
      money(outcome.closingBalance);
      if (!['rate-lower', 'rate-base', 'rate-higher', 'offset-none', 'offset-steady', 'offset-plan', 'offset-boost'].includes(outcome.id))
        throw new TypeError('Invalid projection series snapshot');
    });
    const growing = snapshot.outcomes.filter(outcome => outcome.negativeAmortisation).map(outcome => outcome.id);
    if (growing.length) facts.push({ kind: 'negative-amortisation', scenarios: growing });
    const residual = snapshot.outcomes.filter(outcome => outcome.closingBalance > 0.01)
      .map(outcome => ({ id: outcome.id, amount: outcome.closingBalance }));
    if (!snapshot.fixed && residual.length) facts.push({ kind: 'residual-loan-balance', scenarios: residual });
  } else if (snapshot.section === 'Savings') {
    if (!Number.isFinite(snapshot.horizonYears) || snapshot.horizonYears <= 0)
      throw new TypeError('Invalid savings horizon snapshot');
    money(snapshot.contribution.monthlyAmount); money(snapshot.withdrawal.monthlyAmount);
    frequency(snapshot.contribution.enteredFrequency); frequency(snapshot.withdrawal.enteredFrequency);
    facts.push({ kind: 'savings-horizon-years', years: snapshot.horizonYears },
      { kind: 'monthly-contribution', amount: snapshot.contribution.monthlyAmount,
      enteredFrequency: snapshot.contribution.enteredFrequency },
      { kind: 'monthly-withdrawal', amount: snapshot.withdrawal.monthlyAmount,
        enteredFrequency: snapshot.withdrawal.enteredFrequency },
      { kind: 'savings-interest-model', compounding: 'monthly', providerTiming: 'unverified', bonusApplicability: 'unverified' });
    if (snapshot.bonus) {
      months(snapshot.bonus.months, true); rate(snapshot.bonus.conditionalRateFraction); rate(snapshot.bonus.ongoingRateFraction);
      facts.push({ kind: 'savings-bonus-model', conditions: snapshot.bonus.conditionsMet ? 'entered-met' : 'entered-unmet',
        periodMonths: snapshot.bonus.months, conditionalRateFraction: snapshot.bonus.conditionalRateFraction,
        ongoingRateFraction: snapshot.bonus.ongoingRateFraction,
        startingRate: snapshot.bonus.conditionsMet && snapshot.bonus.months > 0 ? 'conditional' : 'ongoing' });
    }
  } else {
    months(snapshot.termMonths); months(snapshot.rollovers, true); rate(snapshot.currentRateFraction);
    facts.push({ kind: 'deposit-term', months: snapshot.termMonths, currentRateFraction: snapshot.currentRateFraction },
      { kind: 'deposit-interest-model', accrual: 'monthly-nominal', payment: 'maturity',
        providerDayCount: 'unverified', providerPaymentTiming: 'unverified' },
      { kind: 'deposit-interest-treatment', value: snapshot.reinvestInterest ? 'reinvest-at-maturity' : 'paid-out-at-maturity' });
    if (snapshot.rollovers > 0) facts.push({ kind: 'deposit-rollovers', count: snapshot.rollovers,
      rateBasis: 'scenario', futureRenewalRate: 'unknown' });
  }
  return facts;
}

export type SwitchFeeKind = 'currentBankExitFees' | 'applicationFees' | 'valuationFees'
  | 'settlementFees' | 'governmentAndLegalFees' | 'otherUpfrontFees';
export interface StaySwitchFactSnapshot {
  openingBalance: number; remainingYears: number; openingOffset: number;
  householdMonthlyAllocation: number; targetMonthlyShortfall: number;
  targetHasOffset: boolean; offsetEvidence: 'entered' | 'published' | 'not-published' | 'unavailable';
  funding: 'cash' | 'new-loan'; fixed: boolean; months: number;
  fees: {
    entries: readonly { key: SwitchFeeKind; amount: number; source: 'entered' | 'published' | 'missing' }[];
    costClaimsAvailable: boolean; feeInputsComplete: boolean;
    grossFees: number; cashback: number; netSwitchCost: number;
    unpricedUpfrontCount: number; unpricedPeriodicCount: number;
  };
}
export type StaySwitchFact =
  | { readonly kind: 'switch-opening-inputs'; readonly balance: number; readonly remainingYears: number; readonly offsetAmount: number }
  | { readonly kind: 'switch-rate-basis'; readonly value: 'advertised'; readonly holding: 'constant' }
  | { readonly kind: 'household-allocation'; readonly monthlyAmount: number; readonly policy: 'baseline' | 'additional-required' }
  | { readonly kind: 'target-allocation-shortfall'; readonly monthlyAmount: number }
  | { readonly kind: 'target-offset'; readonly available: boolean; readonly evidence: 'entered' | 'published' | 'not-published' | 'unavailable'; readonly spareDestination: 'offset' | 'principal'; readonly offsetCap: 'uncapped' | 'not-applicable' }
  | { readonly kind: 'switch-funding'; readonly method: 'cash' | 'new-loan'; readonly netCostAmount: number }
  | { readonly kind: 'switch-cost-claims'; readonly state: 'available' | 'unavailable'; readonly feeInputs: 'complete' | 'incomplete'; readonly materialTerms: 'verification-required'; readonly customerApplicability: 'verification-required'; readonly calculation: 'supported-evaluator-required' }
  | { readonly kind: 'switch-fee'; readonly fee: SwitchFeeKind; readonly state: 'known'; readonly amount: number; readonly source: 'entered' | 'published' }
  | { readonly kind: 'switch-fee'; readonly fee: SwitchFeeKind; readonly state: 'unknown' }
  | { readonly kind: 'unpriced-switch-fees'; readonly upfrontCount: number; readonly periodicCount: number }
  | { readonly kind: 'cashback-exceeds-fees'; readonly cashbackAmount: number; readonly modelledFeesAmount: number; readonly eligibility: 'unverified'; readonly paymentTiming: 'unverified' }
  | { readonly kind: 'switch-horizon'; readonly scope: 'published-fixed-period' | 'remaining-term'; readonly months: number; readonly futureReversionRate: 'unknown' | 'not-modelled' }
  | { readonly kind: 'switch-exclusions'; readonly tax: 'excluded'; readonly refinancingTiming: 'unverified'; readonly futureRateChanges: 'unknown' };

export function staySwitchFacts(snapshot: StaySwitchFactSnapshot): readonly StaySwitchFact[] {
  money(snapshot.openingBalance); money(snapshot.openingOffset); money(snapshot.householdMonthlyAllocation);
  money(snapshot.targetMonthlyShortfall); money(snapshot.fees.grossFees); money(snapshot.fees.cashback);
  months(snapshot.months); months(snapshot.fees.unpricedUpfrontCount, true); months(snapshot.fees.unpricedPeriodicCount, true);
  if (!Number.isFinite(snapshot.remainingYears) || snapshot.remainingYears <= 0 || !Number.isFinite(snapshot.fees.netSwitchCost))
    throw new TypeError('Invalid switch presentation snapshot');
  if (!['cash', 'new-loan'].includes(snapshot.funding) || !['entered', 'published', 'not-published', 'unavailable'].includes(snapshot.offsetEvidence))
    throw new TypeError('Invalid switch source snapshot');
  const extra = snapshot.targetMonthlyShortfall > 0.005;
  const facts: StaySwitchFact[] = [
    { kind: 'switch-opening-inputs', balance: snapshot.openingBalance, remainingYears: snapshot.remainingYears, offsetAmount: snapshot.openingOffset },
    { kind: 'switch-rate-basis', value: 'advertised', holding: 'constant' },
    { kind: 'household-allocation', monthlyAmount: snapshot.householdMonthlyAllocation, policy: extra ? 'additional-required' : 'baseline' },
    { kind: 'target-offset', available: snapshot.targetHasOffset, evidence: snapshot.offsetEvidence,
      spareDestination: snapshot.targetHasOffset ? 'offset' : 'principal', offsetCap: snapshot.targetHasOffset ? 'uncapped' : 'not-applicable' },
    { kind: 'switch-funding', method: snapshot.funding, netCostAmount: snapshot.fees.netSwitchCost },
    { kind: 'switch-cost-claims', state: snapshot.fees.costClaimsAvailable ? 'available' : 'unavailable',
      feeInputs: snapshot.fees.feeInputsComplete ? 'complete' : 'incomplete', materialTerms: 'verification-required',
      customerApplicability: 'verification-required', calculation: 'supported-evaluator-required' },
    { kind: 'switch-horizon', scope: snapshot.fixed ? 'published-fixed-period' : 'remaining-term', months: snapshot.months,
      futureReversionRate: snapshot.fixed ? 'unknown' : 'not-modelled' },
    { kind: 'switch-exclusions', tax: 'excluded', refinancingTiming: 'unverified', futureRateChanges: 'unknown' },
  ];
  if (extra) facts.push({ kind: 'target-allocation-shortfall', monthlyAmount: snapshot.targetMonthlyShortfall });
  snapshot.fees.entries.forEach(fee => {
    if (!['currentBankExitFees', 'applicationFees', 'valuationFees', 'settlementFees', 'governmentAndLegalFees', 'otherUpfrontFees'].includes(fee.key)
      || !['entered', 'published', 'missing'].includes(fee.source)) throw new TypeError('Invalid switch fee snapshot');
    if (fee.source === 'missing') facts.push({ kind: 'switch-fee', fee: fee.key, state: 'unknown' });
    else { money(fee.amount); facts.push({ kind: 'switch-fee', fee: fee.key, state: 'known', amount: fee.amount, source: fee.source }); }
  });
  if (snapshot.fees.unpricedUpfrontCount || snapshot.fees.unpricedPeriodicCount) facts.push({ kind: 'unpriced-switch-fees',
    upfrontCount: snapshot.fees.unpricedUpfrontCount, periodicCount: snapshot.fees.unpricedPeriodicCount });
  if (snapshot.fees.netSwitchCost < 0) facts.push({ kind: 'cashback-exceeds-fees', cashbackAmount: snapshot.fees.cashback,
    modelledFeesAmount: snapshot.fees.grossFees, eligibility: 'unverified', paymentTiming: 'unverified' });
  return facts;
}
