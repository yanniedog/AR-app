import React, { useEffect } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { useDeferredHistorySurface } from '../src/hooks/useDeferredHistorySurface';
import { yieldToPaintFrames } from '../src/lib/yieldToUi';
let mockPaint: (() => void)[] = [];
jest.mock('../src/lib/yieldToUi', () => ({
  scheduleAfterInteractions: (work: () => void) => { const handle = setTimeout(work, 0); return () => clearTimeout(handle); },
  yieldToPaintFrames: jest.fn(() => new Promise<void>(resolve => mockPaint.push(resolve))),
}));
function Probe({ resetKey, onReady }: { resetKey: string; onReady: (ready: boolean) => void }) {
  const ready = useDeferredHistorySurface(resetKey);
  useEffect(() => { onReady(ready); }, [onReady, ready]);
  return null;
}
afterEach(() => { mockPaint = []; jest.useRealTimers(); });

test('history waits for paint and invalidates immediately for a different product or bank', async () => {
  jest.useFakeTimers(); const seen: boolean[] = []; let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe resetKey="nab" onReady={value => { seen.push(value); }} />); });
  expect(seen.at(-1)).toBe(false);
  await act(async () => { jest.runOnlyPendingTimers(); });
  expect(yieldToPaintFrames).toHaveBeenLastCalledWith(2);
  expect(seen.at(-1)).toBe(false);
  await act(async () => { mockPaint.shift()!(); });
  expect(seen.at(-1)).toBe(true);
  act(() => { tree.update(<Probe resetKey="cba" onReady={value => { seen.push(value); }} />); });
  expect(seen.at(-1)).toBe(false);
  await act(async () => { jest.runOnlyPendingTimers(); });
  act(() => tree.unmount());
  await act(async () => { mockPaint.shift()!(); });
  expect(seen.at(-1)).toBe(false);
});

test('an older in-flight paint cannot enable history for the replacement key', async () => {
  jest.useFakeTimers(); const seen: boolean[] = []; let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe resetKey="old" onReady={value => { seen.push(value); }} />); });
  await act(async () => { jest.runOnlyPendingTimers(); });
  act(() => { tree.update(<Probe resetKey="new" onReady={value => { seen.push(value); }} />); });
  await act(async () => { jest.runOnlyPendingTimers(); mockPaint.shift()!(); });
  expect(seen.at(-1)).toBe(false);
  await act(async () => { mockPaint.shift()!(); });
  expect(seen.at(-1)).toBe(true);
  act(() => tree.unmount());
});
