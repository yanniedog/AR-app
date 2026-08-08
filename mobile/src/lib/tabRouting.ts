import type { Href } from 'expo-router';

import type { TabRouteName } from './tabIcons';

/** Bottom-tab display order: Today → Products → Moves → Outlook → Saved → Settings. */
export const TAB_BAR_ORDER: readonly TabRouteName[] = [
  'index',
  'browse',
  'passthrough',
  'trends',
  'watchlist',
  'settings',
];

const TAB_HREFS: Record<TabRouteName, Href> = {
  index: '/(tabs)',
  browse: '/(tabs)/browse',
  passthrough: '/(tabs)/passthrough',
  trends: '/(tabs)/trends',
  watchlist: '/(tabs)/watchlist',
  settings: '/(tabs)/settings',
};

export function tabHref(route: TabRouteName): Href {
  return TAB_HREFS[route];
}

/**
 * Routes where the persistent bottom tab bar is intentionally hidden.
 * Today (`/`) must still show tabs once onboarding is complete.
 */
export function shouldShowAppTabBar(pathname: string, onboarded: boolean): boolean {
  if (!onboarded) return false;
  const path = normalizePath(pathname);
  if (path === '/onboarding' || path.startsWith('/onboarding/')) return false;
  return true;
}

/** Which primary tab owns the current route for highlight state. */
export function resolveActiveTab(pathname: string): TabRouteName {
  const path = normalizePath(pathname);

  if (
    path === '/settings' ||
    path.startsWith('/settings/') ||
    path.startsWith('/performance-audit') ||
    path.startsWith('/debug-log') ||
    path.startsWith('/terms') ||
    path.startsWith('/profile')
  ) {
    return 'settings';
  }

  if (path === '/passthrough' || path.startsWith('/passthrough/')) return 'passthrough';
  if (path === '/trends' || path.startsWith('/trends/') || path.startsWith('/rba')) {
    return 'trends';
  }
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

  return 'index';
}

function normalizePath(pathname: string): string {
  if (!pathname) return '';
  const trimmed = pathname.trim();
  if (trimmed.length > 1 && trimmed.endsWith('/')) return trimmed.slice(0, -1);
  return trimmed;
}
