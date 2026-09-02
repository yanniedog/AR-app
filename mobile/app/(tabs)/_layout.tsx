import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';

import { useAppUpdateBannerVisible } from '../../src/components/AppUpdateBanner';
import { NavigationMenuButton } from '../../src/components/AppNavigationMenu';
import { BrandLockup } from '../../src/components/BrandLockup';
import { RefreshOutcomeSnackbar } from '../../src/components/feedback';
import { resolveInterestSection } from '../../src/data/interests';
import { useStore } from '../../src/data/store';
import { openSearch } from '../../src/lib/nav';
import { primaryTabLabel } from '../../src/lib/tabRouting';
import { logTabNoOp } from '../../src/lib/degradationLog';
import { useTheme } from '../../src/theme/ThemeProvider';
import { commissionerFamily } from '../../src/theme/fonts';
import { LedgerIcon } from '../../src/components/icons/LedgerIcon';

// Preserve Today behind direct links into a legacy tab route or Settings.
export const unstable_settings = {
  initialRouteName: 'index',
};

/**
 * Search is the app's primary verb, so it gets a permanent home in the Today
 * header rather than living only behind an icon inside Products.
 */
function HomeHeaderActions() {
  const theme = useTheme();
  const section = useStore((s) => resolveInterestSection(s.prefs.interests, s.activeSection));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
      <Pressable
        onPress={() => openSearch(section)}
        accessibilityRole="button"
        accessibilityLabel="Search rates"
        style={({ pressed }) => ({
          minWidth: 48,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <LedgerIcon name="search" size={22} color={theme.ledger.ink} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isAndroid = Platform.OS === 'android';
  const tabPressListener = ({ navigation, route }: { navigation: { getState: () => { index: number; routes: { name: string }[] } }; route: { name: string } }) => ({ tabPress: () => { const state = navigation.getState(); if (state.routes[state.index]?.name === route.name) logTabNoOp(route.name); } });
  const showUpdateBanner = useAppUpdateBannerVisible();

  return (
    <>
    <Tabs
      // Root AppTabBar owns the four visible destinations. Legacy tab routes
      // remain addressable but do not create duplicate top-level choices.
      tabBar={() => null}
      screenOptions={{
        // Mounted tabs contain expensive data models. Keep blurred tabs from
        // reacting to shared section/data updates during another transition.
        freezeOnBlur: true,
        // The banner owns the status-bar inset while visible.
        ...(showUpdateBanner ? { headerStatusBarHeight: 0 } : {}),
        headerStyle: {
          backgroundColor: theme.ledger.raised,
          borderBottomColor: theme.ledger.rule,
        },
        headerTitleStyle: {
          color: theme.colors.text,
          fontFamily: commissionerFamily('600'),
          letterSpacing: isAndroid ? 0 : -0.3,
          fontSize: isAndroid ? 22 : undefined,
        },
        headerTitleAlign: isAndroid ? 'center' : 'left',
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.colors.bg },
        headerLeft: () => <NavigationMenuButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={tabPressListener}
        options={{
          title: primaryTabLabel('index'),
          headerTitle: () => <BrandLockup markSize={28} compact={width < 360} />,
          headerRight: () => <HomeHeaderActions />,
          tabBarIcon: ({ color, size }) => (
            <LedgerIcon name="today" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        listeners={tabPressListener}
        options={{
          title: primaryTabLabel('browse'),
          tabBarIcon: ({ color, size }) => (
            <LedgerIcon name="explore" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="passthrough"
        listeners={tabPressListener}
        options={{
          title: primaryTabLabel('passthrough'),
          tabBarIcon: ({ color, size }) => (
            <LedgerIcon name="changes" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        listeners={tabPressListener}
        options={{
          title: primaryTabLabel('watchlist'),
          tabBarIcon: ({ color, size }) => (
            <LedgerIcon name="my-rates" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    <RefreshOutcomeSnackbar />
    </>
  );
}
