import { useEffect, useState } from 'react';

import { scheduleAfterInteractions } from '../lib/yieldToUi';

/**
 * Gate expensive screen derivations until the inbound navigation/gesture has
 * had a chance to paint. Layout and local-state readiness probes should not
 * wait on this flag; list/graphic probes that need the deferred work should.
 *
 * When `latchAfterReady` is true, the first ready paint sticks across blur so
 * web/stack screens that keep rendering inactive routes do not unmount prepared
 * content and reset scroll or local panel state.
 */
export function useNavigationContentReady(
  active: boolean = true,
  { latchAfterReady = false }: { latchAfterReady?: boolean } = {},
): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active) {
      if (!latchAfterReady) setReady(false);
      return;
    }
    let mounted = true;
    const cancel = scheduleAfterInteractions(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
      cancel();
      if (!latchAfterReady) setReady(false);
    };
  }, [active, latchAfterReady]);
  return ready;
}
