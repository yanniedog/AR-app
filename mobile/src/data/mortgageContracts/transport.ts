import { Decimal } from '../../lib/productTermsEngine/decimal';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { createSelectionTransport } from '../contractsShared/monetarySelectionTransport';
import { detailsDisplayIdentity } from '../detailsCatalogue';
import type { EligibilityContext, EligibilityTarget } from '../eligibilityContracts/transport';
import { assertMonetaryWire } from '../monetaryContracts/schemaValidation';
import { assertMortgageWire } from './schemaValidation';
import type { MortgageApproval, MortgageSubject } from './types';
import { mortgageBudget, validateMortgageAsset } from './validation';

export type MortgageContext = EligibilityContext;
export type MortgageTarget = EligibilityTarget;
export interface MortgageSelection {
  readonly subject: MortgageSubject;
  readonly approval: MortgageApproval;
  readonly edition: string;
}

function targetMatches(s: MortgageSubject, c: MortgageContext, target: MortgageTarget) {
  if (s.target.kind !== target.kind) return false;
  if (s.target.kind === 'product') return true;
  if (target.kind !== 'rate_variant') return false;
  return (
    target.section === 'Mortgage' &&
    c.core!.sections.Mortgage.rates.indexOf(target.row) === s.target.coreRowIndex &&
    target.row.rate_index === s.target.rateIndex &&
    hashText(canonical(target.row)) === s.target.rowSha256 &&
    Decimal.parse(String(target.row.rate)).compare(Decimal.parse(s.target.annualRate)) === 0 &&
    Decimal.parse(s.target.annualRate).compare(Decimal.parse(s.policy.annualRate)) === 0
  );
}

const transport = createSelectionTransport<MortgageSubject, MortgageApproval, ReturnType<typeof validateMortgageAsset>>({
  label: 'Mortgage',
  section: 'Mortgage',
  namespaceVersion: 'v3',
  capability: 'mortgage_calculation',
  useSnapshotBudget: true,
  isValidCategory: target => detailsDisplayIdentity(target.detail).productCategory === 'RESIDENTIAL_MORTGAGES',
  assertNamespaceWire: v => assertMonetaryWire(v, 'namespace'),
  assertEnvelopeWire: (v, kind) => assertMortgageWire(v, kind),
  validateAsset: validateMortgageAsset,
  checkOperationsBudget: mortgageBudget,
  targetMatches,
});

/** Only mortgage assets are fetched. Historical raw members remain producer-private. */
export const loadMortgageSelections: (c: MortgageContext, target: MortgageTarget) => Promise<MortgageSelection[]> =
  transport.loadSelections;

export const assertMortgageSelection = transport.assertSelection;
