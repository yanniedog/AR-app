export type RatesPageSize = 10 | 20;
export const normalizeRatesPageSize = (value: unknown): RatesPageSize => value === 10 ? 10 : 20;

export function ratesPageWindow(total: number, requestedPage: number, size: RatesPageSize) {
  const count = Number.isSafeInteger(total) && total > 0 ? total : 0;
  const pages = Math.ceil(count / size);
  const requested = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const page = Math.max(1, Math.min(Math.max(1, pages), requested));
  const offset = (page - 1) * size;
  return { total: count, pages, page, offset, from: count ? offset + 1 : 0,
    to: Math.min(count, offset + size), previous: count > 0 && page > 1, next: page < pages };
}

/** At most seven entries, independent of whether there are six or six thousand pages. */
export function ratesPageIndex(page: number, pages: number): (number | 'before' | 'after')[] {
  if (pages <= 7) return Array.from({ length: Math.max(0, pages) }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(page - 1, pages - 3));
  return [1, ...(start > 2 ? ['before' as const] : []), start, start + 1, start + 2,
    ...(start + 2 < pages - 1 ? ['after' as const] : []), pages];
}
