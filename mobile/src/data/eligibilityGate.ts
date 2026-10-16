import type { RateRow } from '../types';
import type { MandatoryEligibility } from './mandatoryEligibility';
import { profileFilterRows } from './profile';

let selection: MandatoryEligibility | null = null;
let revision = 0;
const listeners = new Set<() => void>();

/** Installed synchronously from the store; never persisted or used as source evidence. */
export function installMandatoryEligibility(next: MandatoryEligibility): void {
  selection = next; revision += 1;
  for (const listener of listeners) listener();
}
export const getMandatoryEligibilityRevision = () => revision;
export const hasMandatoryRequirements = () => selection?.active === true;
export const isMandatoryEligibilityReady = () => selection?.loading !== true;
export function subscribeMandatoryEligibility(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function mandatoryProductAllowed(productKey: string): boolean {
  return !selection?.active || selection.productKeys.has(productKey);
}
export function mandatoryEligibleRows(rows: RateRow[]): RateRow[] {
  if (!selection?.active) return rows;
  const required = selection;
  return rows.filter(row => {
    if (required.rows.has(row)) return true;
    if (required.loading) return false;
    // Public resolver rows are copies or newly resolved offers. Reapply the
    // retained mandatory requirements, including feature evidence, to each.
    if (!row.public_programme_id || !row.public_offer_id || !required.profile) return false;
    const section = row.category === 'RESIDENTIAL_MORTGAGES' ? 'Mortgage'
      : row.category === 'TERM_DEPOSITS' ? 'TD' : row.category === 'TRANS_AND_SAVINGS_ACCOUNTS' ? 'Savings' : undefined;
    return section != null && profileFilterRows([row], required.profile, section, required.verifiedProducts).length === 1;
  });
}
