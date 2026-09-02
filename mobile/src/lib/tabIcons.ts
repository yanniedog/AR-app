/** expo-router tab route names under `app/(tabs)/` (display order). */
export const TAB_ROUTES = ['index', 'browse', 'passthrough', 'watchlist'] as const;

export type TabRouteName = (typeof TAB_ROUTES)[number];

/** Ionicons glyph names used on iOS tab bar. */
export type TabIoniconName =
  | 'home'
  | 'list'
  | 'star'
  | 'swap-vertical';

/** Human-readable labels for the bottom navigation bar. */
export const TAB_LABELS: Record<TabRouteName, string> = {
  index: 'Today',
  browse: 'Explore',
  passthrough: 'Changes',
  watchlist: 'My rates',
};

/** iOS tab bar keeps Ionicons for platform-native chrome. */
export const TAB_IONICONS: Record<TabRouteName, TabIoniconName> = {
  index: 'home',
  browse: 'list',
  watchlist: 'star',
  passthrough: 'swap-vertical',
};

export function isTabRouteName(name: string): name is TabRouteName {
  return (TAB_ROUTES as readonly string[]).includes(name);
}

export function getTabIonicon(route: string): TabIoniconName | undefined {
  return isTabRouteName(route) ? TAB_IONICONS[route] : undefined;
}

export function getTabLabel(route: string, fallback?: string): string {
  if (isTabRouteName(route)) return TAB_LABELS[route];
  return fallback ?? route;
}
