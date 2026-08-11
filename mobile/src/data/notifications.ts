import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import type { Href } from 'expo-router';

import { SECTIONS, SECTION_ORDER } from '../constants';
import { debugLog } from '../lib/debugLog';
import type { CorePayload, ProductDetail, RateRow, SectionKey } from '../types';
import type { SavedRateRef } from './savedRates';
import { ongoingRateCaveat } from '../lib/rateQualifier';
import { bpsBetween, formatRate, toFraction } from './format';
import { bestRow, rankFraction, type MortgageRateMetric, type RankMetric } from './selectors';
import {
  computeSubscriptionChanges,
  largestRateChange,
  rowIdentity,
  rowsForSearchSubscription,
  type Subscription,
} from './subscriptions';

export const BACKGROUND_TASK = 'ar-rates-daily-refresh';
export const DEEP_LINK_SCHEME = 'arrates';

// Foreground presentation. (SDK 53+ replaced shouldShowAlert with shouldShowBanner/List.)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export interface NotifySearchRoute {
  section: SectionKey;
  subscriptionId?: string;
  path?: string[];
  hierarchyScoped?: boolean;
  query?: string;
  sort?: string;
  scope?: string;
}

export interface NotifyMessage {
  title: string;
  body: string;
  productKey?: string;
  rateIndex?: number | null;
  search?: NotifySearchRoute;
  href?: string;
}

export interface NotificationRoutePayload {
  productKey?: string;
  rateIndex?: string;
  url?: string;
  section?: string;
  path?: string;
  query?: string;
  scope?: string;
  sort?: string;
  subscriptionId?: string;
}

export function productDeepLink(productKey: string, rateIndex?: number | null): string {
  const path = `product/${encodeURIComponent(productKey)}`;
  if (rateIndex != null) return `${DEEP_LINK_SCHEME}://${path}?ri=${rateIndex}`;
  return `${DEEP_LINK_SCHEME}://${path}`;
}

export function searchDeepLink(route: NotifySearchRoute): string {
  const params = new URLSearchParams();
  params.set('section', route.section);
  if (route.path?.length) params.set('path', route.path.join('.'));
  if (route.hierarchyScoped) params.set('scope', 'hierarchy');
  else if (route.scope) params.set('scope', route.scope);
  if (route.query) params.set('query', route.query);
  if (route.sort) params.set('sort', route.sort);
  if (route.subscriptionId) params.set('sub', route.subscriptionId);
  return `${DEEP_LINK_SCHEME}://search?${params.toString()}`;
}

export function notificationDataFromMessage(msg: NotifyMessage): NotificationRoutePayload {
  const data: NotificationRoutePayload = {};
  if (msg.href?.startsWith(`${DEEP_LINK_SCHEME}://`)) {
    data.url = msg.href;
    return data;
  }
  if (msg.productKey) {
    data.productKey = msg.productKey;
    if (msg.rateIndex != null) data.rateIndex = String(msg.rateIndex);
    data.url = productDeepLink(msg.productKey, msg.rateIndex);
    return data;
  }
  if (msg.search) {
    data.section = msg.search.section;
    if (msg.search.path?.length) data.path = msg.search.path.join('.');
    if (msg.search.query) data.query = msg.search.query;
    if (msg.search.sort) data.sort = msg.search.sort;
    if (msg.search.subscriptionId) data.subscriptionId = msg.search.subscriptionId;
    if (msg.search.hierarchyScoped) data.scope = 'hierarchy';
    else if (msg.search.scope) data.scope = msg.search.scope;
    data.url = searchDeepLink(msg.search);
  }
  return data;
}

export function hrefFromNotificationData(
  raw: Record<string, unknown> | null | undefined,
): Href | null {
  if (!raw) return null;

  const url = typeof raw.url === 'string' ? raw.url : null;
  if (url?.startsWith(`${DEEP_LINK_SCHEME}://`)) {
    const pathAndQuery = url.slice(`${DEEP_LINK_SCHEME}://`.length);
    return `/${pathAndQuery}` as Href;
  }

  const productKey = typeof raw.productKey === 'string' ? raw.productKey : null;
  if (productKey) {
    const riRaw = raw.rateIndex;
    const ri = riRaw != null && riRaw !== '' ? Number(riRaw) : undefined;
    return {
      pathname: '/product/[key]',
      params: {
        key: productKey,
        ...(ri != null && !Number.isNaN(ri) ? { ri: String(ri) } : {}),
      },
    } as Href;
  }

  const section = typeof raw.section === 'string' ? raw.section : null;
  if (section) {
    const params: Record<string, string> = { section };
    if (typeof raw.path === 'string' && raw.path) params.path = raw.path;
    if (typeof raw.query === 'string' && raw.query) params.query = raw.query;
    if (typeof raw.sort === 'string' && raw.sort) params.sort = raw.sort;
    if (typeof raw.subscriptionId === 'string' && raw.subscriptionId) params.sub = raw.subscriptionId;
    if (typeof raw.scope === 'string' && raw.scope) params.scope = raw.scope;
    return { pathname: '/search', params } as Href;
  }

  return null;
}

