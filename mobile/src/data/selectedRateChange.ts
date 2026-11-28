import type { RateRow, SectionKey } from '../types';
import { rateTierSignature } from './bankRateOverview';
import { scopedRateConditions, type RateConditionContext } from './rateConditions';
import { rowsForProductKey } from './rateRowIndex';
import { toFraction } from './rateNumbers';
import { summarizeProductBestRateSeries } from './productHistoryModel';

export function selectedRateChange(previous: RateConditionContext | undefined, current: RateConditionContext,
  selected: RateRow, section: SectionKey, metric: 'rate' | 'comparison_rate' | 'ongoing_rate') {
  if (!previous?.core || !current.core || previous.core.run_date >= current.core.run_date) return null;
  // A missing bound is not proof that two deposit amounts qualify for the same tier.
  if (section === 'TD' && (!(selected.term || selected.term_months) || !selected.interest_payment)) return null;
  if (selected.balance_min == null && selected.balance_max == null && selected.exact_alert_eligible !== true) return null;
  const signature = rateTierSignature(selected);
  function observation(context: RateConditionContext) {
    const rows = rowsForProductKey(context.core!.sections[section].rates, selected.product_key);
    const matches = rows.filter(row => rateTierSignature(row) === signature);
    if (matches.length !== 1 || matches[0].exact_alert_eligible === false) return null;
    const row = matches[0];
    if (context === current && row !== selected) return null;
    const conditions = scopedRateConditions(row, section, context);
    if (conditions.status !== 'available') return null;
    const detail = context.details!.products[row.product_key];
    const terms = JSON.stringify([detail.description, detail.fees, detail.eligibility, detail.constraints, detail.features, detail.facts,
      conditions.entries.map(entry => [entry.tierSourcePointer ? 'tier' : 'rate', entry.text]).sort()]);
    const rate = toFraction(row[metric]);
    return rate === null ? null : { terms, rate };
  }
  const before = observation(previous), after = observation(current);
  if (!before || !after || before.terms !== after.terms) return null;
  return summarizeProductBestRateSeries([previous.core.run_date, current.core.run_date], [before.rate, after.rate]);
}
