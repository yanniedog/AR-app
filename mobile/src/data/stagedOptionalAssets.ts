import type { Manifest } from '../types';
import type { AppState } from './storeTypes';
import { normalizeHistoryBanksPayload } from './historyPayload';
import { normalizeBankInsightsPayload } from './bankInsights';
import { normalizeBankSpreadHistoryPayload } from './bankSpreadHistory';
import { normalizeRbaCalendar } from './rbaCalendar';
import { COMPACT_HISTORY_NORMALIZATION_VERSION } from './historyDerivation';
import type { SearchIndexPayload } from './detailSearch';

export type StagedOptionalAssets = Pick<Partial<AppState>,
  'searchIndex' | 'historyBanks' | 'bankInsights' | 'bankSpreadHistory' | 'rbaCalendar' | 'rbaCalendarSha'>;

/** Called only after the descriptor's exact downloaded bytes have been verified. */
export function normalizeStagedOptionalAsset(key: string, decoded: Record<string, unknown>, manifest: Manifest): StagedOptionalAssets {
  switch (key) {
    case 'search_index': {
      if (decoded.schema_version !== 1 || !decoded.products || typeof decoded.products !== 'object' ||
          Array.isArray(decoded.products) || Object.values(decoded.products).some(value => typeof value !== 'string')) {
        throw new Error('search_index payload failed validation');
      }
      return { searchIndex: decoded as unknown as SearchIndexPayload };
    }
    case 'history_banks': {
      const historyBanks = normalizeHistoryBanksPayload(decoded);
      if (!historyBanks) throw new Error('history_banks payload failed validation');
      historyBanks.normalization_version = COMPACT_HISTORY_NORMALIZATION_VERSION;
      return { historyBanks };
    }
    case 'bank_history': {
      const bankInsights = normalizeBankInsightsPayload(decoded);
      if (!bankInsights) throw new Error('bank_history payload failed validation');
      return { bankInsights };
    }
    case 'bank_spread_history': {
      const bankSpreadHistory = normalizeBankSpreadHistoryPayload(decoded);
      if (!bankSpreadHistory) throw new Error('bank_spread_history payload failed validation');
      return { bankSpreadHistory };
    }
    case 'rba_calendar': {
      const rbaCalendar = normalizeRbaCalendar(decoded);
      if (!rbaCalendar) throw new Error('rba_calendar payload failed validation');
      return { rbaCalendar, rbaCalendarSha: manifest.files.rba_calendar!.sha256 };
    }
    default: return {};
  }
}

const spreadReceipts = new WeakMap<Manifest, { coreSha: string; assetSha: string; runDate: string;
  value: NonNullable<AppState['bankSpreadHistory']> }>();

/** Publication is allowed only after the bundle commits; freeze chart arrays so
 * mutation cannot turn this receipt into an endorsement of unrelated values. */
export function bindStagedSpread(manifest: Manifest, value: NonNullable<AppState['bankSpreadHistory']>): void {
  for (const series of Object.values(value.banks)) {
    for (const values of Object.values(series)) Object.freeze(values);
    Object.freeze(series);
  }
  Object.freeze(value.banks); Object.freeze(value.cohorts); Object.freeze(value.run_dates); Object.freeze(value);
  spreadReceipts.set(manifest, { coreSha: manifest.files.core.sha256,
    assetSha: manifest.files.bank_spread_history!.sha256, runDate: manifest.run_date, value });
}

export function stagedSpreadFor(manifest: Manifest): AppState['bankSpreadHistory'] {
  const saved = spreadReceipts.get(manifest);
  return saved && saved.coreSha === manifest.files.core.sha256 &&
    saved.assetSha === manifest.files.bank_spread_history?.sha256 && saved.runDate === manifest.run_date ? saved.value : null;
}
