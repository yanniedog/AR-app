import * as Application from 'expo-application';
import { Header } from '@react-navigation/elements';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, router, usePathname, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import {
  AppState,
  Platform,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLockGate } from '../src/components/AppLockGate';
import {
  AppNavigationMenu,
  NavigationMenuButton,
  NavigationMenuProvider,
} from '../src/components/AppNavigationMenu';
import { AppTabBar } from '../src/components/AppTabBar';
import { AppBreadcrumbBar } from '../src/components/AppBreadcrumbBar';
import { NavigatorSafeArea } from '../src/components/NavigatorSafeArea';
import {
  AppUpdateBanner,
  AppUpdateBannerLayoutProvider,
  useAppUpdateBanner,
} from '../src/components/AppUpdateBanner';
import { SELF_UPDATE_ENABLED } from '../src/config';
import { registerPassiveAuditBackground, startPassiveAuditPreloading } from '../src/lib/passiveAudit';
import { ScenarioRecoveryBanner } from '../src/components/ScenarioRecoveryBanner';
import { DataUnavailableScreen } from '../src/components/DataUnavailableScreen';
import { ErrorScreen } from '../src/components/ErrorScreen';
import { TrustedExternalUrlProvider } from '../src/components/ExternalLinkConfirmation';
import {
  PerformanceAuditRunner,
  usePerformanceAuditActiveState,
} from '../src/components/PerformanceAuditRunner';
import { registerBackgroundRefresh, routeFromNotificationResponse } from '../src/data/notifications';
import { useStore } from '../src/data/store';
import { shouldRefreshOnResume } from '../src/data/resumeRefresh';
import { CURRENT_PRIVACY_CHOICE_VERSION } from '../src/data/storeTypes';
import { androidStackScreenOptions } from '../src/lib/androidChrome';
import { breadcrumbsFitWidth, shouldShowBreadcrumbs } from '../src/lib/breadcrumbs';
import { debugLog, formatErrorTrace, installGlobalErrorHandlers } from '../src/lib/debugLog';
import { logSwallowedError } from '../src/lib/degradationLog';
import {
  setCrashReportsEnabled,
  setSessionReplayEnabled,
} from '../src/lib/observability';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { HEADER_TYPOGRAPHY } from '../src/theme/typography';
import { uiLabel, type UiLabel } from '../src/lib/uiCopy';

const ROUTE_TITLES: readonly (readonly [string,UiLabel])[] = [
  ['calculator','Calculate'],['product/[key]','Product'],['bank/[provider]','Bank'],['compare','Compare'],
  ['rate-receipt','Bank-call brief'],['calculation-receipt','Open calculation receipt'],
  ['profile','Profile'],['settings','Settings'],['about','About'],['terms','Terms and privacy'],
  ['third-party-notices','Third-party notices'],['research','Outlook'],['rba','RBA'],
  ['rba-response','Bank response'],['bank-rates','Bank rates'],['debug-log','Debug log'],
  ['performance-audit','Performance audit'],['+not-found','Screen unavailable'],
];
function routeTitle(name:string,path:string) {
  if(name === '(tabs)') return uiLabel(path.includes('watchlist') ? 'Saved':path.includes('market') ? 'Market':'Rates');
  return uiLabel(ROUTE_TITLES.find(([routeName])=>routeName === name)?.[1]??'Rates');
}

// Deep links retain the canonical tab navigator for native Back.
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

let coldStartLogReset: Promise<void> | null = null;
SplashScreen.preventAutoHideAsync().catch((err) => logSwallowedError('splash.preventAutoHide', err));


export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  debugLog.error('app', `render error trace=${formatErrorTrace(error)}`);
  return <ErrorScreen error={error} retry={retry} />;
}

