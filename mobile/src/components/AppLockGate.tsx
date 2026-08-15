import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

import { useStore } from '../data/store';
import { authenticateBiometric } from '../lib/appLock';
import { setAppLockScreenProtection } from '../lib/appLockScreenProtection';
import {
  createAppLockState,
  normalizeAppLockLifecycle,
  reduceAppLockState,
  shouldAutomaticallyPrompt,
  type AppLockEvent,
  type AppLockPromptKind,
} from '../lib/appLockState';
import { debugLog } from '../lib/debugLog';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button } from './ui';

/**
 * Biometric gate for cold start and every foreground transition. Private
 * children remain mounted to preserve navigation state, but an opaque Android
 * modal or iOS full-window overlay obscures them (including any other open
 * native modal) as soon as the app becomes inactive/backgrounded.
 * Authentication results are epoch-bound so a late success from an older
 * foreground session cannot reveal a newer one.
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const hydrated = useStore((s) => s.hydrated);
  const enabled = useStore((s) => s.prefs.appLockEnabled);
  const required = hydrated && enabled;
  const [machine, setMachine] = useState(() =>
    createAppLockState(required, normalizeAppLockLifecycle(AppState.currentState)),
  );
  const machineRef = useRef(machine);
  const activeTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transition = useCallback((event: AppLockEvent) => {
    const previous = machineRef.current;
    const next = reduceAppLockState(previous, event);
    if (next !== previous) {
      machineRef.current = next;
      setMachine(next);
    }
    return { previous, next };
  }, []);

  const prompt = useCallback((kind: AppLockPromptKind) => {
    const { previous, next } = transition({ type: 'prompt_started', kind });
    if (next === previous || !next.promptAttempt) return;
    const attemptId = next.promptAttempt.id;
    void authenticateBiometric('Unlock Australian Rates').then((success) => {
      transition({ type: 'prompt_resolved', attemptId, success });
    });
  }, [transition]);

  useEffect(() => {
    transition({ type: 'set_required', required });
  }, [required, transition]);

  useEffect(() => {
    const applyLifecycle = (nextState: string | null | undefined) => {
      const lifecycle = normalizeAppLockLifecycle(nextState);
      if (activeTransitionTimerRef.current !== null) {
        clearTimeout(activeTransitionTimerRef.current);
        activeTransitionTimerRef.current = null;
      }
      if (lifecycle === 'active') {
        // Android may resume the host Activity just before delivering the
        // device-credential result. One task turn lets that already-queued
        // result settle while the reducer is still backgrounded. Any result
        // arriving after this strict boundary is invalidated as stale.
        activeTransitionTimerRef.current = setTimeout(() => {
          activeTransitionTimerRef.current = null;
          transition({ type: 'app_state_changed', lifecycle });
        }, 0);
        return;
      }
      transition({ type: 'app_state_changed', lifecycle });
    };
    const subscription = AppState.addEventListener('change', applyLifecycle);
    // Close the small mount-to-subscription race without generating a second
    // transition when the state is unchanged.
    applyLifecycle(AppState.currentState);
    return () => {
      if (activeTransitionTimerRef.current !== null) {
        clearTimeout(activeTransitionTimerRef.current);
        activeTransitionTimerRef.current = null;
      }
      subscription.remove();
    };
  }, [transition]);

  useEffect(() => {
    void setAppLockScreenProtection(required).catch((error) => {
      debugLog.warn(
        'appLock',
        `screen protection unavailable: ${String((error as Error)?.message ?? error)}`,
      );
    });
  }, [required]);

  useEffect(() => () => {
    void setAppLockScreenProtection(false).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (shouldAutomaticallyPrompt(machine)) prompt('automatic');
  }, [machine, prompt]);

  // Fail closed during the render before the required-state effect commits.
  const mustLock = required && (machine.required !== required || machine.locked);
  const prompting = machine.promptAttempt !== null;
  const lockContent = (
    <View
      testID="app-lock-privacy-cover"
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
      }}
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="lock-closed" size={40} color={theme.colors.primary} />
      <AppText variant="h3">Locked</AppText>
      <AppText variant="small" color="textMuted" style={{ textAlign: 'center' }}>
        Unlock with your fingerprint, face, or device PIN.
      </AppText>
      <Button
        title="Unlock"
        icon="finger-print"
        onPress={() => prompt('manual')}
        loading={prompting}
        disabled={prompting || machine.lifecycle !== 'active'}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View
        testID="app-lock-private-content"
        style={{ flex: 1 }}
        pointerEvents={mustLock ? 'none' : 'auto'}
        accessibilityElementsHidden={mustLock}
        importantForAccessibility={mustLock ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {Platform.OS === 'ios' ? (
        mustLock ? (
          <FullWindowOverlay unstable_accessibilityContainerViewIsModal>
            {lockContent}
          </FullWindowOverlay>
        ) : null
      ) : (
        <Modal
          testID="app-lock-modal"
          visible={mustLock}
          animationType="none"
          presentationStyle="fullScreen"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => undefined}
        >
          {lockContent}
        </Modal>
      )}
    </View>
  );
}
