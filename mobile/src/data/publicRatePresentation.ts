import type { PublicReferenceRate, RateResolution } from './publicRateModel';

export function publicReferenceScope(reference: PublicReferenceRate): string {
  const label: Record<string, string> = { purpose: 'Purpose', repayment: 'Repayment', package: 'Package', customerCategory: 'Customer category', channel: 'Channel', termMonths: 'Term (months)', termDays: 'Term (days)' };
  const text = (value: string | boolean) => String(value).toLowerCase().replace(/_/g, ' ');
  return (reference.conditions ?? []).map(condition => {
    const name = label[condition.field] ?? condition.field;
    if (condition.operator === 'eq' && condition.value != null) return `${name}: ${text(condition.value)}`;
    if (condition.operator === 'in') return `${name}: ${(condition.values ?? []).map(text).join(' or ')}`;
    if (condition.operator === 'bounds') return `${name}: ${condition.minimum != null ? `${condition.minimumInclusive === false ? '>' : '≥'}${condition.minimum}` : ''}${condition.minimum != null && condition.maximum != null ? ', ' : ''}${condition.maximum != null ? `${condition.maximumInclusive === false ? '<' : '≤'}${condition.maximum}` : ''}`;
    return condition.description ?? `${name}: required`;
  }).join(' · ') || 'Scope not stated';
}

export function publicRateReason(reason: string): string {
  const messages: Record<string, string> = {
    catalogue_not_ready: 'Public pricing is still loading.',
    programme_not_loaded: 'The pricing evidence for this product has not loaded.',
    public_pricing_unavailable: 'No usable public pricing is available for this product.',
    product_pricing_not_available: 'This edition has no public pricing for this product.',
    pricing_programme_selection_required: 'Choose the exact pricing programme; several regimes share this product name.',
    semantic_offer_binding_missing: 'This legacy rate has no stable binding to the public pricing programme.',
    selected_reference_unavailable: 'The selected public reference is unavailable in this edition.',
    reference_conditions_unknown: 'Enter the missing purpose, repayment, package or customer-category assumptions for this reference.',
    reference_conditions_unmet: 'Your selected assumptions do not meet this reference family’s scope.',
    selected_reference_product_mismatch: 'This reference family is not bound to the selected product or provider.',
    unknown_condition: 'A material eligibility condition needs a scenario selection.',
    source_conflict: 'Public sources disagree about this pricing.',
    source_stale: 'The public source has not been successfully checked within 48 hours.',
    source_failed: 'The latest public-source check failed.',
    unsupported_rate_type: 'The public rate type needs a reviewed source adapter.',
    future_effective: 'This rate takes effect in the future.',
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
