import type { CorePayload, ProductDetail, RateRow, SectionKey } from '../types';
import { SECTION_KEYS } from '../types';
import { bankRateScope, type BankRateScope } from './bankRateOverview';
import { visibleAccountRows } from './format';
import { profileFilterRows, type ProfileFilters } from './profile';
import { getMandatoryEligibilityRevision } from './eligibilityGate';
import { getSuitabilityRevision } from './suitabilityGate';

export interface BankRateHistoryScopeInput {
  core: CorePayload;
  details: Record<string, ProductDetail> | null | undefined;
  includeNonStandard: boolean;
  interests: SectionKey[];
  profileFilters: ProfileFilters;
  suitabilityRevision: number;
  mandatoryRevision: number;
}

// Publications/preferences are immutable. Share the latest projection across
// product/lender/chart mounts without retaining obsolete catalogues.
interface ScopeWork {
  latest?: { input: BankRateHistoryScopeInput; scope: BankRateScope; gateRevision: number };
  activeInput?: BankRateHistoryScopeInput;
  generation: number;
  pending?: { input: BankRateHistoryScopeInput; work: Promise<BankRateScope | null>; signal?: AbortSignal };
}
const shared: ScopeWork = { generation: 0 };
// A scoped product can mount over Market or another product in the native stack.
// Keep its work independent so it cannot cancel the other screen’s projection.
const mortgageScopes = new WeakMap<BankRateHistoryScopeInput, ScopeWork>();
function scopeWork(input: BankRateHistoryScopeInput): ScopeWork {
  if (input.interests.length !== 1 || input.interests[0] !== 'Mortgage') return shared;
  const work = mortgageScopes.get(input) ?? { generation: 0 };
  mortgageScopes.set(input, work);
  return work;
}

function sameInput(left: BankRateHistoryScopeInput | null | undefined, right: BankRateHistoryScopeInput): boolean {
  return !!left && left.core === right.core && left.details === right.details &&
    left.includeNonStandard === right.includeNonStandard && left.interests === right.interests &&
    left.profileFilters === right.profileFilters &&
    left.suitabilityRevision === right.suitabilityRevision && left.mandatoryRevision === right.mandatoryRevision;
}

function scopedRows(input: BankRateHistoryScopeInput, section: SectionKey, rows: RateRow[]): RateRow[] {
  return profileFilterRows(visibleAccountRows(rows, input.includeNonStandard, input.details),
    input.profileFilters, section, input.details);
}

/** Synchronous only for small catalogues and deterministic tooling. */
export function sharedBankRateHistoryScope(input: BankRateHistoryScopeInput): BankRateScope {
  const state = scopeWork(input);
  if (sameInput(state.latest?.input, input) && state.latest!.gateRevision === getSuitabilityRevision()) return state.latest!.scope;
  const rows = Object.fromEntries(SECTION_KEYS.map(section => [section,
    input.interests.includes(section) ? scopedRows(input, section, input.core.sections[section].rates) : [],
  ])) as Record<SectionKey, RateRow[]>;
  const scope = bankRateScope(rows);
  state.latest = { input, scope, gateRevision: getSuitabilityRevision() };
  return scope;
}

/** A render may look up prepared work, but never scan a full catalogue. */
export function cachedBankRateHistoryScope(input: BankRateHistoryScopeInput): BankRateScope | null {
  if (getMandatoryEligibilityRevision() !== input.mandatoryRevision) return null;
  const state = scopeWork(input);
  if (sameInput(state.latest?.input, input) && state.latest!.gateRevision === getSuitabilityRevision()) return state.latest!.scope;
  const count = input.interests.reduce((total, section) => total + input.core.sections[section].rates.length, 0);
  return count <= 64 ? sharedBankRateHistoryScope(input) : null;
}

/** Deduplicate concurrent consumers; changed publications/profile gates cancel
 * old work before it can cache a mixed selection or replace the active scope. */
export function prepareBankRateHistoryScope(
  input: BankRateHistoryScopeInput,
  yieldControl: () => Promise<void>,
  signal?: AbortSignal,
): Promise<BankRateScope | null> {
  // Only committed consumers may supersede work. A speculative render's cache
  // lookup must not strand a mounted consumer whose request is still current.
  const state = scopeWork(input);
  if (!sameInput(state.activeInput, input)) { state.activeInput = input; state.generation++; }
  const currentGeneration = state.generation;
  const cached = cachedBankRateHistoryScope(input);
  if (cached) return Promise.resolve(cached);
  if (state.pending && sameInput(state.pending.input, input) && state.pending.signal === signal) return state.pending.work;
  const gateRevision = getSuitabilityRevision();
  const isCurrent = () => !signal?.aborted && state.generation === currentGeneration &&
    getSuitabilityRevision() === gateRevision && getMandatoryEligibilityRevision() === input.mandatoryRevision;
  const work = (async () => {
    // Start after the mounting render/paint, then bound each synchronous slice.
    await yieldControl();
    const rows: Record<SectionKey, RateRow[]> = { Mortgage: [], Savings: [], TD: [] };
    let sliceStarted = performance.now();
    for (const section of input.interests) {
      const source = input.core.sections[section].rates;
      for (let offset = 0; offset < source.length; offset += 32) {
        if (!isCurrent()) return null;
        rows[section].push(...scopedRows(input, section, source.slice(offset, offset + 32)));
        if (performance.now() - sliceStarted >= 4) {
          await yieldControl();
          sliceStarted = performance.now();
        }
      }
    }
    if (!isCurrent()) return null;
    const scope = bankRateScope(rows);
    state.latest = { input, scope, gateRevision };
    return scope;
  })();
  state.pending = { input, work, signal };
  void work.finally(() => { if (state.pending?.work === work) state.pending = undefined; }).catch(() => undefined);
  return work;
}
