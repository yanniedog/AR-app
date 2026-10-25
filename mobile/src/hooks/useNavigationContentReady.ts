import { useEffect, useState } from 'react';

import { scheduleAfterInteractions } from '../lib/yieldToUi';

/**
 * Gate expensive screen derivations until the inbound navigation/gesture has
 * had a chance to paint. Layout and local-state readiness probes should not
 * wait on this flag; list/graphic probes that need the deferred work should.
 */
export function useNavigationContentReady(active: boolean = true): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    let mounted = true;
    const cancel = scheduleAfterInteractions(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
      cancel();
      setReady(false);
    };
  }, [active]);
  return ready;
}
