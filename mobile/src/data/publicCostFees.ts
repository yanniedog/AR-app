import type { PublicCostFee } from './publicCostModel';
import type { PublicProgramme } from './publicRateModel';

export interface PublicFeeContext {
  operation: 'existing' | 'new' | 'switch_from';
  /** Explicit public events or local scenario assumptions; absent events remain unknown. */
  events?: string[];
  switchingCostsKnown: boolean;
  offsetTermsKnown: boolean;
}
/** Product fees alone cannot certify all switching, government or offset costs. */
export function publicProgrammeCostFees(programme: PublicProgramme, context: PublicFeeContext) {
  const fees: PublicCostFee[] = [], reasonCodes = [...(programme.feeCoverage?.reasonCodes ?? [])];
  let feesKnown = programme.feeCoverage?.status === 'complete';
  if (!feesKnown) reasonCodes.push('material_fee_coverage_unknown');
  for (const fee of programme.fees ?? []) {
    if (fee.scopeId !== programme.productId && fee.scopeId !== programme.offerId) { feesKnown = false; reasonCodes.push('fee_scope_mismatch'); continue; }
    if (context.operation === 'existing' && fee.role === 'upfront' || context.operation !== 'switch_from' && fee.role === 'switching') continue;
    if (fee.role === 'event' && !context.events?.includes(fee.event ?? '')) { feesKnown = false; reasonCodes.push('fee_event_applicability_unknown'); continue; }
    const recurring = fee.role === 'recurring' || fee.role === 'package';
    if (recurring && fee.frequencyMonths === undefined || fee.amount === undefined || fee.currency !== undefined && fee.currency !== 'AUD') { feesKnown = false; reasonCodes.push('fee_structure_unresolved'); }
    fees.push({ feeId: fee.feeId, kind: fee.role === 'cashback' ? 'cashback' : recurring ? 'recurring' : fee.role === 'switching' ? 'switching' : 'upfront',
      ...(fee.amount !== undefined ? { amount: fee.amount } : {}), ...(fee.frequencyMonths !== undefined ? { everyMonths: fee.frequencyMonths } : {}),
      atMonth: 0, funding: 'cash', conditions: fee.conditions, evidenceIds: fee.evidenceIds, origin: 'public' });
  }
  if (context.operation !== 'existing' && !context.switchingCostsKnown) { feesKnown = false; reasonCodes.push('switching_costs_unknown'); }
  if (!context.offsetTermsKnown) { feesKnown = false; reasonCodes.push('offset_terms_unknown'); }
  return { fees, feesKnown, reasonCodes: [...new Set(reasonCodes)], assumptions: ['Recurring fees are charged at the start of each published frequency interval.'] };
}
