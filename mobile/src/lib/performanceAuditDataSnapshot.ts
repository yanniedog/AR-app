import type { AppState } from '../data/storeTypes';
import type { AppHealthAssetObservation, AppHealthAssetKey, AppHealthDataSnapshot } from './appHealth/types';
import { clearPreparedAppHealthCatalogueSnapshot, preparedAppHealthCatalogueSnapshot } from './performanceAuditCatalogueSnapshot';

function countRecord(value: unknown): number | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).length
    : null;
}

function asset(
  ready: boolean,
  failed: boolean,
  runDate?: string | null,
  itemCount?: number | null,
): AppHealthAssetObservation {
  return {
    state: ready ? 'ready' : failed ? 'failed' : 'not-requested',
    runDate: runDate ?? null,
    itemCount: itemCount ?? null,
  };
}

/** Snapshot the exact in-memory revision already pinned by the audit. No I/O. */
export function appHealthDataSnapshot(
  state: AppState,
  appVersion: string,
  includeCatalogue = true,
): AppHealthDataSnapshot {
  if (!state.core) clearPreparedAppHealthCatalogueSnapshot();
  const coreKeys = new Set(
    Object.values(state.core?.sections ?? {})
      .flatMap((section) => section.rates)
      .map((row) => row.product_key),
  );
  const detailKeys = Object.keys(state.details?.products ?? {});
  const assets: Partial<Record<AppHealthAssetKey, AppHealthAssetObservation>> = {
    core: {
      state: state.core ? 'ready' : state.coreAssetState.status === 'error' ? 'failed' : 'missing',
      runDate: state.core?.run_date ?? null,
      itemCount: coreKeys.size,
    },
    details: asset(
      Boolean(state.details),
      false,
      state.details?.run_date,
      detailKeys.length,
    ),
    search_index: asset(
      Boolean(state.searchIndex),
      state.searchIndexStatus === 'error',
      state.searchIndex?.run_date,
      countRecord(state.searchIndex?.products),
    ),
    history_banks: asset(
      Boolean(state.historyBanks),
      Boolean(state.historyBanksError),
      state.historyBanks?.run_date,
      state.historyBanks?.run_dates.length,
    ),
    bank_history: asset(
      Boolean(state.bankInsights),
      Boolean(state.bankInsightsError),
      state.bankInsights?.run_date,
      countRecord(state.bankInsights?.banks),
    ),
    bank_spread_history: asset(
      Boolean(state.bankSpreadHistory),
      Boolean(state.bankSpreadHistoryError),
      state.bankSpreadHistory?.run_date,
      countRecord(state.bankSpreadHistory?.banks),
    ),
    rba_calendar: asset(
      Boolean(state.rbaCalendar),
      Boolean(state.rbaCalendarError),
      state.core?.run_date,
      state.rbaCalendar
        ? state.rbaCalendar.decisions.length + state.rbaCalendar.schedule.length
        : null,
    ),
  };
  return {
    catalogue: includeCatalogue ? preparedAppHealthCatalogueSnapshot(state) : null,
    source: state.source,
    core: state.core,
    manifest: state.manifest,
    appVersion,
    details: state.details
      ? {
          runDate: state.details.run_date,
          productCount: detailKeys.length,
          matchedProductCount: detailKeys.filter((key) => coreKeys.has(key)).length,
          orphanProductCount: detailKeys.filter((key) => !coreKeys.has(key)).length,
        }
      : null,
    assets,
    quarantine: state.coreIntegrity
      ? {
          rowsByReason: state.coreIntegrity.quarantines.rowsByReason,
          bankHistoryPairs: state.coreIntegrity.quarantines.bankHistoryPairs.size,
          countImpacts: state.coreIntegrity.quarantines.countImpacts,
        }
      : null,
  };
}
