import { usePathname } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../data/store';
import { getTabBarLayout, TAB_BAR_LABEL_LINE_HEIGHT } from '../lib/androidChrome';
import { hapticSelection } from '../lib/haptics';
import { navigateToPrimaryTab } from '../lib/primaryNavigation';
import { isPrimaryTabRootPath, primaryTabLabel, resolveActiveTab, shouldShowAppTabBar,
  TAB_BAR_ORDER, type PrimaryTabRouteName } from '../lib/tabRouting';
import { TAB_LEDGER_ICONS } from '../lib/tabIcons';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme/ThemeProvider';
import { fontStyle } from '../theme/fonts';
import { TouchTarget } from './TouchTarget';
import { LedgerIcon } from './icons/LedgerIcon';

function TabItem({ route, focused, onPress, labelLines, fontScale }: {
  route: PrimaryTabRouteName; focused: boolean; onPress: () => void; labelLines: number; fontScale: number;
}) {
  const theme = useTheme(), reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion !== false) { opacity.setValue(focused ? 1 : 0); return; }
    const animation = Animated.timing(opacity, { toValue: focused ? 1 : 0, duration: 160, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [focused, opacity, reducedMotion]);
  const tint = focused ? theme.colors.primary : theme.colors.textMuted;
  return <TouchTarget accessibilityRole="tab" accessibilityState={{ selected: focused }} aria-selected={focused}
    accessibilityLabel={primaryTabLabel(route)} onPress={onPress} hitSlop={0}
    style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ alignItems: 'center', width: '100%', gap: 2 }}>
      <View style={{ width: 60, height: 30, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, opacity,
          borderRadius: theme.radius.pill, backgroundColor: theme.colors.primaryMuted }} />
        <LedgerIcon name={TAB_LEDGER_ICONS[route]} size={23} color={tint} />
      </View>
      {/* Recreate native SP metrics after configuration changes; retain the tab target and selection. */}
      <Text key={fontScale} numberOfLines={labelLines} style={{ fontSize: 12, lineHeight: TAB_BAR_LABEL_LINE_HEIGHT,
        ...fontStyle(focused ? '600' : '500'), color: tint, textAlign: 'center', width: '100%', paddingHorizontal: 4 }}>
        {primaryTabLabel(route)}
      </Text>
    </View>
  </TouchTarget>;
}
/** Stable task destinations; returning from a detail preserves the mounted navigator. */
export function AppTabBar() {
  const theme = useTheme(), insets = useSafeAreaInsets(), pathname = usePathname();
  const hydrated = useStore(state => state.hydrated);
  const { fontScale } = useWindowDimensions(), active = resolveActiveTab(pathname);
  const layout = getTabBarLayout(fontScale);
  const onPress = useCallback((route: PrimaryTabRouteName) => {
    if (resolveActiveTab(pathname) === route && isPrimaryTabRootPath(pathname, route)) { hapticSelection(); return; }
    navigateToPrimaryTab(route, pathname);
  }, [pathname]);
  if (!shouldShowAppTabBar(pathname, hydrated)) return null;
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: theme.colors.surface,
    height: layout.contentHeight + insets.bottom, paddingBottom: insets.bottom,
    paddingLeft: insets.left, paddingRight: insets.right,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }}>
    {TAB_BAR_ORDER.map(route => <TabItem key={route} route={route} focused={active === route}
      onPress={() => onPress(route)} labelLines={layout.labelLines} fontScale={fontScale} />)}
  </View>;
}
