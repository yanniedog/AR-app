import type { StaySwitchFact, SwitchFeeKind } from '../data/projectionFacts';
import { uiCount, uiDuration, uiJoin, uiLabel, uiMoney, type UiLabel, type UiText } from './uiCopy';
import type { FinancialFactRow } from './financialUiCopy';
export const SWITCH_FEE_LABELS: Readonly<Record<SwitchFeeKind, UiLabel>> = {
  currentBankExitFees: 'Current bank exit fees', applicationFees: 'Application fees', valuationFees: 'Valuation fees',
  settlementFees: 'Settlement fees', governmentAndLegalFees: 'Government & legal', otherUpfrontFees: 'Other upfront fees',
};
/** Stay/switch monetary facts retain cents; general compact formatting is unchanged. */
export function uiStaySwitchMoney(amount: number | null | undefined): UiText {
  return uiMoney(amount, 2);
}
export function uiStaySwitchFact(fact: StaySwitchFact): readonly FinancialFactRow[] {
  switch (fact.kind) {
    case 'switch-opening-inputs': return [{ label: 'Starting balance', value: uiStaySwitchMoney(fact.balance) }, { label: 'Remaining term', value: uiDuration(fact.remainingYears, 'years') }, { label: 'Opening offset', value: uiStaySwitchMoney(fact.offsetAmount) }];
    case 'switch-rate-basis': return [{ label: 'Basis', value: uiJoin('Advertised rate', ' · ', 'Rate held') }];
    case 'household-allocation': return [{ label: 'Monthly repayment', value: uiJoin(uiStaySwitchMoney(fact.monthlyAmount), ' · ', fact.policy === 'additional-required' ? 'Required' : 'Entered') }];
    case 'target-allocation-shortfall': return [{ label: 'Repayment shortfall', value: uiJoin(uiStaySwitchMoney(fact.monthlyAmount), ' ', 'per month') }];
    case 'target-offset': return [{ label: 'Target offset', value: uiJoin(fact.available ? 'Yes' : 'No', ' · ', fact.evidence === 'entered' ? 'Entered' : fact.evidence === 'published' ? 'Published' : 'Unverified') },
      { label: 'Offset contribution', value: uiLabel(fact.spareDestination === 'offset' ? 'Offset' : 'Principal') },
      { label: 'Maximum', value: uiLabel(fact.offsetCap === 'uncapped' ? 'Uncapped' : 'Not applicable') }];
    case 'switch-funding': return [{ label: 'Funding', value: uiJoin(fact.method === 'new-loan' ? 'New loan' : 'Cash / offset', ' · ', uiStaySwitchMoney(fact.netCostAmount)) }];
    case 'switch-cost-claims': return [{ label: 'Total-cost difference', value: uiLabel(fact.state === 'available' ? 'Ready' : 'Unavailable') },
      { label: 'Fees', value: uiLabel(fact.feeInputs === 'complete' ? 'Entered' : 'Inputs incomplete') },
      { label: 'Terms', value: uiLabel('Unverified') }, { label: 'Eligibility', value: uiLabel('Unverified') }, { label: 'Calculation', value: uiLabel('Unverified') }];
    case 'switch-fee': return [{ label: SWITCH_FEE_LABELS[fact.fee], value: fact.state === 'unknown' ? uiLabel('Unknown') : uiJoin(uiStaySwitchMoney(fact.amount), ' · ', fact.source === 'entered' ? 'Entered' : 'Published') }];
    case 'unpriced-switch-fees': return [{ label: 'Unpriced fees', value: uiJoin(uiCount(fact.upfrontCount), ' / ', uiCount(fact.periodicCount)) }];
    case 'cashback-exceeds-fees': return [{ label: 'Cashback', value: uiStaySwitchMoney(fact.cashbackAmount) }, { label: 'Known costs', value: uiStaySwitchMoney(fact.modelledFeesAmount) },
      { label: 'Eligibility', value: uiLabel('Unverified') }, { label: 'Payment', value: uiLabel('Unverified') }];
    case 'switch-horizon': return [{ label: 'Projection horizon', value: uiJoin(uiDuration(fact.months, 'months'), ' · ', fact.scope === 'published-fixed-period' ? 'Fixed-rate scope' : 'Remaining-term scope') },
      ...(fact.futureReversionRate === 'unknown' ? [{ label: 'Reversion rate' as const, value: uiLabel('Unknown') }] : [])];
    case 'switch-exclusions': return [{ label: 'Tax', value: uiLabel('Excluded') }, { label: 'Payment', value: uiLabel('Unverified') }, { label: 'Rate', value: uiLabel('No forecast') }];
  }
}
