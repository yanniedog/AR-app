import { useNavigationContainerRef } from 'expo-router';
import { useEffect, useRef } from 'react';

/** Defer cold-entry navigation until the same container guard used by Expo Router passes. */
export function useReadyNavigationEffect(effect: () => void): void {
  const navigation = useNavigationContainerRef();
  const deliveredEffect = useRef<(() => void) | null>(null);
  useEffect(() => {
    let active = true;
    const run = () => {
      if (!active || deliveredEffect.current === effect || !navigation.isReady()) return;
      deliveredEffect.current = effect;
      effect();
    };
    const stopReady = navigation.addListener('ready', run);
    const stopState = navigation.addListener('state', run);
    run();
    return () => {
      active = false;
      stopReady();
      stopState();
    };
  }, [effect, navigation]);
}
