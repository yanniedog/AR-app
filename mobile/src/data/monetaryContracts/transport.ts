import { createSelectionTransport } from '../contractsShared/monetarySelectionTransport';
import type { EligibilityContext, EligibilityTarget } from '../eligibilityContracts/transport';
import { assertMonetaryWire } from './schemaValidation';
import type { SavingsApproval, SavingsSubject } from './types';
import { operationBudget, validateMonetaryAsset } from './validation';

export type SavingsContext = EligibilityContext;
export type SavingsTarget = EligibilityTarget;
export interface SavingsSelection {
  readonly subject: SavingsSubject;
  readonly approval: SavingsApproval;
  readonly edition: string;
}

const transport = createSelectionTransport<SavingsSubject, SavingsApproval, ReturnType<typeof validateMonetaryAsset>>({
  label: 'Savings',
  section: 'Savings',
  namespaceVersion: 'v3',
  capability: 'savings_calculation',
  assertEnvelopeWire: (v, kind) => assertMonetaryWire(v, kind),
  validateAsset: validateMonetaryAsset,
  checkOperationsBudget: operationBudget,
});

/** Only savings assets are fetched. Historical raw members remain producer-private. */
export const loadSavingsSelections: (c: SavingsContext, target: SavingsTarget) => Promise<SavingsSelection[]> =
  transport.loadSelections;

export const assertSavingsSelection = transport.assertSelection;
