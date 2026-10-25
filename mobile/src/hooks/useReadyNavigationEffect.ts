import { useNavigationContainerRef } from 'expo-router';
import { useEffect, useRef } from 'react';

import { scheduleAfterInteractions } from '../lib/yieldToUi';

/** Defer cold-entry navigation until the same container guard used by Expo Router passes. */
export function useReadyNavigationEffect(effect: () => void): void {
  const navigation = useNavigationContainerRef();
  const deliveredEffect = useRef<(() => void) | null>(null);
  useEffect(() => {
    let active = true;
    let cancelDeferred: (() => void) | null = null;
    const run = () => {
      if (!active || deliveredEffect.current === effect || !navigation.isReady()) return;
      deliveredEffect.current = effect;
      // Yield so the inbound route can commit/paint before the replace nests
      // destination mount work into the same JS turn as router.push.
      cancelDeferred?.();
      cancelDeferred = scheduleAfterInteractions(() => {
        if (active) effect();
      });
    };
    const stopReady = navigation.addListener('ready', run);
    const stopState = navigation.addListener('state', run);
    run();
    return () => {
      active = false;
      cancelDeferred?.();
      stopReady();
      stopState();
    };
  }, [effect, navigation]);
}
