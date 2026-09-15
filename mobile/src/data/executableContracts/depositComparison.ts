import type { CustomerProfile } from '../customerProfile';
import type { RateRow } from '../../types';
import { Decimal } from '../../lib/productTermsEngine/decimal';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { EVALUATOR_VERSION } from '../../lib/productTermsEngine/types';
import type { ApprovedSelection, ContractContext } from './transport';
import { calculateDeposit, type DepositInputs } from './instantiate';

export interface DepositAlternative { id: string; row: RateRow; selection: ApprovedSelection | null; inputs: DepositInputs }
export interface DepositComparisonResult {
  schemaVersion: 1; evaluatorVersion: typeof EVALUATOR_VERSION; inputSha256: string; referenceId: string;
  rankAvailable: boolean; reason: string; basis: string;
  results: { id: string; data: ReturnType<typeof calculateDeposit> | null; error: string | null; advantage: string | null; rank: number | null }[];
}
/** Only same-horizon, independently complete maturity returns are comparable here. No holding/reinvestment assumptions. */
export function compareDeposits(context: ContractContext, alternatives: DepositAlternative[], referenceId: string, profile: CustomerProfile): DepositComparisonResult {
  if (alternatives.length < 2 || alternatives.length > 4 || new Set(alternatives.map(a => a.id)).size !== alternatives.length || new Set(alternatives.map(a => a.row)).size !== alternatives.length || !alternatives.some(a => a.id === referenceId)) throw new Error('Choose two to four distinct rates and a reference.');
  const results: DepositComparisonResult['results'] = alternatives.map(a => {
    try {
      if (!a.selection) throw new Error('An approved calculation template is unavailable for this exact rate.');
      return { id: a.id, data: calculateDeposit(a.selection, context, a.row, a.inputs, profile), error: null, advantage: null, rank: null };
    } catch (error) { return { id: a.id, data: null, error: error instanceof Error ? error.message : 'Calculation unavailable.', advantage: null, rank: null }; }
  });
  const result: DepositComparisonResult = { schemaVersion: 1, evaluatorVersion: EVALUATOR_VERSION,
    inputSha256: hashText(canonical({ evaluatorVersion: EVALUATOR_VERSION, manifest: context.manifest, referenceId,
      alternatives: alternatives.map((a, i) => ({ id: a.id, row: a.row, inputs: a.inputs, templateId: a.selection?.template.id ?? null, calculation: results[i].data?.calculationInputs ?? null })) })),
    referenceId, rankAvailable: false, basis: 'Maturity return before tax; bank confirmation reported by you, not independently verified. No reinvestment or full-portfolio comparison.', reason: '', results };
  if (results.some(r => !r.data?.receipt.claimAvailable || !r.data.receipt.totals)) { result.reason = 'Ranking unavailable: every selected rate needs complete approved terms and confirmed inputs.'; return result; }
  const baseline = results.find(r => r.id === referenceId)!.data!;
  const frame = (data: NonNullable<typeof baseline>) => canonical({ principal: data.calculationInputs.scenario.openingBalance,
    fundedDate: data.calculationInputs.scenario.startDate, maturityDate: data.calculationInputs.contract.tdLifecycle!.nominalMaturityDate,
    currency: data.calculationInputs.contract.currency, withholding: data.calculationInputs.scenario.tdConfirmation!.noWithholding,
    feeScope: data.calculationInputs.contract.feeSchedule!.inventoryCoverage, taxBasis: 'before_tax' });
  if (results.some(r => frame(r.data!) !== frame(baseline))) { result.reason = 'Separate results only: amounts, funding dates, maturity dates or calculation scope differ. No holding-period return is assumed.'; return result; }
  const referencePayout = Decimal.parse(baseline.receipt.totals!.externalOutflows);
  for (const r of results) r.advantage = Decimal.parse(r.data!.receipt.totals!.externalOutflows).sub(referencePayout).fixed();
  for (const r of results) r.rank = 1 + results.filter(other => Decimal.parse(other.advantage!).compare(Decimal.parse(r.advantage!)) > 0).length;
  result.rankAvailable = true; result.reason = 'Ranked by before-tax maturity payout for the same amount and dates. Equal returns share a rank.';
  return result;
}
