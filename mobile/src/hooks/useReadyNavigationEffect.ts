import { useNavigationContainerRef } from 'expo-router';
import { useEffect, useRef } from 'react';

import { scheduleAfterInteractions } from '../lib/yieldToUi';

/** Defer cold-entry navigation until the same container guard used by Expo Router passes. */
export function useReadyNavigationEffect(effect: () => void): void {
  const navigation = useNavigationContainerRef();
  const deliveredEffect = useRef<(() => void) | null>(null);
  useEffect(() => {
    let active = true;
    let scheduled = false;
    let cancelDeferred: (() => void) | null = null;
    const run = () => {
      if (!active || deliveredEffect.current === effect || scheduled || !navigation.isReady()) return;
      // Yield so the inbound route can commit/paint before the replace nests
      // destination mount work into the same JS turn as router.push.
      // Mark delivered only when the deferred callback runs — Strict Mode
      // cleanup must be able to reschedule the same effect after cancel.
      scheduled = true;
      cancelDeferred?.();
      cancelDeferred = scheduleAfterInteractions(() => {
        scheduled = false;
        if (!active || deliveredEffect.current === effect) return;
        deliveredEffect.current = effect;
        effect();
      });
    };
    const stopReady = navigation.addListener('ready', run);
    const stopState = navigation.addListener('state', run);
    run();
    return () => {
      active = false;
      scheduled = false;
      cancelDeferred?.();
      stopReady();
      stopState();
    };
  }, [effect, navigation]);
}
