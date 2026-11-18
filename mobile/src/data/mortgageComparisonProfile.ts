import { Platform } from 'react-native';
import { create } from 'zustand';

import { loadCustomerProfile, subscribeCustomerProfile, updateCustomerProfile } from './customerProfileStorage';
import { applyComparisonInputs, comparisonInputs } from './customerInputState';
import { setMortgageComparisonInputs, useMortgageComparison, type MortgageComparisonInputs } from './mortgageComparison';
import { updateRatesSection } from './ratesSession';
import { currencyAmount } from './currencyInput';
import { Decimal } from '../lib/productTermsEngine/decimal';

export type MortgageComparisonFacets = { loanPurposes: string[]; repaymentTypes: string[] };
type ComparisonProfile = { inputs: MortgageComparisonInputs; facets: MortgageComparisonFacets };
type StorageStatus = 'loading' | 'saving' | 'saved' | 'unavailable' | 'memory-only';
type InputChanges = Partial<Record<keyof MortgageComparisonInputs, { value: string | undefined }>>;
const inputKeys: (keyof MortgageComparisonInputs)[] = ['loanAmount', 'lvr', 'lvrMode', 'fundsAvailable', 'fundsType', 'propertyValue'];

const emptyProfile: ComparisonProfile = {
  inputs: { loanAmount: '', lvr: '' },
  facets: { loanPurposes: [], repaymentTypes: [] },
};

export const useMortgageComparisonProfile = create<{ status: StorageStatus; profile: ComparisonProfile }>(() => ({
  status: Platform.OS === 'web' ? 'memory-only' : 'loading',
  profile: emptyProfile,
}));

let committed: ComparisonProfile | null = null;
let pending: Partial<ComparisonProfile> & { clearScope?: boolean; changes?: InputChanges } = {};
let work: Promise<void> | null = null;

