import { usePathname } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../data/store';
import { getTabBarLayout, TAB_BAR_LABEL_LINE_HEIGHT } from '../lib/androidChrome';
import { hapticSelection } from '../lib/haptics';
import { navigateToPrimaryTab } from '../lib/primaryNavigation';
import {
  isPrimaryTabRootPath,
  primaryTabLabel,
  resolveActiveTab,
  shouldShowAppTabBar,
  TAB_BAR_ORDER,
  type PrimaryTabRouteName,
} from '../lib/tabRouting';
import { useTheme } from '../theme/ThemeProvider';
import { commissionerFamily } from '../theme/fonts';
import { TAB_LEDGER_ICONS } from '../lib/tabIcons';
import { LedgerIcon } from './icons/LedgerIcon';

/** Persistent section navigation; stack Back still preserves the current journey. */
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
    navigateToPrimaryTab(route, pathname);
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
        paddingLeft: insets.left,
        paddingRight: insets.right,
        borderTopWidth: StyleSheet.hairlineWidth,
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
            aria-selected={focused}
            accessibilityLabel={label}
            onPress={() => onPressTab(route)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 48,
              backgroundColor: pressed ? theme.colors.primaryMuted : 'transparent',
            })}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                width: 28,
                height: 3,
                backgroundColor: focused ? theme.ledger.eucalyptus : 'transparent',
              }}
            />
            <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <View style={{ height: 30, alignItems: 'center', justifyContent: 'center' }}>
                <LedgerIcon name={TAB_LEDGER_ICONS[route]} size={23} color={tint} />
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
