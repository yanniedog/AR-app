import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { usePerformanceAuditRunGate } from '../src/hooks/usePerformanceAuditRunGate';

/**
 * Mirrors how PerformanceAuditRunner drives the gate: one effect keyed on the
 * queued session plus the gate's releaseCount, a claim before the run starts,
 * and a release once teardown finishes.
 */
function renderGatedRunner(): {
  started: string[];
  queue: (sessionId: string | null) => void;
  finishRun: () => void;
} {
  const started: string[] = [];
  let finishCurrentRun: (() => void) | null = null;
  let setSession: ((sessionId: string | null) => void) | null = null;

  function Harness() {
    const [sessionId, setSessionId] = React.useState<string | null>(null);
    const { claim, release, releaseCount } = usePerformanceAuditRunGate();
    setSession = setSessionId;

    useEffect(() => {
      if (!sessionId) return;
      if (!claim(sessionId)) return;
      started.push(sessionId);
      // Teardown outlives the run's terminal state while rollback restoration
      // completes in the runner.
      finishCurrentRun = release;
    }, [claim, release, releaseCount, sessionId]);

    return null;
  }

  act(() => {
    TestRenderer.create(React.createElement(Harness));
  });

  return {
    started,
    queue: (sessionId) => act(() => setSession?.(sessionId)),
    finishRun: () => act(() => finishCurrentRun?.()),
  };
}

describe('performance audit run gate', () => {
  it('runs a queued audit immediately when no run holds the gate', () => {
    const runner = renderGatedRunner();

    runner.queue('session-a');

    expect(runner.started).toEqual(['session-a']);
  });

  it('never starts two runs at once', () => {
    const runner = renderGatedRunner();

    runner.queue('session-a');
    runner.queue('session-b');

    expect(runner.started).toEqual(['session-a']);
  });

  it('starts an audit requested during the previous run teardown', () => {
    const runner = renderGatedRunner();

    runner.queue('session-a');
    // The report is already published, so the screen can queue another run
    // while the first run is still restoring state.
    runner.queue('session-b');
    expect(runner.started).toEqual(['session-a']);

    runner.finishRun();

    // Without the gate's releaseCount nothing re-triggers the effect and
    // session-b stays queued forever.
    expect(runner.started).toEqual(['session-a', 'session-b']);
  });

  it('does not re-run the same session after its own release', () => {
    const runner = renderGatedRunner();

    runner.queue('session-a');
    runner.finishRun();

    expect(runner.started).toEqual(['session-a']);
  });
});
