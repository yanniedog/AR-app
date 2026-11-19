import { uiDurationClock, uiJoin, uiLabel, uiLoadAttemptTime, uiLoadFailureStatus } from '../lib/uiCopy';
import Ionicons from './icons/AppIcon';
import * as Network from 'expo-network';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { useStore } from '../data/store';
import { autoRetryDelayMs } from '../data/loadFailure';
import { connectivityFromNetworkState, type Connectivity } from '../lib/dataUnavailableCopy';
import { startAppUpdate } from '../lib/startAppUpdate';
import { useTheme } from '../theme/ThemeProvider';
import { BrandLockup } from './BrandLockup';
import { Screen } from './Screen';
import { AppText, Button } from './ui';

/**
 * Automatic recovery while the unavailable state is visible: backoff
 * 2, 5, 15, 30, then every 60 s, plus an immediate attempt when the network
 * comes back or the app returns to the foreground. Returns the due time.
 */
function useAutomaticRetry(enabled: boolean, busy: boolean, connectivity: Connectivity, retry: () => void): number | null {
  const attempts = useRef(0);
  const [dueAt, setDueAt] = useState<number | null>(null);
  const retryRef = useRef(retry);
  retryRef.current = retry;
  const wasBusy = useRef(busy);

  // Count each settled attempt so the next one backs off further.
  useEffect(() => {
    if (wasBusy.current && !busy) attempts.current += 1;
    wasBusy.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!enabled || busy) {
      setDueAt(null);
      return;
    }
    const delay = autoRetryDelayMs(attempts.current);
    setDueAt(Date.now() + delay);
    const timer = setTimeout(() => retryRef.current(), delay);
    return () => clearTimeout(timer);
  }, [enabled, busy]);

  const previousConnectivity = useRef(connectivity);
  useEffect(() => {
    const previous = previousConnectivity.current;
    previousConnectivity.current = connectivity;
    if (enabled && !busy && previous === 'offline' && connectivity === 'online') retryRef.current();
  }, [connectivity, enabled, busy]);

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled && !busy;
  useEffect(() => {
    let last = AppState.currentState;
    const sub = AppState.addEventListener?.('change', (next) => {
      const resumed = last !== 'active' && next === 'active';
      last = next;
      if (resumed && enabledRef.current) retryRef.current();
    });
    return () => sub?.remove();
  }, []);

  return dueAt;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/** Recovery state when store.status === 'error' (no usable payload). */
export function DataUnavailableScreen() {
  const theme = useTheme();
  const refreshing = useStore((s) => s.refreshing);
  const retrying = useStore((s) => s.retrying);
  const loadFailure = useStore((s) => s.loadFailure);
  const retryDataLoad = useStore((s) => s.retryDataLoad);
  const busy = !!(refreshing || retrying);
  const [connectivity, setConnectivity] = useState<Connectivity>(null);
  useEffect(() => {
    let active = true;
    let receivedNetworkEvent = false;
    const subscription = Network.addNetworkStateListener((state) => {
      if (!active) return;
      receivedNetworkEvent = true;
      setConnectivity(connectivityFromNetworkState(state));
    });
    // Events observed after subscription are newer than this initial snapshot.
    Network.getNetworkStateAsync().then(
      (state) => { if (active && !receivedNetworkEvent) setConnectivity(connectivityFromNetworkState(state)); },
      () => { if (active && !receivedNetworkEvent) setConnectivity(null); },
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const updateRequired = loadFailure?.kind === 'update';
  // An incompatible app cannot recover by retrying; offline waits for the network event.
  const autoRetryEnabled = !updateRequired && connectivity !== 'offline';
  const dueAt = useAutomaticRetry(autoRetryEnabled, busy, connectivity,
    () => void retryDataLoad({ automatic: true }));
  const now = useNow(dueAt != null);
  const [updating, setUpdating] = useState(false);

  return (
    <Screen style={{ justifyContent: 'center', paddingHorizontal: 28 }}>
      <View
        style={{
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.xl,
          padding: 24,
          alignItems: 'center',
          maxWidth: 420,
          width: '100%',
          alignSelf: 'center',
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <BrandLockup markSize={32} style={{ marginBottom: 20 }} />
        <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.primary} />
        <AppText variant="h2" style={{ marginTop: 14, textAlign: 'center' }}>{uiLabel("Data unavailable")}</AppText>
        <AppText variant="small" color="textMuted" style={{ marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
          {uiLabel(connectivity === 'offline' ? 'Offline' : connectivity === 'online' ? 'Online' : 'Unknown')}
        </AppText>
        {loadFailure ? (
          <>
            <AppText variant="small" weight="700" style={{ marginTop: 4, textAlign: 'center' }}>
              {uiLoadFailureStatus(loadFailure)}
            </AppText>
            <AppText variant="small" color="textMuted" style={{ marginTop: 4, textAlign: 'center' }}>
              {uiJoin('Last attempt', ': ', uiLoadAttemptTime(loadFailure))}
            </AppText>
          </>
        ) : null}
        {dueAt != null ? (
          <AppText variant="small" color="textMuted" style={{ marginTop: 4, textAlign: 'center' }}>
            {uiJoin('Retry', ' ', uiDurationClock(Math.max(0, dueAt - now)))}
          </AppText>
        ) : null}
        <View style={{ marginTop: 22, width: '100%', gap: 10 }}>
          {updateRequired ? (
            <Button title="Update" icon="download-outline" loading={updating} disabled={updating}
              onPress={() => {
                setUpdating(true);
                void startAppUpdate().finally(() => setUpdating(false));
              }} />
          ) : null}
          <Button title="Try again" icon="refresh" variant={updateRequired ? 'secondary' : undefined}
            onPress={() => void retryDataLoad()} loading={busy} disabled={busy} />
        </View>
      </View>
    </Screen>
  );
}
