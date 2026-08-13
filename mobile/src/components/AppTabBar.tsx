import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import React, { useCallback } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../data/store';
import { getTabBarContentHeight } from '../lib/androidChrome';
import { hapticSelection } from '../lib/haptics';
import { getTabIonicon, getTabMaterialSymbol } from '../lib/tabIcons';
import {
  isPrimaryTabRootPath,
  primaryTabLabel,
  resolveActiveTab,
  shouldShowAppTabBar,
  TAB_BAR_ORDER,
  tabHref,
  type PrimaryTabRouteName,
} from '../lib/tabRouting';
import { useTheme } from '../theme/ThemeProvider';
import { MaterialSymbol } from './MaterialSymbol';

/**
 * Root-level primary navigation. Focused stack routes deliberately hide this
 * bar so their native back action preserves the journey that launched them.
 */
export function AppTabBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const onboarded = useStore((s) => s.prefs.onboarded);
  const active = resolveActiveTab(pathname);
  const isAndroid = Platform.OS === 'android';

  const onPressTab = useCallback((route: PrimaryTabRouteName) => {
    if (resolveActiveTab(pathname) === route && isPrimaryTabRootPath(pathname, route)) {
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
        const label = primaryTabLabel(route);
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
            <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <View
                style={{
                  width: 52,
                  height: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radius.pill,
                  backgroundColor: focused ? theme.colors.primaryMuted : 'transparent',
                }}
              >
              {isAndroid && symbol ? (
                <MaterialSymbol name={symbol} filled={focused} size={24} color={tint} />
              ) : ionicon ? (
                <Ionicons name={ionicon} size={24} color={tint} />
              ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  fontSize: 11,
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
