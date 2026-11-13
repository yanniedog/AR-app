import { useEffect, useRef } from 'react';

/** A frozen screen can return without a blur render or a new list revision. */
export function useFocusMeasurement(
  navigation: { addListener?: (event: 'focus', listener: () => void) => () => void },
  enabled: boolean,
  measure: () => void,
) {
  const latest = useRef(measure);
  latest.current = measure;
  useEffect(() => {
    if (!enabled) return;
    let frame: number | null = null;
    const unsubscribe = navigation.addListener?.('focus', () => {
      if (frame !== null) cancelAnimationFrame(frame);
      // Wait for the focused native tree. The measurement revokes old proof and
      // uses actual viewport/cell bounds; focus itself is never visibility proof.
      frame = requestAnimationFrame(() => { frame = null; latest.current(); });
    });
    return () => { unsubscribe?.(); if (frame !== null) cancelAnimationFrame(frame); };
  }, [enabled, navigation]);
}
