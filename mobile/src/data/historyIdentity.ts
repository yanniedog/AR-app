import type { DatesIndex } from './datesIndex';

/** Identity of the selected immutable publication, including terms-only revisions. */
export function historicalSourceIdentity(index: DatesIndex, date: string): string {
  const head = index.revision_heads?.[date];
  return head
    ? `revision:${head.revision}:${head.bundle_sha256}:${head.manifest_sha256}`
    : `legacy:${date}`;
}

/** An older index must never replace an already verified corrected date. */
export function assertHistoricalIdentitiesAdvance(
  index: DatesIndex, dates: string[], existing: Record<string, string> | undefined,
): void {
  for (const date of dates) {
    const previous = existing?.[date];
    const match = previous && /^revision:(\d+):/.exec(previous);
    if (!match) continue;
    const next = index.revision_heads?.[date];
    if (!next || next.revision < Number(match[1]) ||
        (next.revision === Number(match[1]) && historicalSourceIdentity(index, date) !== previous)) {
      throw new Error('Historical publication index is stale; retaining verified history');
    }
  }
}

export function normalizeHistoryIdentities(
  raw: unknown,
  dates: readonly string[],
): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const values = raw as Record<string, unknown>;
  return Object.fromEntries(dates.flatMap((date) => {
    const value = values[date];
    return typeof value === 'string' && value.length > 0 && value.length < 512
      ? [[date, value]] : [];
  }));
}