function navigateFromNotification(href: Href): void {
  const pathname = String(href).split(/[?#]/, 1)[0].toLowerCase();
  const routeClass = pathname.startsWith('/bank/')
    ? 'bank-detail'
    : pathname.startsWith('/product/')
      ? 'product-detail'
      : pathname === '/saved'
        ? 'saved'
        : pathname === '/rba-response'
          ? 'bank-response'
          : 'other';
  debugLog.info('notify', `tap routeClass=${routeClass}`);
  router.push(href);
}

function RootNavigator() {
  const theme = useTheme();
  const status = useStore((s) => s.status);
  const hydrated = useStore((s) => s.hydrated);
  const dataUnavailable = hydrated && status === 'error';
  const crashReportsEnabled = useStore((s) => s.prefs.crashReportsEnabled);
  const sessionReplayEnabled = useStore((s) => s.prefs.sessionReplayEnabled);
  const privacyChoiceVersion = useStore((s) => s.prefs.privacyChoiceVersion);
  const setPref = useStore((s) => s.setPref);
  const pathname = usePathname();
  const bootstrap = useStore((s) => s.bootstrap);
  const performanceAuditActive = usePerformanceAuditActiveState();
  const androidHeader = androidStackScreenOptions(theme);
  const pendingNotificationRoute = useRef<Href | null>(null);
  const lastAppState = useRef(AppState.currentState);
  const coldStartChecked = useRef(false);

  const appReady = hydrated && (status === 'ready' || status === 'error');
  const updateBanner = useAppUpdateBanner(appReady && SELF_UPDATE_ENABLED);
  const showUpdateBanner = updateBanner.visible && updateBanner.remote != null;
  const { width: shellWidth } = useWindowDimensions();

  const privacyChoiceCurrent = privacyChoiceVersion === CURRENT_PRIVACY_CHOICE_VERSION;
  // Hydration controls the shell. Privacy choices never control browsing.
  const breadcrumbVisible = shouldShowBreadcrumbs(pathname, hydrated) && breadcrumbsFitWidth(shellWidth);

  useLayoutEffect(() => {
    if (!hydrated) return;
    void setCrashReportsEnabled(privacyChoiceCurrent && crashReportsEnabled).catch((error) => {
      debugLog.warn(
        'privacy',
        `crash-reporting consent confirmation failed: ${String((error as Error)?.message ?? error)}`,
      );
    });
    // Session replay is fail-closed: route changes cannot race an asynchronous
    // SDK pause because the app never enables collection.
    void setSessionReplayEnabled(false);
    if (sessionReplayEnabled) setPref('sessionReplayEnabled', false);
  }, [
    hydrated,
    crashReportsEnabled,
    privacyChoiceCurrent,
    sessionReplayEnabled,
    setPref,
  ]);

  useEffect(() => {
    installGlobalErrorHandlers();
    debugLog.info(
      'app',
      `bootstrap starting version=${Application.nativeApplicationVersion ?? 'unknown'} build=${Application.nativeBuildVersion ?? 'unknown'}`,
    );
    void coldStartLogReset?.then(() => debugLog.flushToFile());
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!appReady) return;
    void registerBackgroundRefresh();
    void registerPassiveAuditBackground();
    return startPassiveAuditPreloading();
  }, [appReady]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const resumed = lastAppState.current !== 'active' && nextState === 'active';
      lastAppState.current = nextState;
      if (!resumed || performanceAuditActive) return;
      const live = useStore.getState();
      if (live.status !== 'ready' || live.refreshing) return;
      if (shouldRefreshOnResume(live.lastCheckedAt)) {
        void live
          .refresh({ background: true })
          .catch((err) => logSwallowedError('resume.refresh', err));
      }
    });
    return () => sub.remove();
  }, [performanceAuditActive]);

  useEffect(() => {
    if (!appReady) return;
    SplashScreen.hideAsync().catch((err) => logSwallowedError('splash.hide', err));
  }, [appReady]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const queueRoute = (href: Href | null) => {
      if (!href) return;
      if (hydrated && (status === 'ready' || status === 'error')) {
        navigateFromNotification(href);
        return;
      }
      pendingNotificationRoute.current = href;
    };

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      queueRoute(routeFromNotificationResponse(response));
    });

    if (!coldStartChecked.current) {
      coldStartChecked.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        queueRoute(routeFromNotificationResponse(response));
      });
    }

    return () => sub.remove();
  }, [hydrated, status]);

  useEffect(() => {
    if (!hydrated || (status !== 'ready' && status !== 'error')) return;
    const href = pendingNotificationRoute.current;
    if (!href) return;
    pendingNotificationRoute.current = null;
    navigateFromNotification(href);
  }, [hydrated, status]);

  if (dataUnavailable) {
    return (
      <AppUpdateBannerLayoutProvider visible={showUpdateBanner}>
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <StatusBar style={theme.dark ? 'light' : 'dark'} />
          {showUpdateBanner ? (
            <AppUpdateBanner
              remote={updateBanner.remote!}
              download={updateBanner.download}
              onDismiss={updateBanner.dismiss}
            />
          ) : null}
          <ScenarioRecoveryBanner />
          <DataUnavailableScreen />
        </View>
      </AppUpdateBannerLayoutProvider>
    );
  }

  return (
    <AppUpdateBannerLayoutProvider visible={showUpdateBanner}>
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          {showUpdateBanner ? (
            <AppUpdateBanner
              remote={updateBanner.remote!}
              download={updateBanner.download}
              onDismiss={updateBanner.dismiss}
            />
          ) : null}
          <ScenarioRecoveryBanner />
          <View
            style={{ flex: 1 }}
            pointerEvents={performanceAuditActive ? 'none' : 'auto'}
            accessibilityElementsHidden={performanceAuditActive}
            importantForAccessibility={
              performanceAuditActive ? 'no-hide-descendants' : 'auto'
            }
          >
            <StatusBar style={theme.dark ? 'light' : 'dark'} />
            <NavigationMenuProvider>
            {breadcrumbVisible ? <AppBreadcrumbBar /> : null}
            <NavigatorSafeArea topInsetConsumed={showUpdateBanner || breadcrumbVisible}>
            <View style={{ flex: 1 }}>
              <Stack
                screenOptions={{
                  freezeOnBlur: true,
                  headerStyle: { backgroundColor: theme.colors.surface },
                  headerTitleStyle: {
                    color: theme.colors.text,
                    ...HEADER_TYPOGRAPHY,
                  },
                  headerTintColor: theme.colors.primary,
                  headerBackTitle: 'Back',
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: theme.colors.bg },
                  ...androidHeader,
                  // Native Android toolbars force a window-level top inset in
                  // edge-to-edge mode. A JS header respects the consumed inset.
                  header: showUpdateBanner || breadcrumbVisible
                    ? ({ options, route, back }) => (
                      <Header
                        title={routeTitle(route.name,pathname)}
                        headerStyle={options.headerStyle}
                        headerTitleStyle={options.headerTitleStyle}
                        headerTitleAlign={options.headerTitleAlign}
                        headerTintColor={options.headerTintColor}
                        headerShadowVisible={options.headerShadowVisible}
                        headerRight={() => <NavigationMenuButton />}
                        back={options.headerBackVisible === false ? undefined : back && {
                          title: uiLabel('Back'), href: back.href,
                        }}
                        headerStatusBarHeight={0}
                      />
                    )
                    : undefined,
                  headerRight: () => <NavigationMenuButton />,
                }}
              >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="node" options={{ title: 'Rates' }} />
              <Stack.Screen name="categories" options={{ title: 'Rates' }} />
              <Stack.Screen name="matches" options={{ title: 'Rates' }} />
              <Stack.Screen name="catalogue" options={{ title: 'Rates' }} />
              <Stack.Screen name="bank-rates" options={{ title: 'Bank rates' }} />
              <Stack.Screen name="passthrough" options={{ title: 'Market' }} />
              <Stack.Screen name="search" options={{ title: 'Search' }} />
              <Stack.Screen name="product/[key]" options={{ title: 'Product', headerBackTitle: 'Back' }} />
              <Stack.Screen name="bank/[provider]" options={{ title: 'Bank' }} />
              <Stack.Screen name="banks" options={{ title: 'Banks' }} />
              <Stack.Screen name="compare" options={{ title: 'Compare', presentation: 'modal' }} />
              <Stack.Screen name="calculator" options={{ title: 'Calculate' }} />
              <Stack.Screen name="calculation-receipt" options={{ title: 'Open calculation receipt' }} />
              <Stack.Screen name="projections" options={{ title: 'Calculate' }} />
              <Stack.Screen name="rba-response" options={{ title: 'Bank response' }} />
              <Stack.Screen
                name="rate-receipt"
                options={{ title: 'Bank-call brief' }}
              />
              <Stack.Screen
                name="rba"
                options={{ title: 'RBA', animation: 'none' }}
              />
              <Stack.Screen name="profile" options={{ title: 'Profile' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              <Stack.Screen name="research" options={{ title: 'Market research' }} />
              <Stack.Screen name="trends" options={{ headerShown: false }} />
              <Stack.Screen name="about" options={{ title: 'About' }} />
              <Stack.Screen
                name="third-party-notices"
                options={{ title: 'Open-source notices' }}
              />
              <Stack.Screen
                name="performance-audit"
                options={{ title: 'App health audit' }}
              />
              <Stack.Screen name="debug-log" options={{ title: 'Debug log' }} />
              <Stack.Screen name="terms" options={{ title: 'Terms' }} />
              </Stack>
            </View>
            </NavigatorSafeArea>
            <AppTabBar />
            <AppNavigationMenu />
            </NavigationMenuProvider>
          </View>
          <PerformanceAuditRunner />
        </View>
      </AppUpdateBannerLayoutProvider>
  );
}

export default function RootLayout() {
  // This is the first UI-root task. It does not run merely because Android
  // launches a headless background worker, and React does not remount it when
  // the existing Activity is only backgrounded and reopened.
  coldStartLogReset ??= debugLog.beginColdStartSession();
  const [fontsLoaded, fontError] = useFonts(Platform.OS === 'android' ? {} : {
    Commissioner_400Regular: require('../assets/fonts/Commissioner-Regular.ttf'),
    Commissioner_500Medium: require('../assets/fonts/Commissioner-Medium.ttf'),
    Commissioner_600SemiBold: require('../assets/fonts/Commissioner-SemiBold.ttf'),
    Commissioner_700Bold: require('../assets/fonts/Commissioner-Bold.ttf'),
  });

  useEffect(() => {
    if (fontError) {
      debugLog.error('fonts', 'Bundled fonts unavailable; using platform font fallbacks.');
    }
  }, [fontError]);

  if (Platform.OS !== 'android' && !fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppLockGate>
            <TrustedExternalUrlProvider>
              <RootNavigator />
            </TrustedExternalUrlProvider>
          </AppLockGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