function bestFraction(
  core: CorePayload,
  section: SectionKey,
  metric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'headline',
): number | null {
  const rows = core.sections[section]?.rates ?? [];
  const best = bestRow(rows, section, false, metric, null, mortgageMetric);
  // Measure the move with the same metric bestRow ranks by (base ongoing rate for
  // deposits, headline/comparison for loans), so the threshold and body text can't
  // disagree with the winner.
  return best ? rankFraction(best, section, metric, mortgageMetric) : null;
}

/** All rate rows for a product, keyed by rate_index, so changes can be matched
 *  row-for-row (a product can have many rows; comparing only the first misses
 *  changes and a row-order change would create false alerts). */
function ratesByIndex(core: CorePayload, productKey: string): Map<number, { row: RateRow; fraction: number | null }> {
  const out = new Map<number, { row: RateRow; fraction: number | null }>();
  for (const section of SECTION_ORDER) {
    for (const row of core.sections[section]?.rates ?? []) {
      if (row.product_key !== productKey) continue;
      out.set(row.rate_index ?? out.size, { row, fraction: toFraction(row.rate) });
    }
  }
  return out;
}

function productRatesByIndex(
  core: CorePayload,
  productKey: string,
  rateIndex: number | null,
): Map<number, { row: RateRow; fraction: number | null }> {
  const out = new Map<number, { row: RateRow; fraction: number | null }>();
  for (const section of Object.keys(core.sections) as SectionKey[]) {
    for (const row of core.sections[section]?.rates ?? []) {
      if (row.product_key !== productKey) continue;
      if (rateIndex != null && row.rate_index !== rateIndex) continue;
      out.set(row.rate_index ?? out.size, { row, fraction: toFraction(row.rate) });
    }
  }
  return out;
}

function ratesMap(
  rows: RateRow[],
  section: SectionKey,
  depositRankMetric: RankMetric = 'base',
  mortgageRateMetric: MortgageRateMetric = 'headline',
): Map<string, { row: RateRow; fraction: number | null }> {
  const out = new Map<string, { row: RateRow; fraction: number | null }>();
  for (const row of rows) {
    out.set(rowIdentity(row), {
      row,
      fraction: rankFraction(row, section, depositRankMetric, mortgageRateMetric),
    });
  }
  return out;
}

function subscriptionWouldNotify(
  sub: Subscription,
  oldCore: CorePayload,
  newCore: CorePayload,
  thresholdBps: number,
  oldDetailsProducts?: Record<string, ProductDetail> | null,
  newDetailsProducts?: Record<string, ProductDetail> | null,
  depositRankMetric: RankMetric = 'base',
  mortgageRateMetric: MortgageRateMetric = 'headline',
): boolean {
  if (sub.kind === 'product') {
    return (
      largestRateChange(
        productRatesByIndex(oldCore, sub.productKey, sub.rateIndex),
        productRatesByIndex(newCore, sub.productKey, sub.rateIndex),
        thresholdBps,
      ) != null
    );
  }
  const oldDetails = oldDetailsProducts;
  const newDetails = newDetailsProducts ?? oldDetailsProducts;
  return (
    largestRateChange(
      ratesMap(
        rowsForSearchSubscription(oldCore, sub, oldDetails),
        sub.section,
        depositRankMetric,
        mortgageRateMetric,
      ),
      ratesMap(
        rowsForSearchSubscription(newCore, sub, newDetails),
        sub.section,
        depositRankMetric,
        mortgageRateMetric,
      ),
      thresholdBps,
    ) != null
  );
}

