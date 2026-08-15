import { MaterialSymbols_400Regular } from '@expo-google-fonts/material-symbols/400Regular';
import { MaterialSymbolsOutlined_400Regular } from '@expo-google-fonts/material-symbols-outlined/400Regular';
import * as Application from 'expo-application';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, router, usePathname, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLockGate } from '../src/components/AppLockGate';
import {
  AppNavigationMenu,
  NavigationMenuButton,
  NavigationMenuProvider,
} from '../src/components/AppNavigationMenu';
import { AppTabBar } from '../src/components/AppTabBar';
import {
  AppUpdateBanner,
  AppUpdateBannerLayoutProvider,
  useAppUpdateBanner,
} from '../src/components/AppUpdateBanner';
import { ArMarkLogo } from '../src/components/ArMarkLogo';
import { SplashMorphProvider, type SplashMorphTarget } from '../src/components/BrandLockup';
import { DataUnavailableScreen } from '../src/components/DataUnavailableScreen';
import { DiagnosticsConsentBanner } from '../src/components/DiagnosticsConsentBanner';
import { ErrorScreen } from '../src/components/ErrorScreen';
import { TrustedExternalUrlProvider } from '../src/components/ExternalLinkConfirmation';
import {
  PerformanceAuditRunner,
  usePerformanceAuditActiveState,
} from '../src/components/PerformanceAuditRunner';
import { AppText } from '../src/components/ui';
import { registerBackgroundRefresh, routeFromNotificationResponse } from '../src/data/notifications';
import { useStore } from '../src/data/store';
import { shouldRefreshOnResume } from '../src/data/resumeRefresh';
import { CURRENT_PRIVACY_CHOICE_VERSION } from '../src/data/storeTypes';
import { androidStackScreenOptions } from '../src/lib/androidChrome';
import { shouldShowAppTabBar } from '../src/lib/tabRouting';
import { useReducedMotion } from '../src/hooks/useReducedMotion';
import { debugLog, formatErrorTrace, installGlobalErrorHandlers } from '../src/lib/debugLog';
import { logSwallowedError } from '../src/lib/degradationLog';
import {
  setCrashReportsEnabled,
  setSessionReplayEnabled,
} from '../src/lib/observability';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

// Gives cold-start deep links a real back destination instead of relying on
// the bottom bar that focused routes deliberately hide.
export const unstable_settings = {
  initialRouteName: 'index',
};

let coldStartLogReset: Promise<void> | null = null;
SplashScreen.preventAutoHideAsync().catch((err) => logSwallowedError('splash.preventAutoHide', err));

const SPLASH_MARK = 88;
const MORPH_MS = 680;
const FADE_MS = 320;

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

