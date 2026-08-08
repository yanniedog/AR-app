import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { useAppUpdateBannerVisible } from '../../src/components/AppUpdateBanner';
import { BrandLockup } from '../../src/components/BrandLockup';
import { RefreshOutcomeSnackbar } from '../../src/components/feedback';
import { getTabIonicon } from '../../src/lib/tabIcons';
import { logTabNoOp } from '../../src/lib/degradationLog';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function TabsLayout() {
  const theme = useTheme();
  const isAndroid = Platform.OS === 'android';
  const tabPressListener = ({ navigation, route }: { navigation: { getState: () => { index: number; routes: { name: string }[] } }; route: { name: string } }) => ({ tabPress: () => { const state = navigation.getState(); if (state.routes[state.index]?.name === route.name) logTabNoOp(route.name); } });
  const showUpdateBanner = useAppUpdateBannerVisible();

  return (
    <>
    <Tabs
      // Root AppTabBar owns chrome so stack screens outside this navigator
      // keep the same always-visible bottom tabs.
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
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={tabPressListener}
        options={{
          title: 'Today',
          headerTitle: () => <BrandLockup markSize={28} />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={getTabIonicon('index')!} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        listeners={tabPressListener}
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={getTabIonicon('browse')!} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="passthrough"
        listeners={tabPressListener}
        options={{
          title: 'Moves',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={getTabIonicon('passthrough')!} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        listeners={tabPressListener}
        options={{
          title: 'Outlook',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={getTabIonicon('trends')!} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        listeners={tabPressListener}
        options={{
          title: 'Saved',
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
