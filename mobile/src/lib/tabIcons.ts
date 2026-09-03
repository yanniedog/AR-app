import type { LedgerIconName } from '../components/icons/LedgerIcon';

/** expo-router tab route names under `app/(tabs)/` (display order). */
export const TAB_ROUTES = ['index', 'browse', 'passthrough', 'watchlist'] as const;

export type TabRouteName = (typeof TAB_ROUTES)[number];

/** Human-readable labels for the bottom navigation bar. */
export const TAB_LABELS: Record<TabRouteName, string> = {
  index: 'Today',
  browse: 'Explore',
  passthrough: 'Changes',
  watchlist: 'My rates',
};

/** Semantic Rate Ledger glyphs for every primary destination. */
export const TAB_LEDGER_ICONS: Record<TabRouteName, LedgerIconName> = {
  index: 'today',
  browse: 'explore',
  watchlist: 'my-rates',
  passthrough: 'changes',
};

export function isTabRouteName(name: string): name is TabRouteName {
  return (TAB_ROUTES as readonly string[]).includes(name);
}

export function getTabLedgerIcon(route: string): LedgerIconName | undefined {
  return isTabRouteName(route) ? TAB_LEDGER_ICONS[route] : undefined;
}

export function getTabLabel(route: string, fallback?: string): string {
  if (isTabRouteName(route)) return TAB_LABELS[route];
  return fallback ?? route;
}
