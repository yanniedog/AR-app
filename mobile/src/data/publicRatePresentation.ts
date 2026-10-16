import type { PublicComponent, PublicCondition, PublicReferenceRate, RateResolution } from './publicRateModel';
import { Decimal, decimalText, rateDecimal } from './publicRateDecimal';
import { uiDecimal, uiJoin, uiLabel, uiOpaqueEnum, uiRate, type UiCopy, type UiText } from '../lib/uiCopy';

export function publicComponentFact(component: PublicComponent): UiText {
  const labels = { payable: 'Payable rate', reference: 'Reference rate', discount: 'Discount', margin: 'Margin', bonus: 'Bonus', comparison: 'Comparison rate', reversion: 'Reversion rate' } as const;
  const adjustment = component.role === 'discount' || component.role === 'margin' || component.role === 'bonus';
  let value = uiLabel('Unavailable');
  if (component.value != null) {
    try {
      const fraction = rateDecimal(component.value, component.unit);
      value = adjustment ? uiJoin(uiDecimal(decimalText(fraction.mul(Decimal.parse('100'))), 'count'), ' ', 'pp') : uiRate(Number(decimalText(fraction)), 4);
    } catch { /* Invalid source amounts remain unavailable. */ }
  }
  return uiJoin(labels[component.role], ': ', value, component.includedInPayable ? uiJoin(' · ', 'Payable rate', ': ', 'Included') : null);
}

export function publicConditionFact(condition: PublicCondition): UiText {
  const labels: Record<string, UiCopy> = { purpose: 'Purpose', repayment: 'Repayment', package: 'Package', customerCategory: 'Customer category', channel: 'Channel', termMonths: uiJoin('Term', ' (', 'months', ')'), termDays: uiJoin('Term', ' (', 'days', ')'), amount: 'Loan amount', balance: 'Balance', lvr: 'LVR', qualification: 'Qualification', monthlyDeposit: 'Monthly deposits ($)', withdrawals: 'Monthly withdrawals', balanceGrowth: 'Balance growth ($)', cardTransactions: 'Card purchases' };
  const name = labels[condition.field] ?? uiOpaqueEnum(condition.field.toUpperCase());
  const amount = (value: string): UiText => condition.field === 'lvr' ? uiRate(Number(value), 4)
    : ['amount', 'balance', 'monthlyDeposit', 'balanceGrowth'].includes(condition.field) ? uiDecimal(value)
    : uiDecimal(value, 'count');
  const text = (value: string | boolean): UiText => typeof value === 'boolean' ? uiLabel(value ? 'Yes' : 'No')
    : /^-?\d+(?:\.\d+)?$/.test(value) ? amount(value) : uiOpaqueEnum(value.toUpperCase());
  if (condition.operator === 'eq' && condition.value != null) return uiJoin(name, ': ', text(condition.value));
  if (condition.operator === 'in') return uiJoin(name, ': ', ...(condition.values ?? []).flatMap<UiCopy>((value, i) => i ? [' / ', text(value)] : [text(value)]));
  if (condition.operator === 'bounds') return uiJoin(name, ': ',
    condition.minimum != null ? uiJoin(condition.minimumInclusive === false ? '>' : '≥', amount(condition.minimum)) : null,
    condition.minimum != null && condition.maximum != null ? ', ' : null,
    condition.maximum != null ? uiJoin(condition.maximumInclusive === false ? '<' : '≤', amount(condition.maximum)) : null);
  return uiJoin(name, ': ', 'Required');
}

export function publicReferenceScope(reference: PublicReferenceRate): UiText {
  return reference.conditions?.length ? uiJoin(...reference.conditions.flatMap<UiCopy>((condition, i) => i ? [' · ', publicConditionFact(condition)] : [publicConditionFact(condition)])) : uiJoin('Scope', ': ', 'Unknown');
}

export function publicRateReason(reason: string): UiText {
  const messages: Record<string, UiCopy> = {
    catalogue_not_ready: uiJoin('Public pricing', ': ', 'Loading'),
    programme_not_loaded: uiJoin('Pricing evidence', ': ', 'Loading'),
    public_pricing_unavailable: uiJoin('Public pricing', ': ', 'Unavailable'),
    product_pricing_not_available: uiJoin('Public pricing', ': ', 'Unavailable'),
    pricing_programme_selection_required: uiJoin('Pricing programme', ': ', 'Required'),
    semantic_offer_binding_missing: uiJoin('Selected rate', ': ', 'Unavailable'),
    selected_reference_unavailable: uiJoin('Reference', ': ', 'Unavailable'),
    reference_conditions_unknown: uiJoin('Reference scope', ': ', 'Unknown'),
    reference_conditions_unmet: uiJoin('Reference scope', ': ', 'Unmet'),
    selected_reference_product_mismatch: uiJoin('Reference scope', ': ', 'Unmet'),
    unknown_condition: uiJoin('Eligibility', ': ', 'Unknown'),
    source_conflict: uiJoin('Source', ': ', 'Needs review'),
    source_stale: uiJoin('Source', ': ', 'Stale'),
    source_failed: uiJoin('Latest', ' ', 'Source', ': ', 'Failed'),
    unsupported_rate_type: uiJoin('Rate type', ': ', 'Unavailable'),
    future_effective: uiJoin('Rate', ': ', 'Pending'),
  };
  return uiJoin(messages[reason] ?? uiOpaqueEnum(reason.toUpperCase()));
}

/** Resolver amounts carry explicit fractions; comparison rates remain separate. */
export function publicRateText(resolution: RateResolution): UiText {
  const percent = (value?: string) => value == null ? uiLabel('Unavailable') : uiRate(Number(value), 4);
  if (resolution.status === 'exact') return percent(resolution.payableRate);
  if (resolution.status === 'from') return uiJoin('From', ' ', percent(resolution.minimumRate));
  if (resolution.status === 'range') return uiJoin(percent(resolution.minimumRate), '–', percent(resolution.maximumRate));
  return uiLabel('Pricing unresolved');
}

export function publicRateOriginLabel(resolution: RateResolution): UiText {
  if (resolution.origin === 'user_entered') return uiLabel('Your entered rates');
  if (resolution.origin === 'locally_calculated') return uiLabel('Local reference estimate');
  if (resolution.status === 'unresolved') return uiLabel('Pricing unresolved');
  if (!resolution.verifiedCurrent) return uiLabel('Last verified pricing');
  return uiLabel(resolution.origin === 'publicly_calculated' ? 'Calculated payable rate' : 'Public payable rate');
}
