import { router, type Href } from 'expo-router';

import type { SortKey } from '../data/selectors';
import { logNavDrillAttempt, markDrillAttempt } from './degradationLog';
import { buildBrowseRouteParams } from './browseRoute';
import type { SectionKey } from '../types';

/** Expo Router represents repeated query parameters as arrays; consumers use the first value. */
export const scalarRouteParam = (value?: string | string[]): string | undefined =>
  Array.isArray(value) ? value[0] : value;

// Use expo-router's object form so it handles param encoding/decoding. Passing
// pre-encoded strings caused double-decode crashes for keys containing '%' and
// ambiguous splits for keys containing ','. useLocalSearchParams returns the
// original (decoded) values on the other side.
export const openProduct = (productKey: string, rateIndex?: number) =>
  router.push({
    pathname: '/product/[key]',
    params: { key: productKey, ...(rateIndex != null ? { ri: String(rateIndex) } : {}) },
  });

/** Open the on-device receipt for one exact product-rate row. */
export const openRateReceipt = (productKey: string, rateIndex?: number) =>
  router.push({
    pathname: '/rate-receipt',
    params: { key: productKey, ...(rateIndex != null ? { ri: String(rateIndex) } : {}) },
  });

/** Open a lender page; optional date/section focus a specific bank-move drill-down. */
export const openBank = (
  provider: string,
  opts?: { date?: string; section?: SectionKey },
) =>
  router.push({
    pathname: '/bank/[provider]',
    params: {
      provider,
      ...(opts?.date ? { date: opts.date } : {}),
      ...(opts?.section ? { section: opts.section } : {}),
    },
  });

/** Dot-delimited Browse drill path from expo-router search params. */
export const parseBrowsePath = (pathRaw?: string | string[]): string[] => {
  const raw = scalarRouteParam(pathRaw);
  return (raw ?? '').split('.').filter(Boolean);
};

/** Switch to Browse tab and drill to a taxonomy node (replaces stacked /node pushes). */
export const openBrowseDrill = (section: SectionKey, path: string[] = []) => {
  markDrillAttempt(section, path);
  logNavDrillAttempt({ fn: 'openBrowseDrill', section, path });
  router.navigate({
    pathname: '/browse',
    params: buildBrowseRouteParams(section, path),
  } as unknown as Href);
};

export const openBrowse = (section: SectionKey) => openBrowseDrill(section, []);

export const openSearch = (section: SectionKey, sort?: SortKey) =>
  router.push({ pathname: '/search', params: { section, ...(sort ? { sort } : {}) } });

// Flat, searchable/sortable product list — optionally scoped to a taxonomy node.
export const openProductsList = (section: SectionKey, path: string[] = [], sort?: SortKey) =>
  router.push({ pathname: '/search', params: { section, path: path.join('.'), ...(sort ? { sort } : {}) } });

export const openRibbonProducts = (section: SectionKey, sort: SortKey) =>
  router.push({ pathname: '/search', params: { section, sort, scope: 'hierarchy' } });

// Product keys can contain commas, so serialize the array unambiguously (JSON)
// rather than comma-joining.
export const openCompare = (keys: string[]) =>
  router.push({ pathname: '/compare', params: { keys: JSON.stringify(keys) } });
