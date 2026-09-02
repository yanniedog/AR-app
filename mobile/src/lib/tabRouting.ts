import type { Href } from 'expo-router';

import type { TabRouteName } from './tabIcons';

export type PrimaryTabRouteName = TabRouteName;

/**
 * Four household-level destinations. The legacy Trends screen remains a route
 * within Changes, while Settings remains an auxiliary destination.
 */
export const TAB_BAR_ORDER: readonly PrimaryTabRouteName[] = [
  'index',
  'browse',
  'passthrough',
  'watchlist',
];

const PRIMARY_TAB_LABELS: Record<PrimaryTabRouteName, string> = {
  index: 'Today',
  browse: 'Explore',
  passthrough: 'Changes',
  watchlist: 'My rates',
};

const TAB_HREFS: Record<TabRouteName, Href> = {
  index: '/(tabs)',
  browse: '/(tabs)/browse',
  passthrough: '/(tabs)/passthrough',
  watchlist: '/(tabs)/watchlist',
};

export function tabHref(route: TabRouteName): Href {
  return TAB_HREFS[route];
}

export function primaryTabLabel(route: PrimaryTabRouteName): string {
  return PRIMARY_TAB_LABELS[route];
}

/**
 * The primary bar belongs only on destination roots. Focused search, product,
 * comparison, planning, evidence and settings flows rely on stack navigation.
 */
export function shouldShowAppTabBar(pathname: string, onboarded: boolean): boolean {
  if (!onboarded) return false;
  const path = normalizePath(pathname);
  return (
    path === '/' ||
    path === '/browse' ||
    path === '/passthrough' ||
    path === '/watchlist'
  );
}

/** Which primary tab owns the current route for highlight state. */
export function resolveActiveTab(pathname: string): PrimaryTabRouteName | null {
  const path = normalizePath(pathname);

  if (
    path === '/passthrough' ||
    path.startsWith('/passthrough/') ||
    path === '/research' ||
    path.startsWith('/research/') ||
    path === '/trends' ||
    path === '/rba-response' ||
    path.startsWith('/rba-response/') ||
    path === '/rba' ||
    path.startsWith('/rba/')
  ) return 'passthrough';
  if (path === '/watchlist' || path.startsWith('/watchlist/')) return 'watchlist';

  if (
    path === '/browse' ||
    path.startsWith('/browse/') ||
    path.startsWith('/node') ||
    path.startsWith('/search') ||
    path.startsWith('/banks') ||
    path.startsWith('/bank/') ||
    path.startsWith('/product/') ||
    path.startsWith('/compare') ||
    path.startsWith('/calculator') ||
    path.startsWith('/projections') ||
    path.startsWith('/rate-receipt')
  ) {
    return 'browse';
  }

  if (path === '/') return 'index';
  return null;
}

/** True only for the canonical landing route of a visible destination. */
export function isPrimaryTabRootPath(
  pathname: string,
  route: PrimaryTabRouteName,
): boolean {
  const path = normalizePath(pathname);
  if (route === 'index') return path === '/';
  return path === `/${route}`;
}

function normalizePath(pathname: string): string {
  if (!pathname) return '';
  const trimmed = pathname.trim().split(/[?#]/, 1)[0] ?? '';
  const withoutGroup = trimmed === '/(tabs)'
    ? '/'
    : trimmed.startsWith('/(tabs)/')
      ? trimmed.slice('/(tabs)'.length)
      : trimmed;
  if (withoutGroup.length > 1 && withoutGroup.endsWith('/')) return withoutGroup.slice(0, -1);
  return withoutGroup;
}