function enrichSubscriptionRouting(
  raw: Array<{ title: string; body: string }>,
  subscriptions: Subscription[],
  oldCore: CorePayload,
  newCore: CorePayload,
  thresholdBps: number,
  oldDetailsProducts?: Record<string, ProductDetail> | null,
  newDetailsProducts?: Record<string, ProductDetail> | null,
  depositRankMetric: RankMetric = 'base',
  mortgageRateMetric: MortgageRateMetric = 'headline',
): NotifyMessage[] {
  const enriched: NotifyMessage[] = [];
  let rawIdx = 0;

  for (const sub of subscriptions) {
    if (
      !subscriptionWouldNotify(
        sub,
        oldCore,
        newCore,
        thresholdBps,
        oldDetailsProducts,
        newDetailsProducts,
        depositRankMetric,
        mortgageRateMetric,
      )
    ) {
      continue;
    }
    if (rawIdx >= raw.length) break;
    const base = raw[rawIdx++];
    if (sub.kind === 'product') {
      enriched.push({
        ...base,
        productKey: sub.productKey,
        rateIndex: sub.rateIndex,
      });
      continue;
    }
    enriched.push({
      ...base,
      search: {
        section: sub.section,
        subscriptionId: sub.id,
        path: sub.path,
        hierarchyScoped: sub.hierarchyScoped,
        query: sub.query,
        sort: sub.sort,
      },
    });
  }

  while (rawIdx < raw.length) enriched.push(raw[rawIdx++]);
  return enriched;
}

/**
 * Pure diff: compare two payloads and produce user-facing change messages.
 * Exposed (and unit-tested) separately from the scheduling side-effect.
 */

function dedupeNotifyMessages(messages: NotifyMessage[]): NotifyMessage[] {
  const seen = new Set<string>();
  return messages.filter((m) => {
    const key = `${m.title}\0${m.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function computeChanges(
  oldCore: CorePayload | null,
  newCore: CorePayload,
  favorites: readonly (string | SavedRateRef)[],
  thresholdBps: number,
  subscriptions: Subscription[] = [],
  oldDetailsProducts?: Record<string, ProductDetail> | null,
  newDetailsProducts?: Record<string, ProductDetail> | null,
  depositRankMetric: RankMetric = 'base',
  mortgageRateMetric: MortgageRateMetric = 'headline',
): NotifyMessage[] {
  if (!oldCore) return [];
  const subscriptionMessages = computeSubscriptionChanges(
    oldCore,
    newCore,
    subscriptions,
    thresholdBps,
    oldDetailsProducts,
    newDetailsProducts,
    depositRankMetric,
    mortgageRateMetric,
  );
  const messages: NotifyMessage[] = [];

  // Per-category best-rate moves.
  for (const section of SECTION_ORDER) {
    const before = bestFraction(oldCore, section, depositRankMetric, mortgageRateMetric);
    const afterRow = bestRow(
      newCore.sections[section]?.rates ?? [],
      section,
      false,
      depositRankMetric,
      null,
      mortgageRateMetric,
    );
    const after = afterRow
      ? rankFraction(afterRow, section, depositRankMetric, mortgageRateMetric)
      : null;
    if (before === null || after === null) continue;
    const bps = Math.abs(bpsBetween(after, before) ?? 0);
    if (bps < thresholdBps) continue;
    const meta = SECTIONS[section];
    const improved = meta.lowerIsBetter ? after < before : after > before;
    // When the new best is a bonus/intro headline, say what it reverts to so the
    // alert can't overstate the rate a typical customer keeps.
    const caveat = ongoingRateCaveat(afterRow, section);
    messages.push({
      title: `${meta.title}: best rate ${improved ? 'improved' : 'changed'}`,
      body: `Now ${formatRate(after)} (was ${formatRate(before)}).${caveat ? ` ${caveat}` : ''}`,
      search: { section },
    });
  }

  // RBA cash-rate change.
  const oldRba = oldCore.rba.at(-1);
  const newRba = newCore.rba.at(-1);
  if (oldRba && newRba && newRba.date !== oldRba.date && newRba.rate !== oldRba.rate) {
    messages.push({
      title: 'RBA cash rate changed',
      body: `Cash rate is now ${newRba.rate.toFixed(2)}% (was ${oldRba.rate.toFixed(2)}%).`,
      href: `${DEEP_LINK_SCHEME}://rba-response?date=${encodeURIComponent(newRba.date)}`,
    });
  }
  const oldHolds = new Set(oldCore.rba_holds ?? []);
  const newHold = (newCore.rba_holds ?? [])
    .filter((date) => !oldHolds.has(date))
    .sort()
    .at(-1);
  const heldRate = newHold
    ? newCore.rba.filter((entry) => entry.date <= newHold).at(-1)?.rate
    : null;
  if (newHold && heldRate != null) {
    messages.push({
      title: 'RBA cash rate held',
      body: `Cash rate remains ${heldRate.toFixed(2)}%.`,
      href: `${DEEP_LINK_SCHEME}://rba`,
    });
  }

  // Watchlisted products — compare row-for-row by rate_index and report the largest
  // qualifying move (order-independent; catches changes to any rate row, not just the first).
  for (const saved of favorites) {
    const key = typeof saved === 'string' ? saved : saved.productKey;
    const exactIndex = typeof saved === 'string' || saved.scope === 'product' ? null : saved.rateIndex;
    const before = exactIndex == null ? ratesByIndex(oldCore, key) : productRatesByIndex(oldCore, key, exactIndex);
    const after = exactIndex == null ? ratesByIndex(newCore, key) : productRatesByIndex(newCore, key, exactIndex);
    let biggest: { row: RateRow; from: number; to: number; bps: number } | null = null;
    for (const [index, nw] of after) {
      const od = before.get(index);
      if (!od || od.fraction === null || nw.fraction === null) continue;
      const bps = Math.abs(bpsBetween(nw.fraction, od.fraction) ?? 0);
      if (bps >= thresholdBps && (!biggest || bps > biggest.bps)) {
        biggest = { row: nw.row, from: od.fraction, to: nw.fraction, bps };
      }
    }
    if (biggest) {
      const section = SECTION_ORDER.find((s) =>
        (newCore.sections[s]?.rates ?? []).some((r) => r === biggest!.row),
      );
      const caveat = section ? ongoingRateCaveat(biggest.row, section) : '';
      messages.push({
        title: `${biggest.row.provider} rate changed`,
        body: `${biggest.row.product_name}: ${formatRate(biggest.from)} → ${formatRate(biggest.to)}.${caveat ? ` ${caveat}` : ''}`,
        productKey: key,
        rateIndex: biggest.row.rate_index ?? null,
      });
    }
  }

  const combined = [...subscriptionMessages, ...messages];
  const enriched = enrichSubscriptionRouting(
    combined,
    subscriptions,
    oldCore,
    newCore,
    thresholdBps,
    oldDetailsProducts,
    newDetailsProducts,
    depositRankMetric,
    mortgageRateMetric,
  );
  return dedupeNotifyMessages(enriched);
}

