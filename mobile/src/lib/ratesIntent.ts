import { SECTION_ORDER, sectionFromSlug } from '../constants';
import type { SectionKey } from '../types';
import { EMPTY_FILTERS, normalizeSortKey } from '../data/selectors';
import type { SearchSubscription } from '../data/subscriptions';
import type { RatesSectionState } from '../data/ratesSession';
import { scalarRouteParam } from './nav';

export type RatesRouteParams = Record<string, string | string[] | undefined>;
export const RATES_INTENT_KEYS = ['section', 'path', 'sort', 'scope', 'query', 'sub', 'compare', 'providers', 'availability', 'request', 'reset'] as const;
export function ratesIntentKey(params: RatesRouteParams): string | null {
  const values = RATES_INTENT_KEYS.map(key => scalarRouteParam(params[key]));
  return values.some(value => value !== undefined) ? JSON.stringify(values) : null;
}
/** Unknown scope stays empty; a malformed explicit entry never broadens results. */
export function resolveRatesIntent(params: RatesRouteParams, currentSection: SectionKey,
  subscriptions: readonly SearchSubscription[]): { section: SectionKey; patch: Partial<RatesSectionState> } {
  const raw = Object.fromEntries(RATES_INTENT_KEYS.map(key => [key, scalarRouteParam(params[key])]));
  const canonicalSection = SECTION_ORDER.find(section => section === raw.section);
  const section = canonicalSection ?? sectionFromSlug(raw.section ?? '') ?? currentSection;
  const subscription = raw.sub ? subscriptions.find(item => item.id === raw.sub) : undefined;
  const patch: Partial<RatesSectionState> = { intentError: null, scrollOffset: 0 };
  // An explicit fresh task drops only ephemeral choices. Saved requirements,
  // preferences and the audit's rollback snapshot stay with their owners.
  if (raw.reset === '1') Object.assign(patch, { query: '', path: [], hierarchyScoped: false,
    sort: 'rate', filters: { ...EMPTY_FILTERS }, includeNonStandardOverride: null,
    availability: 'listed', selectMode: false, selected: [], page: 1 });
  if (raw.section && !canonicalSection && !sectionFromSlug(raw.section)) patch.intentError = 'Invalid rate type';
  if (raw.sub) {
    if (!subscription) patch.intentError = 'Saved search unavailable';
    else Object.assign(patch, { query: subscription.query, path: [...subscription.path],
      hierarchyScoped: subscription.hierarchyScoped, sort: normalizeSortKey(subscription.sort),
      filters: { ...EMPTY_FILTERS, ...subscription.filters },
      includeNonStandardOverride: subscription.filters.includeNonStandard, availability: 'listed' });
  }
  if (raw.path !== undefined) patch.path = raw.path.split('.').filter(Boolean);
  if (raw.scope !== undefined) patch.hierarchyScoped = raw.scope === 'hierarchy';
  if (raw.query !== undefined) patch.query = raw.query;
  if (raw.sort !== undefined) patch.sort = normalizeSortKey(raw.sort);
  if (raw.compare !== undefined) { patch.selectMode = raw.compare === '1'; patch.selected = []; }
  if (raw.availability !== undefined) {
    patch.availability = raw.availability === 'unlisted' ? 'unlisted' : 'listed';
    if (!['listed', 'unlisted'].includes(raw.availability)) patch.intentError = 'Invalid availability';
  }
  if (raw.providers !== undefined) {
    try {
      const providers: unknown = JSON.parse(raw.providers);
      if (!Array.isArray(providers) || !providers.every(value => typeof value === 'string')) throw new Error('Invalid providers');
      patch.filters = { ...EMPTY_FILTERS, ...(patch.filters ?? {}), providers };
    } catch { patch.intentError = 'Invalid bank filter'; }
  }
  return { section: subscription?.section ?? section, patch };
}
