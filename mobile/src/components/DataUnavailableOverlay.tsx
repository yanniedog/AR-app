import { usePathname } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { NavigationMenuButton } from './AppNavigationMenu';
import { DataUnavailableScreen } from './DataUnavailableScreen';

/** Routes that work without rates stay reachable while data is unavailable. */
const DATA_INDEPENDENT_ROUTES = ['/settings', '/about', '/debug-log', '/terms', '/third-party-notices'] as const;

export function isDataIndependentRoute(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0].toLowerCase();
  return DATA_INDEPENDENT_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}

/**
 * The unavailable state sits inside the content pane, so the shell (tab bar,
 * Account menu, Settings, About, Debug log) remains reachable.
 */
export function DataUnavailableOverlay() {
  const theme = useTheme();
  const pathname = usePathname();
  if (isDataIndependentRoute(pathname)) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg, zIndex: 50 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 4 }}>
        <NavigationMenuButton />
      </View>
      <View style={{ flex: 1 }}>
        <DataUnavailableScreen />
      </View>
    </View>
  );
}
