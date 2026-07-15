import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { AppUpdateBanner, useAppUpdateBanner } from '../../src/components/AppUpdateBanner';
import { BrandLockup } from '../../src/components/BrandLockup';
import { RefreshOutcomeSnackbar } from '../../src/components/feedback';
import { M3NavigationBar } from '../../src/components/M3NavigationBar';
import { logTabNoOp } from '../../src/lib/degradationLog';
import { getTabIonicon } from '../../src/lib/tabIcons';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function TabsLayout() {
  const theme = useTheme();
  const isAndroid = Platform.OS === 'android';
  const tabPressListener = ({ navigation, route }: { navigation: { getState: () => { index: number; routes: { name: string }[] } }; route: { name: string } }) => ({ tabPress: () => {
    // #region agent log
    const state = navigation.getState();
    const from = state.routes[state.index]?.name;
    fetch('http://127.0.0.1:7677/ingest/5d5142c5-2085-4bc4-8f7d-0dd9a3803d45',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d1dc54'},body:JSON.stringify({sessionId:'d1dc54',runId:'pre-fix',hypothesisId:'E',location:'tabs/_layout.tsx:tabPress',message:'tab press',data:{from,to:route.name,noOp:from===route.name},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (from === route.name) logTabNoOp(route.name);
  } });
  const updateBanner = useAppUpdateBanner();
  const showUpdateBanner = updateBanner.visible && updateBanner.remote != null;

  return (
    <>
    {showUpdateBanner ? (
      <AppUpdateBanner remote={updateBanner.remote!} onDismiss={updateBanner.dismiss} />
    ) : null}
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
          title: 'Home',
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
          title: 'Browse',
          tabBarIcon: isAndroid
            ? () => null
            : ({ color, size }) => <Ionicons name={getTabIonicon('browse')!} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        listeners={tabPressListener}
        options={{
          title: 'Watchlist',
          tabBarIcon: isAndroid
            ? () => null
            : ({ color, size }) => <Ionicons name={getTabIonicon('watchlist')!} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        listeners={tabPressListener}
        options={{
          title: 'Trends',
          tabBarIcon: isAndroid
            ? () => null
            : ({ color, size }) => <Ionicons name={getTabIonicon('trends')!} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="passthrough"
        listeners={tabPressListener}
        options={{
          title: 'Pass-through',
          tabBarIcon: isAndroid
            ? () => null
            : ({ color, size }) => (
                <Ionicons name={getTabIonicon('passthrough')!} size={size} color={color} />
              ),
        }}
      />
      <Tabs.Screen
        name="settings"
        listeners={tabPressListener}
        options={{
          title: 'Settings',
          tabBarIcon: isAndroid
            ? () => null
            : ({ color, size }) => <Ionicons name={getTabIonicon('settings')!} size={size} color={color} />,
        }}
      />
    </Tabs>
    <RefreshOutcomeSnackbar />
    </>
  );
}
