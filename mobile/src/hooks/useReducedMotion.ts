import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let enabled: boolean | null = null;
let generation = 0;
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | null = null;
const listeners = new Set<() => void>();

function publish(value: boolean) {
  if (enabled === value) return;
  enabled = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!subscription) {
    const currentGeneration = ++generation;
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      // A newer OS event must win over an in-flight initial preference read.
      ++generation;
      publish(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (currentGeneration === generation) publish(value);
      })
      .catch(() => {
        if (currentGeneration === generation) publish(true);
      });
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      ++generation;
      subscription?.remove();
      subscription = null;
      enabled = null;
    }
  };
}

/** All controls share one OS subscription; unknown state suppresses animation. */
export function useReducedMotion(): boolean | null {
  return useSyncExternalStore(subscribe, () => enabled, () => null);
}
