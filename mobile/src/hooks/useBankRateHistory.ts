import { useEffect, useMemo, useState } from 'react';
import { SECTION_KEYS, type CorePayload } from '../types';
import { bankRateScope, type BankRateSnapshot } from '../data/bankRateOverview';
import { availableBankRateHistory, missingBankRateHistoryDates, packedBankRateSnapshots } from '../data/bankRateHistory';
import { cachedHistoricalBankRateSnapshots, historicalBankRateSnapshotsAsync } from '../data/historicalBankRateCatalogue';
import { cachedHistoricalBankRateCatalogue, missingHistoricalCatalogueDates, prepareAvailableHistoricalBankRateCatalogue } from '../data/historicalBankRateCatalogueStore';
import { profileFeaturesForSection } from '../data/profile';
import { cachedBankRateHistoryScope, prepareBankRateHistoryScope } from '../data/bankRateHistoryScope';
import { getMandatoryEligibilityRevision } from '../data/eligibilityGate';
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
  const mandatoryRevision = getMandatoryEligibilityRevision();
  const historyLoading = enabled && loading;
  const scopeInput = useMemo(() => enabled && core ? { core, details, includeNonStandard: prefs.includeNonStandard,
    interests: SECTION_KEYS, profileFilters: prefs.profileFilters, suitabilityRevision, mandatoryRevision } : null,
  [core, details, enabled, prefs.includeNonStandard, prefs.profileFilters, suitabilityRevision, mandatoryRevision]);
  const [scopeSettled, setScopeSettled] = useState<{ input: typeof scopeInput; failed: boolean } | null>(null);
  const readyScope = useMemo(() => {
    void scopeSettled;
    return scopeInput ? cachedBankRateHistoryScope(scopeInput) : EMPTY_SCOPE;
  }, [scopeInput, scopeSettled]);
  const scope = readyScope ?? EMPTY_SCOPE;
  const scopePending = !!scopeInput && !readyScope;
  const scopeFailed = scopePending && scopeSettled?.input === scopeInput && scopeSettled.failed;
  useEffect(() => {
    if (!scopeInput || !scopePending || scopeFailed) return;
    let active = true;
    void prepareBankRateHistoryScope(scopeInput, () => yieldToUi(0)).then(result => {
      if (active && result) setScopeSettled({ input: scopeInput, failed: false });
    }, () => { if (active) setScopeSettled({ input: scopeInput, failed: true }); });
    return () => { active = false; };
  }, [scopeInput, scopePending, scopeFailed]);
  useEffect(() => {
    if (enabled && core && !details && (!prefs.includeNonStandard || SECTION_KEYS.some(key => profileFeaturesForSection(prefs.profileFilters, key).length))) void ensureDetails();
  }, [core, details, enabled, ensureDetails, prefs.includeNonStandard, prefs.profileFilters]);
  const request = useMemo(() => ({ core, scope, enabled, historyRevision, suitabilityRevision, filters: {
    profileFilters: prefs.profileFilters,
    interests: SECTION_KEYS,
    includeNonStandard: prefs.includeNonStandard,
  } }), [core, scope, enabled, historyRevision, suitabilityRevision, prefs.profileFilters, prefs.includeNonStandard]);
  const [settled, setSettled] = useState<{ request: typeof request; failed: boolean } | null>(null);
  const [invalidRich, setInvalidRich] = useState<{ core: CorePayload; value: unknown } | null>(null);
  const catalogue = enabled && core ? cachedHistoricalBankRateCatalogue(core) : null;
  const rejectedRich = invalidRich?.core === core && invalidRich?.value === core?.bank_rate_history_catalogue;
  const richHistory = enabled && (!!catalogue || (!!core?.bank_rate_history_catalogue && !rejectedRich));
  const snapshots = useMemo<Record<string, BankRateSnapshot> | null>(() => {
    void settled;
    if (!enabled || historyLoading || scopePending) return null;
    return core ? richHistory ? catalogue ? cachedHistoricalBankRateSnapshots(catalogue, core, scope, request.filters) : null
      : packedBankRateSnapshots(core, scope) : {};
  }, [catalogue, core, enabled, scope, request, richHistory, settled, historyLoading, scopePending]);
  useEffect(() => {
    if (!enabled || !core || !richHistory || historyLoading || scopePending) return;
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
  }, [catalogue, core, enabled, scope, request, richHistory, historyLoading, scopePending]);
  const updating = !scopeFailed && (historyLoading || scopePending || (richHistory && snapshots === null));
  const failed = scopeFailed || (enabled && settled?.request === request && settled.failed);
  const historyAvailable = enabled && (richHistory || (core ? availableBankRateHistory(core) !== null : false));
  const missingDates = enabled && core ? catalogue ? missingHistoricalCatalogueDates(core) : richHistory ? NO_MISSING_DATES : missingBankRateHistoryDates(core) : NO_MISSING_DATES;
  // Request identity also covers same-day core corrections and changed details,
  // for which the publication date alone is not a safe consumer cache key.
  const revision = useMemo(() => `${request.historyRevision}:${request.suitabilityRevision}:${catalogue ? 'rich' : richHistory ? 'preparing' : 'packed'}:${++requestRevision}`, [request, catalogue, richHistory]);
  return { snapshots, updating, failed, historyAvailable, historyLoading, missingDates,
    richHistory, cataloguePrepared: !!catalogue, catalogue, revision, scope, filters: request.filters };
}