export async function ensurePermissions(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

export async function notify(messages: NotifyMessage[]): Promise<void> {
  if (!messages.length) return;
  debugLog.debug('notify', `scheduling ${messages.length} notification(s)`);
  if (!(await ensurePermissions())) {
    debugLog.warn('notify', 'permissions denied — skipped');
    return;
  }
  // Collapse a flurry into at most a few notifications.
  for (const msg of messages.slice(0, 3)) {
    const data = notificationDataFromMessage(msg);
    await Notifications.scheduleNotificationAsync({
      content: { title: msg.title, body: msg.body, data: data as Record<string, unknown> },
      trigger: null, // immediate
    });
  }
}

export function routeFromNotificationResponse(
  response: Notifications.NotificationResponse | null | undefined,
): Href | null {
  const data = response?.notification?.request?.content?.data as Record<string, unknown> | undefined;
  return hrefFromNotificationData(data);
}

// --- Background refresh ---------------------------------------------------- //
// The OS-scheduled task is defined in store.ts (where it can rehydrate persisted
// state and call refresh() directly, even on a headless/terminated launch).
export async function registerBackgroundRefresh(): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      debugLog.warn('notify', `background refresh unavailable status=${String(status)}`);
      return false;
    }
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, {
      minimumInterval: 60 * 6, // minutes; OS decides the actual cadence
    });
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
    debugLog.info('notify', `background refresh registered=${registered}`);
    return registered;
  } catch (err) {
    debugLog.warn('notify', `background register failed: ${String((err as Error)?.message ?? err)}`);
    // Background tasks may be unavailable (for example, web or a simulator).
    return false;
  }
}

export async function unregisterBackgroundRefresh(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK);
    debugLog.info('notify', 'background refresh unregistered');
  } catch (err) {
    debugLog.debug('notify', `background unregister failed: ${String((err as Error)?.message ?? err)}`);
    // ignore
  }
}
