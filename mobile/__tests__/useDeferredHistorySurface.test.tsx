import React, { useEffect } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { useDeferredHistorySurface } from '../src/hooks/useDeferredHistorySurface';

jest.mock('../src/lib/yieldToUi', () => ({
  scheduleAfterInteractions: (work: () => void) => {
    const handle = setTimeout(work, 0);
    return () => clearTimeout(handle);
  },
  yieldToPaintFrames: jest.fn(async () => undefined),
}));

function Probe({ resetKey, onReady }: { resetKey: string; onReady: (ready: boolean) => void }) {
  const ready = useDeferredHistorySurface(resetKey);
  useEffect(() => {
    onReady(ready);
  }, [onReady, ready]);
  return null;
}

test('history surface stays false on first paint then becomes ready after deferral', async () => {
  jest.useFakeTimers();
  const seen: boolean[] = [];
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <Probe resetKey="nab" onReady={(ready) => { seen.push(ready); }} />,
    );
  });
  expect(seen.at(-1)).toBe(false);

  await act(async () => {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  });
  expect(seen.at(-1)).toBe(false);

  await act(async () => {
    jest.advanceTimersByTime(749);
    await Promise.resolve();
  });
  expect(seen.at(-1)).toBe(false);

  await act(async () => {
    jest.advanceTimersByTime(1);
    await Promise.resolve();
  });
  expect(seen.at(-1)).toBe(true);

  await act(async () => {
    tree.update(<Probe resetKey="cba" onReady={(ready) => { seen.push(ready); }} />);
  });
  expect(seen.at(-1)).toBe(false);

  act(() => {
    tree.unmount();
  });
  jest.useRealTimers();
});
