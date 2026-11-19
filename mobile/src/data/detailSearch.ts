import { descriptiveValue } from './descriptiveValue';
import type { ProductDetail } from '../types';
import { productFactsSearchText } from './productFacts';
import { yieldToUi } from '../lib/yieldToUi';
import { brandKeyForProvider, brandKeyForSearchTerm } from './bankBrand';

/** True when `token` starts a word in `text` (both lower-case): "ing" matches
 * "ING Bank" but not "lending". */
export function hasWordPrefix(text: string, token: string): boolean {
  if (!token) return true;
  let at = text.indexOf(token);
  while (at >= 0) {
    if (at === 0 || !/[\p{L}\p{N}]/u.test(text[at - 1])) return true;
    at = text.indexOf(token, at + 1);
  }
  return false;
}

function blobMatches(blob: string, tokens: readonly string[]): boolean {
  return tokens.every(token => hasWordPrefix(blob, token));
}

export interface ParsedSearchQuery {
  /** Canonical lender when the query names one by name, alias or short name. */
  lender: string | null;
  /** Remaining lower-case word tokens. */
  tokens: string[];
}

/** A leading or trailing lender name/alias (CBA, CommBank, ING ...) scopes the
 * query to that lender; every other token must start a word. */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  for (let size = tokens.length; size >= 1; size -= 1) {
    const head = brandKeyForSearchTerm(tokens.slice(0, size).join(' '));
    if (head) return { lender: head, tokens: tokens.slice(size) };
    const tail = brandKeyForSearchTerm(tokens.slice(tokens.length - size).join(' '));
    if (tail) return { lender: tail, tokens: tokens.slice(0, tokens.length - size) };
  }
  return { lender: null, tokens };
}

export interface SearchIndexPayload {
  schema_version: number;
  run_date: string;
  products: Record<string, string>;
}

type DetailIndex = Map<string, string>;
let runtimeCache: { ref: Record<string, ProductDetail> | null | undefined; index: DetailIndex } | null = null;
const queryMemo = new Map<string, Set<string>>();
let lastMemoScope: string | null = null;
let lastMemoIndex: SearchIndexPayload | null = null;
export const DETAIL_SEARCH_MEMO_LIMIT = 32;

function indexMemoScope(index: SearchIndexPayload, contentSha?: string | null): string {
  return contentSha ?? `${index.schema_version}:${index.run_date}`;
}

