import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import React, { useCallback } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../data/store';
import { getTabBarContentHeight } from '../lib/androidChrome';
import { hapticSelection } from '../lib/haptics';
import { getTabIonicon, getTabLabel, getTabMaterialSymbol, type TabRouteName } from '../lib/tabIcons';
import {
  resolveActiveTab,
  shouldShowAppTabBar,
  TAB_BAR_ORDER,
  tabHref,
} from '../lib/tabRouting';
import { useTheme } from '../theme/ThemeProvider';
import { MaterialSymbol } from './MaterialSymbol';

/**
 * Persistent bottom navigation rendered at the root so stack screens
 * (product, search, lenders, …) never hide the primary tabs.
 */
export function AppTabBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const onboarded = useStore((s) => s.prefs.onboarded);
  const active = resolveActiveTab(pathname);
  const isAndroid = Platform.OS === 'android';

  const onPressTab = useCallback((route: TabRouteName) => {
    if (resolveActiveTab(pathname) === route && isTabRootPath(pathname, route)) {
      hapticSelection();
      return;
    }
    router.navigate(tabHref(route));
  }, [pathname]);

  if (!shouldShowAppTabBar(pathname, onboarded)) return null;

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: isAndroid ? theme.colors.surfaceAlt : theme.colors.surface,
        height: getTabBarContentHeight() + insets.bottom,
        paddingBottom: insets.bottom,
        paddingTop: isAndroid ? 8 : 4,
        borderTopWidth: isAndroid ? 0 : 1,
        borderTopColor: theme.colors.border,
      }}
    >
      {TAB_BAR_ORDER.map((route) => {
        const focused = active === route;
        const label = getTabLabel(route);
        const symbol = getTabMaterialSymbol(route);
        const ionicon = getTabIonicon(route);
        const tint = focused ? theme.colors.primary : theme.colors.textMuted;

        return (
          <Pressable
            key={route}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => onPressTab(route)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 }}
          >
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
                paddingVertical: isAndroid ? 4 : 2,
                borderRadius: theme.radius.pill,
                backgroundColor: isAndroid && focused ? theme.colors.primaryMuted : 'transparent',
                width: '100%',
                maxWidth: '100%',
              }}
            >
              {isAndroid && symbol ? (
                <MaterialSymbol name={symbol} filled={focused} size={24} color={tint} />
              ) : ionicon ? (
                <Ionicons name={ionicon} size={24} color={tint} />
              ) : null}
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  fontSize: 10,
                  fontWeight: focused ? '600' : '500',
                  color: tint,
                  textAlign: 'center',
                }}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** True when the current path is already the tab's root (not a pushed stack screen). */
function isTabRootPath(pathname: string, route: TabRouteName): boolean {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (route === 'index') return path === '/' || path === '' || path === '/(tabs)';
  return path === `/${route}`;
}
