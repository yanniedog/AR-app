import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Mirrors the operating-system reduce-motion preference and updates live. */
export function useReducedMotion(): boolean {
  // Be conservative until the asynchronous native preference resolves: no
  // first-frame animation is preferable to flashing motion at opted-out users.
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => {
        if (active) setEnabled(true);
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
