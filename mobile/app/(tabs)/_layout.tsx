import Ionicons from '@expo/vector-icons/Ionicons';
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
import { getTabIonicon } from '../../src/lib/tabIcons';
import { primaryTabLabel } from '../../src/lib/tabRouting';
import { logTabNoOp } from '../../src/lib/degradationLog';
import { useTheme } from '../../src/theme/ThemeProvider';

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
        <Ionicons name="search" size={22} color={theme.colors.text} />
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
          backgroundColor: isAndroid ? theme.colors.surfaceAlt : theme.colors.surface,
          borderBottomColor: theme.colors.border,
        },
        headerTitleStyle: {
          color: theme.colors.text,
          fontWeight: isAndroid ? '500' : '700',
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
            <Ionicons name={getTabIonicon('index')!} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        listeners={tabPressListener}
        options={{
          title: primaryTabLabel('browse'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={getTabIonicon('browse')!} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="passthrough"
        listeners={tabPressListener}
        options={{
          title: primaryTabLabel('passthrough'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={getTabIonicon('passthrough')!} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        listeners={tabPressListener}
        options={{
          title: 'Research',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={getTabIonicon('trends')!} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        listeners={tabPressListener}
        options={{
          title: primaryTabLabel('watchlist'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={getTabIonicon('watchlist')!} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        listeners={tabPressListener}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={getTabIonicon('settings')!} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    <RefreshOutcomeSnackbar />
    </>
  );
}
