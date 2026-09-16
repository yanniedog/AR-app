import type { RateRow } from '../types';
import type { MandatoryEligibility } from './mandatoryEligibility';

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
  return selection?.active ? rows.filter(row => selection!.rows.has(row)) : rows;
}
