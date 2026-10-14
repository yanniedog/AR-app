import type { UiLabel } from './uiCopy';
import type { LedgerIconName } from '../components/icons/LedgerIcon';

/** expo-router tab route names under `app/(tabs)/` (display order). */
export const TAB_ROUTES = ['browse', 'watchlist', 'market'] as const;

export type TabRouteName = (typeof TAB_ROUTES)[number];

/** Human-readable labels for the bottom navigation bar. */
export const TAB_LABELS: Record<TabRouteName, UiLabel> = {
  browse: 'Rates',
  watchlist: 'Saved',
  market: 'Market',
};

/** Semantic Rate Ledger glyphs for every primary destination. */
export const TAB_LEDGER_ICONS: Record<TabRouteName, LedgerIconName> = {
  browse: 'search',
  watchlist: 'star',
  market: 'changes',
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
