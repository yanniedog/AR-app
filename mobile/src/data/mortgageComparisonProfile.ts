import { Platform } from 'react-native';
import { create } from 'zustand';

import { SECURE_STORE_KEYS } from '../lib/secureStoreKey';
import { readSecureStoreValue, writeSecureStoreValue } from '../lib/secureStoreValue';
import { setMortgageComparisonInputs, type MortgageComparisonInputs } from './mortgageComparison';
import { updateRatesSection } from './ratesSession';

export type MortgageComparisonFacets = { loanPurposes: string[]; repaymentTypes: string[] };
type ComparisonProfile = { inputs: MortgageComparisonInputs; facets: MortgageComparisonFacets };
type StorageStatus = 'loading' | 'saving' | 'saved' | 'unavailable' | 'memory-only';

const storageKey = SECURE_STORE_KEYS.mortgageComparisonProfile;
const emptyProfile: ComparisonProfile = {
  inputs: { loanAmount: '', lvr: '' },
  facets: { loanPurposes: [], repaymentTypes: [] },
};

export const useMortgageComparisonProfile = create<{ status: StorageStatus; profile: ComparisonProfile }>(() => ({
  status: Platform.OS === 'web' ? 'memory-only' : 'loading',
  profile: emptyProfile,
}));

let committed: ComparisonProfile | null = null;
let pending: Partial<ComparisonProfile> = {};
let replaceUnreadable = false;
let work: Promise<void> | null = null;

function publishProfile(): void {
  useMortgageComparisonProfile.setState({ profile: { ...(committed ?? emptyProfile), ...pending } });
}

function inputText(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 64) : '';
}

function normalizeInputs(value: Partial<MortgageComparisonInputs>): MortgageComparisonInputs {
  return {
    loanAmount: inputText(value.loanAmount),
    lvr: inputText(value.lvr),
    ...(value.lvrMode === 'lvr' || value.lvrMode === 'funds' ? { lvrMode: value.lvrMode } : {}),
    ...(typeof value.fundsAvailable === 'string' ? { fundsAvailable: inputText(value.fundsAvailable) } : {}),
    ...(value.fundsType === 'deposit' || value.fundsType === 'offset' ? { fundsType: value.fundsType } : {}),
    ...(typeof value.propertyValue === 'string' ? { propertyValue: inputText(value.propertyValue) } : {}),
  };
}

function normalizeFacet(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))]
    : [];
}

function normalizeFacets(value: Partial<MortgageComparisonFacets>): MortgageComparisonFacets {
  return { loanPurposes: normalizeFacet(value.loanPurposes), repaymentTypes: normalizeFacet(value.repaymentTypes) };
}

function readProfile(text: string): ComparisonProfile {
  const value = JSON.parse(text) as { version?: number; inputs?: Partial<MortgageComparisonInputs>; facets?: Partial<MortgageComparisonFacets> } | null;
  if (value?.version !== 1 || !value.inputs || !value.facets
    || typeof value.inputs.loanAmount !== 'string' || typeof value.inputs.lvr !== 'string'
    || !Array.isArray(value.facets.loanPurposes) || !Array.isArray(value.facets.repaymentTypes)) {
    throw new Error('Invalid saved mortgage comparison');
  }
  return { inputs: normalizeInputs(value.inputs), facets: normalizeFacets(value.facets) };
}

function applyFacets(facets: MortgageComparisonFacets) {
  updateRatesSection('Mortgage', current => ({ filters: { ...current.filters, ...facets } }), true);
}

/** Read the saved comparison before initializing the Rates session. A failed
 * encrypted read is retryable and must never be treated as an empty record. */
export function openMortgageComparisonProfile(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  if (work) return work;
  work = Promise.resolve().then(async () => {
    if (!committed) {
      useMortgageComparisonProfile.setState({ status: 'loading' });
      if (!replaceUnreadable) {
        try {
          const raw = await readSecureStoreValue(storageKey, { preserveIncomplete: true });
          committed = raw == null ? emptyProfile : readProfile(raw);
          if (raw != null) {
            if (pending.inputs == null) setMortgageComparisonInputs(committed.inputs);
            if (pending.facets == null) applyFacets(committed.facets);
          }
        } catch (error) {
          // An explicit clear may arrive while the original read is in flight.
          if (!replaceUnreadable) throw error;
        }
      }
      committed ??= emptyProfile;
      publishProfile();
    }
    while (pending.inputs || pending.facets) {
      useMortgageComparisonProfile.setState({ status: 'saving' });
      const submitted = pending;
      const next: ComparisonProfile = { ...committed, ...submitted };
      await writeSecureStoreValue(storageKey, JSON.stringify({ version: 1, ...next }));
      committed = next;
      replaceUnreadable = false;
      pending = {
        ...(pending.inputs !== submitted.inputs ? { inputs: pending.inputs } : {}),
        ...(pending.facets !== submitted.facets ? { facets: pending.facets } : {}),
      };
    }
    useMortgageComparisonProfile.setState({ status: 'saved' });
  }).catch(() => {
    useMortgageComparisonProfile.setState({ status: 'unavailable' });
  }).finally(() => {
    work = null;
    if ((pending.inputs || pending.facets) && useMortgageComparisonProfile.getState().status !== 'unavailable') {
      void openMortgageComparisonProfile();
    }
  });
  return work;
}

export function saveMortgageComparisonInputs(value: MortgageComparisonInputs): void {
  const inputs = normalizeInputs(value);
  setMortgageComparisonInputs(inputs);
  if (Platform.OS === 'web') {
    committed = { ...(committed ?? emptyProfile), inputs };
    publishProfile();
    return;
  }
  pending = { ...pending, inputs };
  publishProfile();
  void openMortgageComparisonProfile();
}

export function saveMortgageComparisonFacets(value: MortgageComparisonFacets): void {
  const facets = normalizeFacets(value);
  applyFacets(facets);
  if (Platform.OS === 'web') {
    committed = { ...(committed ?? emptyProfile), facets };
    publishProfile();
    return;
  }
  pending = { ...pending, facets };
  publishProfile();
  void openMortgageComparisonProfile();
}

export function clearSavedMortgageComparison(): void {
  setMortgageComparisonInputs(emptyProfile.inputs);
  applyFacets(emptyProfile.facets);
  if (Platform.OS === 'web') {
    committed = emptyProfile;
    publishProfile();
    return;
  }
  replaceUnreadable = true;
  pending = { ...emptyProfile };
  publishProfile();
  void openMortgageComparisonProfile();
}

/** Recover saved defaults after a temporary Rates route or view changed its scope. */
export function restoreSavedMortgageComparison(): void {
  const profile = { ...(committed ?? emptyProfile), ...pending };
  setMortgageComparisonInputs(profile.inputs);
  applyFacets(profile.facets);
}
