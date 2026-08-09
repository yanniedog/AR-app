import { useCallback, useRef, useState } from 'react';

export interface PerformanceAuditRunGate {
  /**
   * Changes every time a run releases the gate. Effects that start audits must
   * depend on it: teardown (rollback restore, report upload, keep-awake
   * release) outlives the audit's terminal state, so a run requested during
   * teardown finds the gate claimed and returns early — and no later
   * audit-state change re-triggers that effect, which would leave the new
   * request queued forever.
   */
  releaseCount: number;
  /**
   * Claim the gate for one session. False while another run holds it, and
   * false for a session that already ran, so the release re-trigger above can
   * never restart the run that caused it.
   */
  claim: (sessionId: string) => boolean;
  release: () => void;
}

/** Serialize audit runs so teardown can never overlap the next run. */
export function usePerformanceAuditRunGate(): PerformanceAuditRunGate {
  const activeSessionRef = useRef<string | null>(null);
  const finishedSessionRef = useRef<string | null>(null);
  const [releaseCount, setReleaseCount] = useState(0);

  const claim = useCallback((sessionId: string) => {
    if (activeSessionRef.current !== null) return false;
    if (finishedSessionRef.current === sessionId) return false;
    activeSessionRef.current = sessionId;
    return true;
  }, []);

  const release = useCallback(() => {
    if (activeSessionRef.current === null) return;
    finishedSessionRef.current = activeSessionRef.current;
    activeSessionRef.current = null;
    setReleaseCount((count) => count + 1);
  }, []);

  return { releaseCount, claim, release };
}
