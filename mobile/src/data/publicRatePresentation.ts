import type { PublicComponent, PublicCondition, PublicReferenceRate, RateResolution } from './publicRateModel';
import { Decimal, decimalText, rateDecimal } from './publicRateDecimal';

export function publicComponentFact(component: PublicComponent): string {
  const labels: Record<PublicComponent['role'], string> = { payable: 'Payable rate', reference: 'Reference rate', discount: 'Discount', margin: 'Margin', bonus: 'Bonus', comparison: 'Comparison rate', reversion: 'Reversion rate' };
  const adjustment = component.role === 'discount' || component.role === 'margin' || component.role === 'bonus';
  let value = 'Unavailable';
  if (component.value != null) {
    try {
      const percent = decimalText(rateDecimal(component.value, component.unit).mul(Decimal.parse('100')));
      value = `${percent}${adjustment ? ' percentage points' : '% p.a.'}`;
    } catch { /* Invalid numerical source values remain unavailable. */ }
  }
  return `${labels[component.role]}: ${value}${component.includedInPayable ? ' · Included in payable rate' : ''}`;
}

export function publicConditionFact(condition: PublicCondition): string {
  const label: Record<string, string> = { purpose: 'Purpose', repayment: 'Repayment', package: 'Package', customerCategory: 'Customer category', channel: 'Channel', termMonths: 'Term (months)', termDays: 'Term (days)', amount: 'Amount ($)', balance: 'Balance ($)', lvr: 'LVR', qualification: 'Qualification', monthlyDeposit: 'Monthly qualifying deposits ($)', withdrawals: 'Monthly withdrawals (count)', balanceGrowth: 'Qualifying balance growth ($)', cardTransactions: 'Qualifying card purchases (count)' };
  const name = label[condition.field] ?? condition.field;
  const text = (value: string | boolean) => String(value).toLowerCase().replace(/_/g, ' ');
  if (condition.operator === 'eq' && condition.value != null) return `${name}: ${text(condition.value)}`;
  if (condition.operator === 'in') return `${name}: ${(condition.values ?? []).map(text).join(' or ')}`;
  if (condition.operator === 'bounds') return `${name}: ${condition.minimum != null ? `${condition.minimumInclusive === false ? '>' : '≥'}${condition.minimum}` : ''}${condition.minimum != null && condition.maximum != null ? ', ' : ''}${condition.maximum != null ? `${condition.maximumInclusive === false ? '<' : '≤'}${condition.maximum}` : ''}`;
  return `${name}: required`;
}

export function publicReferenceScope(reference: PublicReferenceRate): string {
  return (reference.conditions ?? []).map(publicConditionFact).join(' · ') || 'Scope: not stated';
}

export function publicRateReason(reason: string): string {
  const messages: Record<string, string> = {
    catalogue_not_ready: 'Public pricing: loading',
    programme_not_loaded: 'Pricing evidence: not loaded',
    public_pricing_unavailable: 'Public pricing: unavailable',
    product_pricing_not_available: 'Product pricing: unavailable in this edition',
    pricing_programme_selection_required: 'Pricing programme: explicit selection required',
    semantic_offer_binding_missing: 'Legacy offer binding: unavailable',
    selected_reference_unavailable: 'Selected reference: unavailable in this edition',
    reference_conditions_unknown: 'Reference scope: assumptions missing',
    reference_conditions_unmet: 'Reference scope: not met',
    selected_reference_product_mismatch: 'Reference product/provider binding: mismatch',
    unknown_condition: 'Eligibility condition: unknown',
    source_conflict: 'Public sources: conflicting',
    source_stale: 'Source: stale; successful check older than 48 hours',
    source_failed: 'Latest source check: failed',
    unsupported_rate_type: 'Rate type: unsupported by reviewed adapter',
    future_effective: 'Rate: scheduled; not yet effective',
  };
  return messages[reason] ?? reason.replace(/_/g, ' ').replace(/^./, initial => initial.toUpperCase());
}

/** Formatting preserves units: resolver amounts are fractions, never guessed by magnitude. */
export function publicRateText(resolution: RateResolution): string {
  const percent = (value?: string) => value == null ? 'Unavailable' : `${(Number(value) * 100).toLocaleString('en-AU', { maximumFractionDigits: 4 })}% p.a.`;
  if (resolution.status === 'exact') return percent(resolution.payableRate);
  if (resolution.status === 'from') return `From ${percent(resolution.minimumRate)}`;
  if (resolution.status === 'range') return `${percent(resolution.minimumRate)}–${percent(resolution.maximumRate)}`;
  return 'Pricing unresolved';
}

export function publicRateOriginLabel(resolution: RateResolution): string {
  if (resolution.origin === 'user_entered') return 'Your entered interest rate';
  if (resolution.origin === 'locally_calculated') return 'Local reference estimate';
  if (resolution.status === 'unresolved') return 'Public pricing unresolved';
  if (!resolution.verifiedCurrent) return 'Last verified public pricing';
  return resolution.origin === 'publicly_calculated' ? 'Calculated public payable rate' : 'Published payable rate';
}
