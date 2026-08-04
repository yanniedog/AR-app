import { useEffect, useRef } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

/** Draws once when motion is already known to be allowed. */
export function useFirstMountDrawIn(reducedMotion: boolean | null, duration: number) {
  const progress = useSharedValue(0);
  const started = useRef(false);

  useEffect(() => {
    if (reducedMotion === null) return;
    if (reducedMotion) {
      progress.value = 1;
      started.current = true;
      return;
    }
    if (started.current) return;
    started.current = true;
    progress.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
  }, [duration, progress, reducedMotion]);

  return progress;
}
