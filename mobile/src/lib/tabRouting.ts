import type { Href } from 'expo-router';

import { TAB_LABELS, TAB_ROUTES, type TabRouteName } from './tabIcons';

export type PrimaryTabRouteName = TabRouteName;

/** Stable destinations remain visible while users explore their detail pages. */
export const TAB_BAR_ORDER: readonly PrimaryTabRouteName[] = TAB_ROUTES;

const TAB_HREFS: Record<TabRouteName, Href> = {
  index: '/(tabs)',
  browse: { pathname: '/(tabs)/browse', params: { section: undefined, path: undefined, request: undefined } },
  watchlist: '/(tabs)/watchlist',
  market: '/(tabs)/market',
  tools: '/(tabs)/tools',
};

export function tabHref(route: TabRouteName): Href {
  return TAB_HREFS[route];
}

export function primaryTabLabel(route: PrimaryTabRouteName): string {
  return TAB_LABELS[route];
}

export function normalizeAppPath(pathname: string): string {
  const trimmed = pathname.trim().split(/[?#]/, 1)[0] ?? '';
  const path = trimmed.replace(/^\/\(tabs\)(?=\/|$)/, '') || '/';
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function shouldShowAppTabBar(pathname: string, onboarded: boolean): boolean {
  if (!onboarded) return false;
  const path = normalizeAppPath(pathname);
  return path !== '/compare' && path !== '/onboarding' && !path.startsWith('/onboarding/');
}

const ROUTE_OWNERS: Record<string, PrimaryTabRouteName> = {
  browse: 'browse', categories: 'browse', node: 'browse', search: 'browse',
  matches: 'browse', banks: 'browse', bank: 'browse', product: 'browse',
  catalogue: 'browse', compare: 'browse', 'rate-receipt': 'browse',
  watchlist: 'watchlist', saved: 'watchlist',
  market: 'market', 'bank-rates': 'market', passthrough: 'market',
  research: 'market', trends: 'market', 'rba-response': 'market', rba: 'market',
  tools: 'tools', calculator: 'tools', projections: 'tools',
  'calculation-receipt': 'tools', profile: 'tools', settings: 'tools',
  about: 'tools', terms: 'tools', 'third-party-notices': 'tools',
  'debug-log': 'tools', 'performance-audit': 'tools',
};

/** Ownership is independent of the journey; stack Back still returns to the caller. */
export function resolveActiveTab(pathname: string): PrimaryTabRouteName | null {
  const path = normalizeAppPath(pathname);
  if (path === '/') return 'index';
  const root = path.split('/')[1];
  return Object.hasOwn(ROUTE_OWNERS, root) ? ROUTE_OWNERS[root] : null;
}

export function isPrimaryTabRootPath(pathname: string, route: PrimaryTabRouteName): boolean {
  return normalizeAppPath(pathname) === (route === 'index' ? '/' : `/${route}`);
}
