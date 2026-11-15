import { createSelectionTransport } from '../contractsShared/monetarySelectionTransport';
import { detailsDisplayIdentity } from '../detailsCatalogue';
import type { EligibilityContext, EligibilityTarget } from '../eligibilityContracts/transport';
import { operationBudget } from '../monetaryContracts/validation';
import { assertActivityWire } from './schemaValidation';
import type { ActivityApproval, ActivitySubject } from './types';
import { validateActivityAsset } from './validation';

export type ActivityContext = EligibilityContext;
export type ActivityTarget = EligibilityTarget;
export interface ActivitySelection {
  readonly subject: ActivitySubject;
  readonly approval: ActivityApproval;
  readonly edition: string;
}

const transport = createSelectionTransport<ActivitySubject, ActivityApproval, ReturnType<typeof validateActivityAsset>>({
  label: 'Activity',
  section: 'Savings',
  namespaceVersion: 'v4',
  capability: 'savings_activity_calculation',
  useSnapshotBudget: true,
  extraCategoryCheck: target => {
    if (detailsDisplayIdentity(target.detail).productCategory !== 'TRANS_AND_SAVINGS_ACCOUNTS') {
      throw new Error('Activity product category unsupported');
    }
  },
  assertNamespaceWire: v => assertActivityWire(v, 'namespace'),
  assertEnvelopeWire: (v, kind) => assertActivityWire(v, kind),
  validateAsset: validateActivityAsset,
  checkOperationsBudget: operationBudget,
});

/** Only activity assets are fetched. Historical raw members remain producer-private. */
export const loadActivitySelections: (c: ActivityContext, target: ActivityTarget) => Promise<ActivitySelection[]> =
  transport.loadSelections;

export const assertActivitySelection = transport.assertSelection;
