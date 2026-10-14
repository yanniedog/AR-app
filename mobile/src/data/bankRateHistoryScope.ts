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
let latest: { input: BankRateHistoryScopeInput; scope: BankRateScope; gateRevision: number } | null = null;
let activeInput: BankRateHistoryScopeInput | null = null;
let generation = 0;
let pending: { input: BankRateHistoryScopeInput; work: Promise<BankRateScope | null> } | null = null;

function sameInput(left: BankRateHistoryScopeInput | null | undefined, right: BankRateHistoryScopeInput): boolean {
  return !!left && left.core === right.core && left.details === right.details &&
    left.includeNonStandard === right.includeNonStandard && left.interests === right.interests &&
    left.profileFilters === right.profileFilters &&
    left.suitabilityRevision === right.suitabilityRevision && left.mandatoryRevision === right.mandatoryRevision;
}

function activate(input: BankRateHistoryScopeInput): number {
  if (!sameInput(activeInput, input)) { activeInput = input; generation++; }
  return generation;
}

function scopedRows(input: BankRateHistoryScopeInput, section: SectionKey, rows: RateRow[]): RateRow[] {
  return profileFilterRows(visibleAccountRows(rows, input.includeNonStandard, input.details),
    input.profileFilters, section, input.details);
}

/** Synchronous only for small catalogues and deterministic tooling. */
export function sharedBankRateHistoryScope(input: BankRateHistoryScopeInput): BankRateScope {
  if (sameInput(latest?.input, input) && latest!.gateRevision === getSuitabilityRevision()) return latest!.scope;
  const rows = Object.fromEntries(SECTION_KEYS.map(section => [section,
    scopedRows(input, section, input.core.sections[section].rates),
  ])) as Record<SectionKey, RateRow[]>;
  const scope = bankRateScope(rows);
  latest = { input, scope, gateRevision: getSuitabilityRevision() };
  return scope;
}

/** A render may look up prepared work, but never scan a full catalogue. */
export function cachedBankRateHistoryScope(input: BankRateHistoryScopeInput): BankRateScope | null {
  if (getMandatoryEligibilityRevision() !== input.mandatoryRevision) return null;
  if (sameInput(latest?.input, input) && latest!.gateRevision === getSuitabilityRevision()) return latest!.scope;
  const count = SECTION_KEYS.reduce((total, section) => total + input.core.sections[section].rates.length, 0);
  return count <= 64 ? sharedBankRateHistoryScope(input) : null;
}

/** Deduplicate concurrent consumers; changed publications/profile gates cancel
 * old work before it can cache a mixed selection or replace the active scope. */
export function prepareBankRateHistoryScope(
  input: BankRateHistoryScopeInput,
  yieldControl: () => Promise<void>,
): Promise<BankRateScope | null> {
  // Only committed consumers may supersede work. A speculative render's cache
  // lookup must not strand a mounted consumer whose request is still current.
  const currentGeneration = activate(input);
  const cached = cachedBankRateHistoryScope(input);
  if (cached) return Promise.resolve(cached);
  if (pending && sameInput(pending.input, input)) return pending.work;
  const gateRevision = getSuitabilityRevision();
  const isCurrent = () => generation === currentGeneration &&
    getSuitabilityRevision() === gateRevision && getMandatoryEligibilityRevision() === input.mandatoryRevision;
  const work = (async () => {
    // Start after the mounting render/paint, then bound each synchronous slice.
    await yieldControl();
    const rows: Record<SectionKey, RateRow[]> = { Mortgage: [], Savings: [], TD: [] };
    let sliceStarted = performance.now();
    for (const section of SECTION_KEYS) {
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
    latest = { input, scope, gateRevision };
    return scope;
  })();
  pending = { input, work };
  void work.finally(() => { if (pending?.work === work) pending = null; }).catch(() => undefined);
  return work;
}
