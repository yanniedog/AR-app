import { useEffect, useRef } from 'react';

type FocusableNavigation = {
  addListener?: (event: any, listener: () => void) => (() => void) | void;
  getParent?: () => FocusableNavigation | undefined;
};

/** A frozen screen can return without a blur render or a new list revision. */
export function useFocusMeasurement(
  navigation: FocusableNavigation,
  enabled: boolean,
  measure: () => void,
) {
  const latest = useRef(measure);
  latest.current = measure;
  useEffect(() => {
    if (!enabled) return;
    let frame: number | null = null;
    const trigger = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      // Wait for the focused native tree. The measurement revokes old proof and
      // uses actual viewport/cell bounds; focus itself is never visibility proof.
      frame = requestAnimationFrame(() => { frame = null; latest.current(); });
    };
    const unsubscribes: (((() => void) | void))[] = [];
    for (let current: FocusableNavigation | undefined = navigation; current; current = current.getParent?.()) {
      unsubscribes.push(current.addListener?.('focus', trigger));
      if (current !== navigation) unsubscribes.push(current.addListener?.('transitionEnd', trigger));
    }
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe?.();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [enabled, navigation]);
}
