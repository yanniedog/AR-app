import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { useAppUpdateBannerVisible } from '../../src/components/AppUpdateBanner';
import { BrandLockup } from '../../src/components/BrandLockup';
import { RefreshOutcomeSnackbar } from '../../src/components/feedback';
import { M3NavigationBar } from '../../src/components/M3NavigationBar';
import { IconButton } from '../../src/components/ui';
import { logTabNoOp } from '../../src/lib/degradationLog';
import { getTabIonicon } from '../../src/lib/tabIcons';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function TabsLayout() {
  const theme = useTheme();
  const isAndroid = Platform.OS === 'android';
  const tabPressListener = ({ navigation, route }: { navigation: { getState: () => { index: number; routes: { name: string }[] } }; route: { name: string } }) => ({ tabPress: () => { const state = navigation.getState(); if (state.routes[state.index]?.name === route.name) logTabNoOp(route.name); } });
  const showUpdateBanner = useAppUpdateBannerVisible();

  return (
    <>
    <Tabs
      tabBar={isAndroid ? (props) => <M3NavigationBar {...props} /> : undefined}
      screenOptions={{
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
        headerRight: () => (
          <IconButton
            icon="settings-outline"
            accessibilityLabel="Open settings"
            onPress={() => router.push('/(tabs)/settings')}
            style={{ marginRight: 4 }}
          />
        ),
        sceneStyle: { backgroundColor: theme.colors.bg },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: isAndroid
          ? {
              backgroundColor: theme.colors.surfaceAlt,
              borderTopWidth: 0,
              elevation: 0,
            }
          : {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
            },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={tabPressListener}
        options={{
          title: 'Today',
          headerTitle: () => <BrandLockup markSize={28} />,
          tabBarIcon: isAndroid
            ? () => null
            : ({ color, size }) => <Ionicons name={getTabIonicon('index')!} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        listeners={tabPressListener}
        options={{
          title: 'Products',
          tabBarIcon: isAndroid
            ? () => null
            : ({ color, size }) => <Ionicons name={getTabIonicon('browse')!} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="passthrough"
        listeners={tabPressListener}
        options={{
          title: 'Moves',
          tabBarIcon: isAndroid
            ? () => null
            : ({ color, size }) => <Ionicons name={getTabIonicon('passthrough')!} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        listeners={tabPressListener}
        options={{
          title: 'Outlook',
          tabBarIcon: isAndroid
            ? () => null
            : ({ color, size }) => <Ionicons name={getTabIonicon('trends')!} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        listeners={tabPressListener}
        options={{
          title: 'Saved',
          tabBarIcon: isAndroid
            ? () => null
            : ({ color, size }) => <Ionicons name={getTabIonicon('watchlist')!} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        listeners={tabPressListener}
        options={{
          title: 'Settings',
          href: null,
          headerRight: () => null,
          headerLeft: () => (
            <IconButton
              icon="arrow-back"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              style={{ marginLeft: 4 }}
            />
          ),
        }}
      />
    </Tabs>
    <RefreshOutcomeSnackbar />
    </>
  );
}
