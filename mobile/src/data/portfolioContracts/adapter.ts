import { utf8ToBytes } from '@noble/hashes/utils';
import type { CustomerProfile } from '../customerProfile';
import { instantiateSavingsPeriod } from '../monetaryContracts/adapter';
import type { SavingsPeriodInputs } from '../monetaryContracts/facts';
import type { SavingsContext, SavingsSelection, SavingsTarget } from '../monetaryContracts/transport';
import { Decimal } from '../../lib/productTermsEngine/decimal';
import { dayNumber } from '../../lib/productTermsEngine/calendar';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { comparePortfolios } from '../../lib/productTermsEngine/portfolioComparison';
import type { PortfolioInput, PortfolioFrame } from '../../lib/productTermsEngine/portfolioTypes';
import { EVALUATOR_VERSION } from '../../lib/productTermsEngine/types';

export interface SavingsHolding { selection: SavingsSelection; target: SavingsTarget; inputs: SavingsPeriodInputs }
export interface HoldingsDraft {
  startDate: string; endDateExclusive: string; timezone: PortfolioFrame['timezone']; metric: PortfolioFrame['metric'];
  referenceId: string; independentHoldingsConfirmed: boolean;
  alternatives: { id: string; accounts: SavingsHolding[] }[];
}
/** Only independently approved, movement-free historical savings holdings. Drafts remain local. */
export function compareSavingsHoldings(context: SavingsContext, profile: CustomerProfile, draft: HoldingsDraft) {
  if (Object.keys(draft).sort().join(',') !== 'alternatives,endDateExclusive,independentHoldingsConfirmed,metric,referenceId,startDate,timezone' ||
      draft.independentHoldingsConfirmed !== true || !['Australia/Sydney', 'Australia/Hobart'].includes(draft.timezone) ||
      !['terminal_net_worth', 'net_interest_fee_cost'].includes(draft.metric) || draft.alternatives.length !== 2) throw new Error('Confirm two independent historical holding sets.');
  const days = dayNumber(draft.endDateExclusive) - dayNumber(draft.startDate);
  if (days < 1 || days > 366) throw new Error('Choose a common completed period of at most 366 days.');
  const children: ReturnType<typeof instantiateSavingsPeriod>['adapterInputs'][][] = [];
  const alternatives = draft.alternatives.map(a => {
    if (!a.accounts.length || a.accounts.length > 4 || Object.keys(a).sort().join(',') !== 'accounts,id') throw new Error('Use one to four accounts per holding set.');
    const ids = new Set<string>();
    const instances = a.accounts.map(h => {
      if (Object.keys(h).sort().join(',') !== 'inputs,selection,target' || ids.has(h.inputs.accountId)) throw new Error('Each account needs a distinct local reference.');
      ids.add(h.inputs.accountId);
      const p = h.selection.subject.policy;
      if (p.linkedAccounts !== 'none_source_declared' || p.offset !== 'none_source_declared' || p.externalMovements !== 'none_user_confirmed' ||
          p.fees.coverage !== 'reviewed_complete_no_fees' || p.fees.deferredObligations !== 'none_source_declared' || p.fees.inventory.some(f => f.state !== 'none_applicable')) throw new Error('Linked movements or fee obligations are not supported.');
      if (h.inputs.startDate !== draft.startDate || h.inputs.endDateExclusive !== draft.endDateExclusive) throw new Error('All accounts must use the same period.');
      if (h.selection.subject.authorityGraph.completedPeriod.timezone !== draft.timezone) throw new Error('The reviewed timezones must match.');
      return instantiateSavingsPeriod(h.selection, context, h.target, h.inputs, profile);
    });
    children.push(instances.map(i => i.adapterInputs));
    const opening = instances.reduce((n, i) => n.add(Decimal.parse(i.scenario.openingBalance)), Decimal.parse('0'));
    const input: PortfolioInput = { schemaVersion: 1, frame: { id: a.id, currency: 'AUD', startDate: draft.startDate, endDateExclusive: draft.endDateExclusive,
      timezone: draft.timezone, metric: draft.metric, settlement: 'same_civil_day', valuation: 'holding_with_accrued_interest', openingNetWorth: opening.fixed(),
      // Coverage is this selected independent set, supported by the admitted child policies and local confirmation.
      scopeCoverage: 'reviewed_complete', externalFlows: [], externalFeeFunding: 'outside_frame_cost_adjustment', allowConditional: false },
      accounts: instances.map((i, n) => ({ id: a.accounts[n].inputs.accountId, timezone: draft.timezone, contract: i.contract, scenario: i.scenario })),
      transfers: [], dependencyGraph: [], dependencyIds: [...new Set(instances.flatMap(i => i.contract.dependencyIds))] };
    return { id: a.id, input };
  });
  const comparisonInput = { schemaVersion: 1 as const, referenceId: draft.referenceId, alternatives };
  const preimage = { evaluatorVersion: EVALUATOR_VERSION, independentHoldingsConfirmed: true, profileRevision: profile.revision, children, comparisonInput };
  if (utf8ToBytes(canonical(preimage)).length > 4 * 1024 * 1024) throw new Error('Holding inputs exceed the comparison limit.');
  const result = { schemaVersion: 1, kind: 'historical_savings_holdings', basis: 'User-reported independent historical holdings before tax; not a forecast or bank approval.',
    inputSha256: hashText(canonical(preimage)), comparisonInputs: preimage, receipt: comparePortfolios(comparisonInput) };
  if (utf8ToBytes(canonical(result)).length > 8 * 1024 * 1024) throw new Error('Holding receipt exceeds the comparison limit.');
  return result;
}