function BrandedSplashOverlay({
  visible,
  morphTarget,
  onboarded,
  onMorphComplete,
}: {
  visible: boolean;
  morphTarget: SplashMorphTarget | null;
  onboarded: boolean;
  onMorphComplete: () => void;
}) {
  const theme = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const progress = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);
  const [morphWaitExpired, setMorphWaitExpired] = useState(false);
  const reducedMotion = useReducedMotion();

  const finish = useCallback(() => {
    onMorphComplete();
  }, [onMorphComplete]);

  useEffect(() => {
    if (!visible) return;
    progress.value = 0;
    overlayOpacity.value = 1;
    setMorphWaitExpired(false);
  }, [visible, overlayOpacity, progress]);

  useEffect(() => {
    if (!visible || !onboarded || morphTarget) return;
    const timer = setTimeout(() => setMorphWaitExpired(true), 450);
    return () => clearTimeout(timer);
  }, [visible, onboarded, morphTarget]);

  // Hard ceiling so a missed Reanimated completion callback cannot leave the
  // splash mark floating over Home forever.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => finish(), MORPH_MS + FADE_MS + 500);
    return () => clearTimeout(timer);
  }, [visible, finish]);

  useEffect(() => {
    if (!visible) return;
    const canMorph = onboarded && morphTarget != null;
    const shouldFade = !onboarded || morphWaitExpired;
    if (!canMorph && !shouldFade) return;
    if (reducedMotion == null) return;

    if (reducedMotion) {
      progress.value = canMorph ? 1 : 0;
      overlayOpacity.value = 0;
      finish();
      return;
    }

    if (canMorph) {
      progress.value = withTiming(1, { duration: MORPH_MS, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) {
          overlayOpacity.value = withTiming(0, { duration: 120 }, (faded) => {
            if (faded) runOnJS(finish)();
          });
        }
      });
      return;
    }
    overlayOpacity.value = withTiming(0, { duration: FADE_MS }, (done) => {
      if (done) runOnJS(finish)();
    });
  }, [visible, onboarded, morphTarget, morphWaitExpired, finish, overlayOpacity, progress, reducedMotion]);

  const startX = screenW / 2 - SPLASH_MARK / 2;
  const startY = screenH / 2 - SPLASH_MARK / 2 - 28;
  const endScale = morphTarget ? morphTarget.markSize / SPLASH_MARK : 1;

  const markStyle = useAnimatedStyle(() => {
    if (!morphTarget || !onboarded) {
      return {
        opacity: overlayOpacity.value,
        transform: [{ translateX: startX }, { translateY: startY }],
      };
    }
    const t = progress.value;
    return {
      opacity: overlayOpacity.value,
      transform: [
        { translateX: startX + (morphTarget.x - startX) * t },
        { translateY: startY + (morphTarget.y - startY) * t },
        { scale: 1 + (endScale - 1) * t },
      ],
    };
  }, [morphTarget, onboarded, startX, startY, endScale]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value * (1 - progress.value),
    transform: [{ translateY: progress.value * 12 }],
  }));

  const shellStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: theme.colors.bg, zIndex: 100, alignItems: 'center', justifyContent: 'center' },
        shellStyle,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            width: SPLASH_MARK,
            height: SPLASH_MARK,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
          markStyle,
        ]}
      >
        <ArMarkLogo size={SPLASH_MARK - 8} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: screenH / 2 + SPLASH_MARK / 2 - 4 }, titleStyle]}>
        <AppText variant="h2" weight="700" style={{ letterSpacing: -0.3 }}>
          AustralianRates
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const status = useStore((s) => s.status);
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.prefs.onboarded);
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
  const [morphComplete, setMorphComplete] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [morphTarget, setMorphTarget] = useState<SplashMorphTarget | null>(null);

  const appReady = hydrated && (status === 'ready' || status === 'error');
  const updateBanner = useAppUpdateBanner(appReady);
  const showUpdateBanner = updateBanner.visible && updateBanner.remote != null;

  const privacyChoiceCurrent = privacyChoiceVersion === CURRENT_PRIVACY_CHOICE_VERSION;
  // Reserve the tab-bar strip only on the four destination roots. Focused
  // stack routes and auxiliary settings use the full viewport.
  const tabBarVisible = shouldShowAppTabBar(pathname, onboarded);

  useLayoutEffect(() => {
    if (!hydrated) return;
    void setCrashReportsEnabled(privacyChoiceCurrent && crashReportsEnabled);
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

  const confirmDiagnosticsChoice = useCallback(
    (crashReports: boolean) => {
      setPref('crashReportsEnabled', crashReports);
      setPref('sessionReplayEnabled', false);
      setPref('privacyChoiceVersion', CURRENT_PRIVACY_CHOICE_VERSION);
    },
    [setPref],
  );

  // Consent is only ever recorded from an explicit tap on the banner's own
  // buttons. Session replay remains disabled, so "Allow" grants exactly what
  // the banner names: crash reports only.
  const acceptDiagnostics = useCallback(() => {
    if (privacyChoiceCurrent) return;
    confirmDiagnosticsChoice(true);
  }, [confirmDiagnosticsChoice, privacyChoiceCurrent]);

  const declineDiagnostics = useCallback(() => {
    confirmDiagnosticsChoice(false);
  }, [confirmDiagnosticsChoice]);

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

  const registerTarget = useCallback((target: SplashMorphTarget) => {
    setMorphTarget((prev) => prev ?? target);
  }, []);

  const handleMorphComplete = useCallback(() => {
    setMorphComplete(true);
    setOverlayVisible(false);
  }, []);

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
          <DataUnavailableScreen />
          <DiagnosticsConsentBanner
            visible={appReady && !privacyChoiceCurrent}
            onAccept={acceptDiagnostics}
            onDecline={declineDiagnostics}
          />
        </View>
      </AppUpdateBannerLayoutProvider>
    );
  }

  return (
    <SplashMorphProvider
      morphComplete={morphComplete}
      setMorphComplete={setMorphComplete}
      registerTarget={registerTarget}
    >
      <AppUpdateBannerLayoutProvider visible={showUpdateBanner}>
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          {showUpdateBanner ? (
            <AppUpdateBanner
              remote={updateBanner.remote!}
              download={updateBanner.download}
              onDismiss={updateBanner.dismiss}
            />
          ) : null}
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
            <View style={{ flex: 1 }}>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: theme.colors.surface },
                  headerTitleStyle: { color: theme.colors.text },
                  headerTintColor: theme.colors.primary,
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: theme.colors.bg },
                  ...androidHeader,
                  ...(showUpdateBanner ? { headerStatusBarHeight: 0 } : {}),
                  headerRight: () => <NavigationMenuButton />,
                }}
              >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="node" options={{ title: 'Explore' }} />
              <Stack.Screen name="search" options={{ title: 'Search' }} />
              <Stack.Screen name="product/[key]" options={{ title: 'Product', headerBackTitle: 'Back' }} />
              <Stack.Screen name="bank/[provider]" options={{ title: 'Bank' }} />
              <Stack.Screen name="banks" options={{ title: 'Banks' }} />
              <Stack.Screen name="compare" options={{ title: 'Compare', presentation: 'modal' }} />
              <Stack.Screen name="calculator" options={{ title: 'My scenario' }} />
              <Stack.Screen name="projections" options={{ title: 'What if rates change?' }} />
              <Stack.Screen name="rba-response" options={{ title: 'Bank response', headerBackTitle: 'Changes' }} />
              <Stack.Screen
                name="rate-receipt"
                options={{ title: 'Bank-call brief', headerBackTitle: 'Product' }}
              />
              <Stack.Screen
                name="rba"
                options={{ title: 'Why rates move', animation: 'none', headerShown: false }}
              />
              <Stack.Screen name="profile" options={{ title: 'Your profile' }} />
              <Stack.Screen name="about" options={{ title: 'About' }} />
              <Stack.Screen
                name="performance-audit"
                options={{ title: 'Performance audit', headerBackTitle: 'About' }}
              />
              <Stack.Screen name="debug-log" options={{ title: 'Debug log', headerBackTitle: 'About' }} />
              <Stack.Screen name="terms" options={{ title: 'Terms', headerBackTitle: 'About' }} />
              </Stack>
              {appReady ? (
                <BrandedSplashOverlay
                  visible={overlayVisible}
                  morphTarget={morphTarget}
                  onboarded={onboarded}
                  onMorphComplete={handleMorphComplete}
                />
              ) : null}
            </View>
            <AppTabBar />
            <AppNavigationMenu />
            </NavigationMenuProvider>
          </View>
          <PerformanceAuditRunner />
          <DiagnosticsConsentBanner
            visible={appReady && !privacyChoiceCurrent}
            aboveTabBar={tabBarVisible}
            onAccept={acceptDiagnostics}
            onDecline={declineDiagnostics}
          />
        </View>
      </AppUpdateBannerLayoutProvider>
    </SplashMorphProvider>
  );
}

export default function RootLayout() {
  // This is the first UI-root task. It does not run merely because Android
  // launches a headless background worker, and React does not remount it when
  // the existing Activity is only backgrounded and reopened.
  coldStartLogReset ??= debugLog.beginColdStartSession();
  const [fontsLoaded] = useFonts({
    MaterialSymbolsOutlined_400Regular,
    MaterialSymbols_400Regular,
  });

  if (Platform.OS === 'android' && !fontsLoaded) {
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
