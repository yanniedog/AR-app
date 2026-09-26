import type { Manifest } from '../types';
import { parseDatesIndex, type DatesIndex } from './datesIndex';
import { assertHistoricalIdentitiesAdvance, historicalSourceIdentity } from './historyIdentity';
import { assertRevisionManifest } from './payloadRevision';

/** Small recovery receipt; parsing it must not load the historical catalogue. */
export function parseHistoryDatesIndex(raw: unknown, manifest: Manifest): DatesIndex | null {
  try {
    const dates = (raw as DatesIndex | null)?.dates;
    // Same day budget as the catalogue, checked before parsing untrusted cache data.
    if (!manifest.payload_revision || !Array.isArray(dates) || dates.length > 5000) return null;
    const heads = (raw as DatesIndex).revision_heads;
    if (!heads || typeof heads !== 'object' || Object.keys(heads).length > 5000) return null;
    const index = parseDatesIndex(raw, manifest.repo);
    const head = index?.revision_heads?.[manifest.run_date];
    if (!index || !head) return null;
    assertRevisionManifest(manifest, head, manifest.run_date, manifest.repo);
    return index;
  } catch { return null; }
}

export function assertHistoryDatesIndexAdvances(index: DatesIndex, previous: DatesIndex): void {
  const dates = Object.keys(previous.revision_heads ?? {}).filter(day => day <= index.latest_date);
  assertHistoricalIdentitiesAdvance(index, dates, Object.fromEntries(
    dates.map(day => [day, historicalSourceIdentity(previous, day)]),
  ));
}
