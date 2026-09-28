import { useEffect, useMemo, useState } from 'react';
import { SECTION_KEYS, type CorePayload, type RateRow, type SectionKey } from '../types';
import { bankRateScope, type BankRateSnapshot } from '../data/bankRateOverview';
import { availableBankRateHistory, missingBankRateHistoryDates, packedBankRateSnapshots } from '../data/bankRateHistory';
import { cachedHistoricalBankRateSnapshots, historicalBankRateSnapshotsAsync } from '../data/historicalBankRateCatalogue';
import { cachedHistoricalBankRateCatalogue, missingHistoricalCatalogueDates, prepareAvailableHistoricalBankRateCatalogue } from '../data/historicalBankRateCatalogueStore';
import { visibleAccountRows } from '../data/format';
import { profileFeaturesForSection, profileFilterRows } from '../data/profile';
import { normalizeInterests } from '../data/interests';
import { useStore } from '../data/store';
import { yieldToUi } from '../lib/yieldToUi';
import { useSuitabilityRevision } from './useSuitabilityRevision';

const EMPTY_SCOPE = bankRateScope({ Mortgage: [], Savings: [], TD: [] });
const NO_MISSING_DATES: readonly string[] = [];
let requestRevision = 0;

/** Shared, render-safe history lifecycle. Every snapshot belongs to the current
 * profile request; uncached requests stay blank until their own work completes. */
export function useBankRateHistory(enabled = true) {
  const core = useStore(s => s.core);
  const historyRevision = useStore(s => s.bankRateHistoryRevision ?? 0);
  const loading = useStore(s => s.bankRateHistoryLoading ?? false);
  const details = useStore(s => s.details?.products);
  const prefs = useStore(s => s.prefs);
  const ensureDetails = useStore(s => s.ensureDetails);
  const suitabilityRevision = useSuitabilityRevision();
  const historyLoading = enabled && loading;
  const scope = useMemo(() => {
    void suitabilityRevision;
    if (!enabled || !core) return EMPTY_SCOPE;
    return bankRateScope(Object.fromEntries(SECTION_KEYS.map(key => [key,
      !prefs.onboarded || normalizeInterests(prefs.interests).includes(key)
        ? profileFilterRows(visibleAccountRows(core.sections[key].rates, prefs.includeNonStandard, details), prefs.profileFilters, key, details) : [],
    ])) as Record<SectionKey, RateRow[]>);
  }, [core, details, enabled, prefs.includeNonStandard, prefs.interests, prefs.onboarded, prefs.profileFilters, suitabilityRevision]);
  useEffect(() => {
    if (enabled && core && !details && (!prefs.includeNonStandard || SECTION_KEYS.some(key => profileFeaturesForSection(prefs.profileFilters, key).length))) void ensureDetails();
  }, [core, details, enabled, ensureDetails, prefs.includeNonStandard, prefs.profileFilters]);
  const request = useMemo(() => ({ core, scope, enabled, historyRevision, suitabilityRevision, filters: {
    profileFilters: prefs.profileFilters,
    interests: prefs.onboarded ? normalizeInterests(prefs.interests) : SECTION_KEYS,
    includeNonStandard: prefs.includeNonStandard,
  } }), [core, scope, enabled, historyRevision, suitabilityRevision, prefs.profileFilters, prefs.onboarded, prefs.interests, prefs.includeNonStandard]);
  const [settled, setSettled] = useState<{ request: typeof request; failed: boolean } | null>(null);
  const [invalidRich, setInvalidRich] = useState<{ core: CorePayload; value: unknown } | null>(null);
  const catalogue = enabled && core ? cachedHistoricalBankRateCatalogue(core) : null;
  const rejectedRich = invalidRich?.core === core && invalidRich?.value === core?.bank_rate_history_catalogue;
  const richHistory = enabled && (!!catalogue || (!!core?.bank_rate_history_catalogue && !rejectedRich));
  const snapshots = useMemo<Record<string, BankRateSnapshot> | null>(() => {
    void settled;
    if (!enabled || historyLoading) return null;
    return core ? richHistory ? catalogue ? cachedHistoricalBankRateSnapshots(catalogue, core, scope, request.filters) : null
      : packedBankRateSnapshots(core, scope) : {};
  }, [catalogue, core, enabled, scope, request, richHistory, settled, historyLoading]);
  useEffect(() => {
    if (!enabled || !core || !richHistory || historyLoading) return;
    if (catalogue && cachedHistoricalBankRateSnapshots(catalogue, core, scope, request.filters)) return;
    let active = true;
    void (async () => {
      const ready = catalogue ?? await prepareAvailableHistoricalBankRateCatalogue(core);
      if (!ready) {
        // Only the active request may reject an optional extension. The fallback
        // is then recomputed with the latest scope rather than the old request.
        if (active) setInvalidRich({ core, value: core.bank_rate_history_catalogue });
        return;
      }
      await historicalBankRateSnapshotsAsync(ready, core, scope, request.filters, () => yieldToUi(0));
      if (active) setSettled({ request, failed: false });
    })().catch(() => { if (active) setSettled({ request, failed: true }); });
    return () => { active = false; };
  }, [catalogue, core, enabled, scope, request, richHistory, historyLoading]);
  const updating = historyLoading || (richHistory && snapshots === null);
  const failed = enabled && settled?.request === request && settled.failed;
  const historyAvailable = enabled && (richHistory || (core ? availableBankRateHistory(core) !== null : false));
  const missingDates = enabled && core ? catalogue ? missingHistoricalCatalogueDates(core) : richHistory ? NO_MISSING_DATES : missingBankRateHistoryDates(core) : NO_MISSING_DATES;
  // Request identity also covers same-day core corrections and changed details,
  // for which the publication date alone is not a safe consumer cache key.
  const revision = useMemo(() => `${request.historyRevision}:${request.suitabilityRevision}:${catalogue ? 'rich' : richHistory ? 'preparing' : 'packed'}:${++requestRevision}`, [request, catalogue, richHistory]);
  return { snapshots, updating, failed, historyAvailable, historyLoading, missingDates,
    richHistory, cataloguePrepared: !!catalogue, catalogue, revision, scope, filters: request.filters };
}
