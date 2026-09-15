import { utf8ToBytes } from '@noble/hashes/utils';
import type { CustomerProfile } from '../customerProfile';
import { instantiateMortgagePeriod } from '../mortgageContracts/adapter';
import type { MortgageInputs } from '../mortgageContracts/types';
import type { MortgageContext, MortgageSelection, MortgageTarget } from '../mortgageContracts/transport';
import { Decimal } from '../../lib/productTermsEngine/decimal';
import { dayNumber } from '../../lib/productTermsEngine/calendar';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { comparePortfolios } from '../../lib/productTermsEngine/portfolioComparison';
import type { PortfolioInput, PortfolioFrame } from '../../lib/productTermsEngine/portfolioTypes';
import { EVALUATOR_VERSION } from '../../lib/productTermsEngine/types';

export interface MortgageAlternative { id: string; selection: MortgageSelection; target: MortgageTarget; inputs: MortgageInputs }
export interface MortgageComparisonDraft {
  startDate: string; endDateExclusive: string; timezone: PortfolioFrame['timezone']; metric: PortfolioFrame['metric'];
  referenceId: string; independentLoansConfirmed: boolean; alternatives: MortgageAlternative[];
}
/** A loan-only historical frame. It does not supply household or switching authority. */
export function compareMortgagePeriods(context: MortgageContext, profile: CustomerProfile, draft: MortgageComparisonDraft) {
  if (!draft || Object.keys(draft).sort().join(',') !== 'alternatives,endDateExclusive,independentLoansConfirmed,metric,referenceId,startDate,timezone' ||
      draft.independentLoansConfirmed !== true || !Array.isArray(draft.alternatives) || draft.alternatives.length !== 2 ||
      !['Australia/Sydney', 'Australia/Hobart'].includes(draft.timezone) || !['terminal_net_worth', 'net_interest_fee_cost'].includes(draft.metric)) throw Error('Confirm two independent historical loan periods.');
  const days = dayNumber(draft.endDateExclusive) - dayNumber(draft.startDate);
  if (days < 1 || days > 366) throw Error('Choose a common completed period of at most 366 days.');
  let timing: string | undefined;
  const children: ReturnType<typeof instantiateMortgagePeriod>['adapterInputs'][] = [];
  const alternatives = draft.alternatives.map(a => {
    if (!a || Object.keys(a).sort().join(',') !== 'id,inputs,selection,target') throw Error('Choose a reviewed scope for each loan.');
    if (a.inputs.from !== draft.startDate || a.inputs.toExclusive !== draft.endDateExclusive ||
        a.selection.subject.authorityGraph.completedPeriod.timezone !== draft.timezone) throw Error('Loan periods and timezones must match.');
    const i = instantiateMortgagePeriod(a.selection, context, a.target, a.inputs, profile);
    const schedule = canonical([...a.inputs.payments].sort((x, y) => x.id.localeCompare(y.id)).map(e => ({ id: e.id, date: e.date, phase: e.phase, order: e.order, amount: Decimal.parse(e.amount).fixed() })));
    if (timing !== undefined && timing !== schedule) throw Error('Confirmed payment dates, amounts and timing must match; do not change statement facts to compare.');
    timing = schedule; children.push(i.adapterInputs);
    const input: PortfolioInput = { schemaVersion: 1, frame: { id: a.id, currency: 'AUD', startDate: draft.startDate, endDateExclusive: draft.endDateExclusive,
      timezone: draft.timezone, metric: draft.metric, settlement: 'same_civil_day', valuation: 'holding_with_accrued_interest',
      openingNetWorth: Decimal.parse('0').sub(Decimal.parse(i.scenario.openingBalance)).fixed(12),
      scopeCoverage: 'reviewed_complete', externalFeeFunding: 'outside_frame_cost_adjustment', allowConditional: false,
      // Loan repayments are positive contributions. External fees are already
      // counted by PortfolioAccounting and must not be added here a second time.
      externalFlows: a.inputs.payments.map(e => ({ id: e.id, date: e.date, delta: Decimal.parse(e.amount).fixed() })) },
      accounts: [{ id: a.inputs.accountId, timezone: draft.timezone, contract: i.contract, scenario: i.scenario }],
      transfers: [], dependencyGraph: [], dependencyIds: [...new Set(i.contract.dependencyIds)] };
    return { id: a.id, input };
  });
  const comparisonInput = { schemaVersion: 1 as const, referenceId: draft.referenceId, alternatives };
  const comparisonInputs = { evaluatorVersion: EVALUATOR_VERSION, independentLoansConfirmed: true, profileRevision: profile.revision, children, comparisonInput };
  if (utf8ToBytes(canonical(comparisonInputs)).length > 4 * 1024 * 1024) throw Error('Mortgage comparison input limit.');
  const result = { schemaVersion: 1, kind: 'historical_mortgage_comparison', basis: 'Confirmed historical loan-only periods before tax, with equal opening debt and external payments. Not a forecast, refinancing recommendation or bank approval.',
    inputSha256: hashText(canonical(comparisonInputs)), comparisonInputs, receipt: comparePortfolios(comparisonInput) };
  if (utf8ToBytes(canonical(result)).length > 8 * 1024 * 1024) throw Error('Mortgage comparison receipt limit.');
  return result;
}
