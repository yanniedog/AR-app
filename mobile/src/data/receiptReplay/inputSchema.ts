import type { ReplayItem } from './types';

export type ReplayInputControl = 'number' | 'identifier' | 'phase' | 'coverage' |
  'factState' | 'provenance' | 'cleared' | 'factType' | 'unit' | 'review';

/** Local input roles, not admission or a renderer for arbitrary receipt strings. */
export function replayInputControl(kind: ReplayItem['kind'], path: readonly string[], factType?: unknown): ReplayInputControl {
  const key = path.map(part => /^\d+$/.test(part) ? '[]' : part).join('.');
  if (kind === 'mortgage_calculation') {
    switch (key) {
      case 'accountId': case 'offerId': case 'sourceVersion': case 'snapshotId':
      case 'confirmedAt': case 'payments.[].id': case 'payments.[].accountId':
      case 'payments.[].obligationId': case 'feeSettlements.[].occurrenceId':
      case 'feeSettlements.[].externalAccountId': case 'externalAccounts.[].role':
      case 'externalAccounts.[].accountId': case 'customerFacts.[].field': return 'identifier';
      case 'from': case 'toExclusive': case 'originalAnchor': case 'confirmedAnnualRate':
      case 'openingOutstanding': case 'obligationAmount': case 'openingComponents.principal':
      case 'openingComponents.postedInterest': case 'openingComponents.accruedInterest':
      case 'openingComponents.capitalizedCharges': case 'openingComponents.otherDebt':
      case 'payments.[].date': case 'payments.[].order': case 'payments.[].amount':
      case 'feeSettlements.[].amount': case 'feeSettlements.[].date': return 'number';
      case 'payments.[].phase': return 'phase';
      case 'executionCoverage': return 'coverage';
      case 'customerFacts.[].state': return 'factState';
      case 'provenance': return 'provenance';
      case 'payments.[].status': case 'feeSettlements.[].status': return 'cleared';
      case 'customerFacts.[].value.type': return 'factType';
      case 'customerFacts.[].value.unit': return 'unit';
      case 'customerFacts.[].value.value':
        return factType === 'decimal' || factType === 'date' ? 'number' : factType === 'text' ? 'identifier' : 'review';
      default: return 'review';
    }
  }
  // These identifiers belong to the existing savings/account schema; enum keys
  // are deliberately absent. Activity records have their own typed editor.
  switch (key) {
    case 'accountId': case 'confirmedAt':
    case 'confirmedAnnualRates.[].intervalId': case 'confirmedAnnualRates.[].tierId':
    case 'confirmedBonusAnnualRates.[].componentId': case 'confirmedBonusAnnualRates.[].tierId': return 'identifier';
    default: return 'review';
  }
}
