import { Tabs, usePathname } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { useAppUpdateBannerVisible } from '../../src/components/AppUpdateBanner';
import { NavigationMenuButton } from '../../src/components/AppNavigationMenu';
import { RefreshOutcomeSnackbar } from '../../src/components/feedback';
import { useStore } from '../../src/data/store';
import { primaryTabLabel, TAB_BAR_ORDER } from '../../src/lib/tabRouting';
import { TAB_LEDGER_ICONS } from '../../src/lib/tabIcons';
import { shouldShowBreadcrumbs } from '../../src/lib/breadcrumbs';
import { logTabNoOp } from '../../src/lib/degradationLog';
import { useTheme } from '../../src/theme/ThemeProvider';
import { HEADER_TYPOGRAPHY } from '../../src/theme/typography';
import { LedgerIcon } from '../../src/components/icons/LedgerIcon';

// Direct links retain a real Home destination behind the requested section.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabsLayout() {
  const theme = useTheme();
  const showUpdateBanner = useAppUpdateBannerVisible();
  const onboarded = useStore((state) => state.prefs.onboarded);
  const breadcrumbVisible = shouldShowBreadcrumbs(usePathname(), onboarded);

  return (
    <>
      <Tabs
        tabBar={() => null}
        screenOptions={{
          freezeOnBlur: true,
          ...(showUpdateBanner || breadcrumbVisible ? { headerStatusBarHeight: 0 } : {}),
          headerStyle: { backgroundColor: theme.ledger.raised, borderBottomColor: theme.ledger.rule },
          headerTitleStyle: { color: theme.colors.text, ...HEADER_TYPOGRAPHY },
          headerTitleAlign: Platform.OS === 'android' ? 'center' : 'left',
          headerShadowVisible: false,
          sceneStyle: { backgroundColor: theme.colors.bg },
          headerRight: () => <NavigationMenuButton />,
        }}
      >
        {TAB_BAR_ORDER.map((name) => (
          <Tabs.Screen
            key={name}
            name={name}
            listeners={({ navigation, route }) => ({
              tabPress: () => {
                const state = navigation.getState();
                if (state.routes[state.index]?.name === route.name) logTabNoOp(route.name);
              },
            })}
            options={{
              title: primaryTabLabel(name),
              tabBarIcon: ({ color, size }) => <LedgerIcon name={TAB_LEDGER_ICONS[name]} size={size} color={color} />,
            }}
          />
        ))}
      </Tabs>
      <RefreshOutcomeSnackbar />
    </>
  );
}