function publishProfile(): void {
  const profile = { inputs: pending.inputs ?? (committed ?? emptyProfile).inputs, facets: pending.facets ?? (committed ?? emptyProfile).facets };
  if (pending.clearScope) profile.inputs = { ...profile.inputs, lvr: '' };
  useMortgageComparisonProfile.setState({ profile });
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

function applyFacets(facets: MortgageComparisonFacets) {
  updateRatesSection('Mortgage', current => ({ filters: { ...current.filters, ...facets } }), true);
}
subscribeCustomerProfile(profile => {
  if (!profile.inputState) return;
  const previousFacets = committed?.facets;
  committed = { inputs: comparisonInputs(profile.inputState), facets: profile.inputState.comparison.facets };
  if (!pending.inputs) setMortgageComparisonInputs(committed.inputs);
  if (!pending.facets && previousFacets && JSON.stringify(previousFacets) !== JSON.stringify(committed.facets)) applyFacets(committed.facets);
  publishProfile();
});

/** Read the saved comparison before initializing the Rates session. A failed
 * encrypted read is retryable and must never be treated as an empty record. */
export function openMortgageComparisonProfile(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  if (work) return work;
  work = Promise.resolve().then(async () => {
    if (!committed) {
      useMortgageComparisonProfile.setState({ status: 'loading' });
      const profile = await loadCustomerProfile();
      committed = { inputs: comparisonInputs(profile.inputState!), facets: profile.inputState!.comparison.facets };
      if (pending.inputs == null) setMortgageComparisonInputs(committed.inputs);
      if (pending.facets == null && (committed.facets.loanPurposes.length || committed.facets.repaymentTypes.length)) applyFacets(committed.facets);
      committed ??= emptyProfile;
      publishProfile();
    }
    while (pending.inputs || pending.facets || pending.clearScope) {
      useMortgageComparisonProfile.setState({ status: 'saving' });
      const submitted = pending;
      const saved = await updateCustomerProfile(profile => {
        const changed = Object.fromEntries(Object.entries(submitted.changes ?? {}).map(([key, change]) => [key, change!.value])) as Partial<MortgageComparisonInputs>;
        const latest = comparisonInputs(profile.inputState!);
        const nextInputs = { ...latest, ...changed };
        const fundsTypeEdit = nextInputs.lvrMode === 'funds' && Object.hasOwn(changed, 'fundsType') && changed.fundsType !== undefined;
        const transferFunds = fundsTypeEdit && !!nextInputs.fundsAvailable?.trim();
        // A deposit view hides property value. Switching back to offset must
        // retain the saved property rather than replacing that hidden field.
        if (fundsTypeEdit && nextInputs.fundsType === 'offset' && nextInputs.propertyValue === undefined) nextInputs.propertyValue = profile.inputState!.scenario.mortgage.propertyValue;
        const financialEdit = transferFunds || (['loanAmount', 'propertyValue', 'fundsAvailable'] as const).some(key => Object.hasOwn(changed, key) && changed[key] !== undefined);
        const inputState = financialEdit ? applyComparisonInputs(profile.inputState!, nextInputs) : {
          ...profile.inputState!, comparison: { ...profile.inputState!.comparison,
            ...(Object.hasOwn(changed, 'lvr') ? { lvr: changed.lvr! } : {}),
            ...(Object.hasOwn(changed, 'lvrMode') ? { lvrMode: changed.lvrMode } : {}),
            ...(Object.hasOwn(changed, 'fundsType') ? { fundsType: changed.fundsType } : {}),
          },
        };
        // Property/offset edits do not change a deliberately selected buying mode.
        if (financialEdit && !Object.hasOwn(changed, 'loanAmount')) {
          inputState.scenario.mortgage.mode = profile.inputState!.scenario.mortgage.mode;
          if (inputState.scenario.mortgage.mode === 'buy' && inputState.comparison.fundsType === 'deposit' && (transferFunds || Object.hasOwn(changed, 'fundsAvailable'))) {
            const net = currencyAmount(nextInputs.fundsAvailable ?? ''), costs = currencyAmount(profile.inputState!.scenario.mortgage.costs || '0');
            try { if (net && costs) inputState.scenario.mortgage.deposit = Decimal.parse(net).add(Decimal.parse(costs)).fixed(2); }
            catch { /* Retain the invalid draft; financial validation remains unresolved. */ }
          }
        }
        return { ...profile, inputState: { ...inputState, comparison: { ...inputState.comparison, ...(submitted.facets ? { facets: submitted.facets } : {}), ...(submitted.clearScope ? { lvr: '' } : {}) } } };
      });
      committed = { inputs: comparisonInputs(saved.inputState!), facets: saved.inputState!.comparison.facets };
      const remainingChanges = Object.fromEntries(Object.entries(pending.changes ?? {}).filter(([key, change]) => change !== submitted.changes?.[key as keyof MortgageComparisonInputs])) as InputChanges;
      pending = {
        ...(pending.inputs !== submitted.inputs ? { inputs: pending.inputs } : {}),
        ...(Object.keys(remainingChanges).length ? { changes: remainingChanges } : {}),
        ...(pending.facets !== submitted.facets ? { facets: pending.facets } : {}),
        ...(pending.clearScope !== submitted.clearScope ? { clearScope: pending.clearScope } : {}),
      };
    }
    publishProfile();
    useMortgageComparisonProfile.setState({ status: 'saved' });
  }).catch(() => {
    useMortgageComparisonProfile.setState({ status: 'unavailable' });
  }).finally(() => {
    work = null;
    if ((pending.inputs || pending.facets || pending.clearScope) && useMortgageComparisonProfile.getState().status !== 'unavailable') {
      void openMortgageComparisonProfile();
    }
  });
  return work;
}

export function saveMortgageComparisonInputs(value: MortgageComparisonInputs): void {
  const inputs = normalizeInputs(value);
  const previous = useMortgageComparison.getState();
  setMortgageComparisonInputs(inputs);
  if (Platform.OS === 'web') {
    committed = { ...(committed ?? emptyProfile), inputs };
    publishProfile();
    return;
  }
  const changes: InputChanges = { ...pending.changes };
  for (const key of inputKeys) if (inputs[key] !== previous[key]) changes[key] = { value: inputs[key] };
  pending = { ...pending, inputs, changes, ...(inputs.lvr !== previous.lvr ? { clearScope: false } : {}) };
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

export function clearSavedMortgageComparison({ preserveFacets = false }: { preserveFacets?: boolean } = {}): void {
  // Clearing Rates filters must never delete the user's loan details.
  const inputs = { ...useMortgageComparison.getState(), lvr: '' };
  setMortgageComparisonInputs(inputs);
  const facets = preserveFacets ? (pending.facets ?? committed?.facets ?? emptyProfile.facets) : emptyProfile.facets;
  if (!preserveFacets) applyFacets(facets);
  if (Platform.OS === 'web') {
    committed = { inputs, facets };
    publishProfile();
    return;
  }
  // Clear scope metadata only. Reapplying a comparison would turn a saved
  // buying scenario into refinancing and can replace newer task edits.
  pending = { ...pending, ...(pending.inputs ? { inputs: { ...pending.inputs, lvr: '' } } : {}),
    ...(preserveFacets ? {} : { facets }), clearScope: true };
  publishProfile();
  void openMortgageComparisonProfile();
}

/** Recover saved defaults after a temporary Rates route or view changed its scope. */
export function restoreSavedMortgageComparison(): void {
  const profile = { ...(committed ?? emptyProfile), ...pending };
  setMortgageComparisonInputs(profile.inputs);
  applyFacets(profile.facets);
}

export function resetMortgageComparisonProfileForTests(): void {
  committed = null; pending = {}; work = null;
  setMortgageComparisonInputs(emptyProfile.inputs);
  useMortgageComparisonProfile.setState({ status: 'loading', profile: emptyProfile });
}
