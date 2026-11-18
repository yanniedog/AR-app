import type { InputProvenance } from './customerProfile';

export function userProvenance(productKey: string | null = null): InputProvenance {
  return { source: 'user_input', recordedAt: new Date().toISOString(), productKey, effectiveFrom: null, effectiveToExclusive: null };
}
