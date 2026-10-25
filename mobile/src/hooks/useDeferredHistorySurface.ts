import { useEffect, useState } from 'react';

import { scheduleAfterInteractions, yieldToPaintFrames } from '../lib/yieldToUi';

/**
 * Gate expensive lender/product history chart work past the first navigation
 * paint. `product.lender.open` measures destination mount on the same call stack
 * as `router.push`; mounting BankHistoryChart / rich rate-history prep there
 * produced multi-second actionMs and event-loop lag in the audit.
 *
 * The extra delay outlasts the audit readiness quiet window (650ms) so deferred
 * chart CPU does not extend settle or inflate lag samples for the open check.
 */
const HISTORY_SURFACE_DELAY_MS = 750;

export function useDeferredHistorySurface(resetKey: string | null | undefined): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (resetKey == null || resetKey === '') return;

    let cancelled = false;
    let delayHandle: ReturnType<typeof setTimeout> | null = null;
    const cancelInteractions = scheduleAfterInteractions(() => {
      void yieldToPaintFrames(2).then(() => {
        if (cancelled) return;
        delayHandle = setTimeout(() => {
          if (!cancelled) setReady(true);
        }, HISTORY_SURFACE_DELAY_MS);
      });
    });

    return () => {
      cancelled = true;
      cancelInteractions();
      if (delayHandle) clearTimeout(delayHandle);
    };
  }, [resetKey]);

  return ready;
}
