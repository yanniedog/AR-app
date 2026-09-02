import { router, usePathname } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../data/store';
import { getTabBarLayout, TAB_BAR_LABEL_LINE_HEIGHT } from '../lib/androidChrome';
import { hapticSelection } from '../lib/haptics';
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
import { commissionerFamily } from '../theme/fonts';
import { LedgerIcon, type LedgerIconName } from './icons/LedgerIcon';

const TAB_ICONS: Record<PrimaryTabRouteName, LedgerIconName> = {
  index: 'today',
  browse: 'explore',
  passthrough: 'changes',
  watchlist: 'my-rates',
};

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
  const { fontScale } = useWindowDimensions();
  const tabBarLayout = getTabBarLayout(fontScale);

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
        backgroundColor: theme.ledger.raised,
        height: tabBarLayout.contentHeight + insets.bottom,
        paddingBottom: insets.bottom,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: theme.ledger.rule,
      }}
    >
      {TAB_BAR_ORDER.map((route) => {
        const focused = active === route;
        const label = primaryTabLabel(route);
        const tint = focused ? theme.ledger.eucalyptusDeep : theme.ledger.mutedInk;

        return (
          <Pressable
            key={route}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => onPressTab(route)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 48,
              borderTopWidth: 3,
              borderTopColor: focused ? theme.ledger.wattle : 'transparent',
              backgroundColor: focused ? theme.colors.primaryMuted : 'transparent',
            }}
          >
            <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <View style={{ height: 30, alignItems: 'center', justifyContent: 'center' }}>
                <LedgerIcon name={TAB_ICONS[route]} size={23} color={tint} />
              </View>
              <Text
                numberOfLines={tabBarLayout.labelLines}
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  lineHeight: TAB_BAR_LABEL_LINE_HEIGHT,
                  fontFamily: commissionerFamily(focused ? '600' : '500'),
                  color: tint,
                  textAlign: 'center',
                  width: '100%',
                  paddingHorizontal: 2,
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