function normalizeBlob(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function detailItemsText(items: ProductDetail['fees']): string[] {
  if (!items?.length) return [];
  const parts: string[] = [];
  for (const item of items) {
    if (item.label) parts.push(String(item.label));
    if (item.name) parts.push(String(item.name));
    const value = descriptiveValue(item.value);
    if (value !== null) parts.push(value);
    if (item.info) parts.push(String(item.info));
  }
  return parts;
}

export function productDetailSearchText(detail: ProductDetail | null | undefined): string {
  if (!detail) return '';
  const chunks: string[] = [];
  if (detail.description) chunks.push(detail.description);
  chunks.push(...detailItemsText(detail.fees));
  chunks.push(...detailItemsText(detail.features));
  chunks.push(...detailItemsText(detail.eligibility));
  chunks.push(...detailItemsText(detail.constraints));
  chunks.push(...productFactsSearchText(detail));
  return normalizeBlob(chunks.join(' '));
}

export function detailSearchIndex(detailsProducts?: Record<string, ProductDetail> | null): DetailIndex {
  if (runtimeCache && runtimeCache.ref === detailsProducts) return runtimeCache.index;
  const index: DetailIndex = new Map();
  if (detailsProducts) {
    for (const [key, detail] of Object.entries(detailsProducts)) {
      const text = productDetailSearchText(detail);
      if (text) index.set(key, text);
    }
  }
  runtimeCache = { ref: detailsProducts, index };
  return index;
}

export function resetDetailSearchIndexCache(): void {
  runtimeCache = null;
  queryMemo.clear();
  lastMemoScope = null;
  lastMemoIndex = null;
}

/** Test/diagnostic hook: the production cache remains encapsulated. */
export function detailSearchMemoSize(): number {
  return queryMemo.size;
}

function memoGet(key: string): Set<string> | undefined {
  const hit = queryMemo.get(key);
  if (!hit) return undefined;
  // Map insertion order is our LRU order. Touch a hit so active queries remain.
  queryMemo.delete(key);
  queryMemo.set(key, hit);
  return hit;
}

function memoSet(key: string, hits: Set<string>): void {
  queryMemo.set(key, hits);
  while (queryMemo.size > DETAIL_SEARCH_MEMO_LIMIT) {
    const oldest = queryMemo.keys().next().value as string | undefined;
    if (!oldest) break;
    queryMemo.delete(oldest);
  }
}

function longestCachedPrefix(scope: string, query: string): Set<string> | null {
  const prefix = `${scope}:`;
  let bestLength = -1;
  let best: Set<string> | null = null;
  for (const [key, hits] of queryMemo) {
    if (!key.startsWith(prefix)) continue;
    const cachedQuery = key.slice(prefix.length);
    if (cachedQuery.length > bestLength && query.startsWith(cachedQuery)) {
      bestLength = cachedQuery.length;
      best = hits;
    }
  }
  return best;
}

function activateMemoScope(index: SearchIndexPayload, contentSha?: string | null): string {
  const scope = indexMemoScope(index, contentSha);
  // A corrected asset can legitimately retain its schema version and run date.
  // Object identity also protects callers that do not have a manifest SHA.
  if (lastMemoScope !== scope || lastMemoIndex !== index) {
    queryMemo.clear();
    lastMemoScope = scope;
    lastMemoIndex = index;
  }
  return scope;
}

export function productKeysMatchingIndex(
  index: SearchIndexPayload | null | undefined,
  query: string,
  contentSha?: string | null,
): Set<string> | null {
  const q = query.trim().toLowerCase();
  if (!q || !index?.products) return null;
  const scope = activateMemoScope(index, contentSha);
  const memo = `${scope}:${q}`;
  const cached = memoGet(memo);
  if (cached) return new Set(cached);
  const tokens = q.split(/\s+/).filter(Boolean);
  const hits = new Set<string>();
  const prefixHits = longestCachedPrefix(scope, q);
  if (prefixHits) {
    // Adding characters/tokens can only narrow word-prefix matches, so avoid a
    // second full-index walk while the user continues typing the same query.
    for (const key of prefixHits) {
      const blob = index.products[key];
      if (blob && blobMatches(blob, tokens)) hits.add(key);
    }
  } else {
    for (const [key, blob] of Object.entries(index.products)) {
      if (blobMatches(blob, tokens)) hits.add(key);
    }
  }
  memoSet(memo, new Set(hits));
  return new Set(hits);
}

type SearchRow = { provider: string; product_name: string; product_key: string };

function* ownProductKeys(products: Record<string, string>): Generator<string> {
  for (const key in products) {
    if (Object.prototype.hasOwnProperty.call(products, key)) yield key;
  }
}

/** Bound a new deep query's full index scan as well as its result-row processing. */
export async function prepareRowSearchQueryCooperatively(
  query: string, index: SearchIndexPayload | null | undefined,
  control: { cancelled?: () => boolean; yieldControl?: () => Promise<void>; now?: () => number } = {},
): Promise<((row: SearchRow) => boolean) | null> {
  if (control.cancelled?.()) return null;
  const parsed = parseSearchQuery(query);
  const q = parsed.tokens.join(' ');
  if (!q || !index?.products) return prepareRowSearchQuery(query, null);
  const scope = activateMemoScope(index);
  const memo = `${scope}:${q}`;
  const inLender = lenderScope(parsed.lender);
  const cached = memoGet(memo);
  if (cached) return row => inLender(row) && cached.has(row.product_key);
  const yieldControl = control.yieldControl ?? (() => yieldToUi(0));
  const now = control.now ?? (() => performance.now());
  const tokens = q.split(/\s+/).filter(Boolean);
  const hits = new Set<string>();
  let sliceStarted = now();
  let processed = 0;
  const prefixHits = longestCachedPrefix(scope, q);
  for (const key of prefixHits ?? ownProductKeys(index.products)) {
    const blob = index.products[key];
    if (blob && blobMatches(blob, tokens)) hits.add(key);
    processed += 1;
    if (processed % 32 === 0 && now() - sliceStarted >= 6) {
      await yieldControl();
      sliceStarted = now();
      if (control.cancelled?.()) return null;
    }
  }
  if (control.cancelled?.()) return null;
  // An older scan may finish after another publication activated its cache.
  // Its complete matcher belongs to its caller, never to that newer scope.
  if (lastMemoScope === scope && lastMemoIndex === index) memoSet(memo, hits);
  return row => inLender(row) && hits.has(row.product_key);
}

function lenderScope(lender: string | null): (row: SearchRow) => boolean {
  return lender ? row => brandKeyForProvider(row.provider) === lender : () => true;
}

/** Prepare once per filtering pass so indexed hits are not copied for every row. */
export function prepareRowSearchQuery(
  query: string,
  payloadIndex?: SearchIndexPayload | null,
  searchIndexSha?: string | null,
): (row: SearchRow, runtimeDetailText?: string) => boolean {
  if (!query.trim()) return () => true;
  const { lender, tokens } = parseSearchQuery(query);
  const inLender = lenderScope(lender);
  if (!tokens.length) return inLender;
  const hits = productKeysMatchingIndex(payloadIndex ?? null, tokens.join(' '), searchIndexSha);
  if (hits) return (row) => inLender(row) && hits.has(row.product_key);
  // Without an index the remaining text stays one phrase, as before.
  const phrase = [tokens.join(' ')];
  return (row, runtimeDetailText) => {
    if (!inLender(row)) return false;
    if (blobMatches(row.provider.toLowerCase(), phrase) || blobMatches(row.product_name.toLowerCase(), phrase)) return true;
    return runtimeDetailText ? blobMatches(runtimeDetailText, phrase) : false;
  };
}

export function rowMatchesSearchQuery(
  row: SearchRow,
  query: string,
  payloadIndex?: SearchIndexPayload | null,
  runtimeDetailText?: string,
  searchIndexSha?: string | null,
): boolean {
  return prepareRowSearchQuery(query, payloadIndex, searchIndexSha)(row, runtimeDetailText);
}
