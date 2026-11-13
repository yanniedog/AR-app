import { useEffect, useState } from 'react';

import { scheduleAfterInteractions, yieldToPaintFrames } from '../lib/yieldToUi';

/** Keep history work behind real navigation paint opportunities. Terminal
 * audit evidence observes this work; no delay is tuned to its quiet window. */
export function useDeferredHistorySurface(resetKey: string | null | undefined): boolean {
  const [readyKey, setReadyKey] = useState<string | null>(null);

  useEffect(() => {
    setReadyKey(null);
    if (resetKey == null || resetKey === '') return;

    let cancelled = false;
    const cancelInteractions = scheduleAfterInteractions(() => {
      void yieldToPaintFrames(2).then(() => {
        if (!cancelled) setReadyKey(resetKey);
      });
    });

    return () => {
      cancelled = true;
      cancelInteractions();
    };
  }, [resetKey]);

  return resetKey != null && resetKey !== '' && readyKey === resetKey;
}
