import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { usePhysicalListVisibility } from '../src/hooks/usePhysicalListVisibility';
let mockGeneration = 1;
let mockListener = () => {};
jest.mock('../src/lib/performanceAuditReadiness', () => ({ performanceAuditReadinessRegistry: {
  subscribeCapture: (listener: () => void) => { mockListener = listener; return () => {}; },
  getCaptureGeneration: () => mockGeneration,
  isCapturing: () => true,
} }));
const rows = [{ key: 'one' }];
const rowKey = (row: typeof rows[number]) => row.key;
let hook!: ReturnType<typeof usePhysicalListVisibility<typeof rows[number]>>;
const measured = jest.fn();
function Probe({ revision = 'a', unobscured = true, source = rows }) {
  hook = usePhysicalListVisibility(revision, source, unobscured, rowKey, measured);
  return null;
}
type Measure = (x: number, y: number, width: number, height: number) => void;
afterEach(() => { jest.useRealTimers(); measured.mockClear(); });
test('revokes positive evidence before a delayed or dropped scroll measurement and rejects stale callbacks', () => {
  jest.useFakeTimers(); let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); jest.runOnlyPendingTimers(); });
  const bounds: Measure[] = [], cells: Measure[] = [];
  Object.assign(hook.viewport, { current: { measureInWindow: (callback: Measure) => bounds.push(callback) } });
  hook.register(rows[0], { measureInWindow: (callback: Measure) => cells.push(callback) } as never);
  act(() => { hook.measure(); bounds.shift()!(0, 0, 400, 700); cells.shift()!(0, 100, 400, 200); });
  expect(hook.visibleCount).toBe(1);
  act(() => { hook.measure(); bounds.shift()!(0, 0, 400, 700); });
  expect(hook.visibleCount).toBeNull();
  expect(measured.mock.calls.at(-1)![0].viewableItems).toEqual([]);
  const stale = cells.shift()!;
  act(() => { tree.update(<Probe revision="b" />); stale(0, 100, 400, 200); });
  expect(hook.visibleCount).toBeNull();
  act(() => tree.unmount());
});
test('capture restart and obscuring sheets invalidate same-row visibility immediately', () => {
  jest.useFakeTimers(); let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); jest.runOnlyPendingTimers(); });
  Object.assign(hook.viewport, { current: { measureInWindow: (cb: Measure) => cb(0, 0, 400, 700) } });
  hook.register(rows[0], { measureInWindow: (cb: Measure) => cb(0, 100, 400, 200) } as never);
  act(() => hook.measure()); expect(hook.visibleCount).toBe(1);
  act(() => { mockGeneration++; mockListener(); }); expect(hook.visibleCount).toBeNull();
  act(() => { tree.update(<Probe unobscured={false} />); }); expect(hook.visibleCount).toBeNull();
  act(() => { jest.runOnlyPendingTimers(); }); expect(hook.visibleCount).toBe(0);
  act(() => tree.unmount());
});

test('replacement row identity and recycled node removal revoke published proof', () => {
  jest.useFakeTimers(); let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); jest.runOnlyPendingTimers(); });
  Object.assign(hook.viewport, { current: { measureInWindow: (cb: Measure) => cb(0, 0, 400, 700) } });
  const node = { measureInWindow: (cb: Measure) => cb(0, 100, 400, 200) } as never;
  act(() => { hook.register(rows[0], node); hook.measure(); }); expect(hook.visibleCount).toBe(1);
  expect(hook.refFor(rows[0])).toBe(hook.refFor(rows[0]));
  act(() => hook.register(rows[0], null)); expect(hook.visibleCount).toBeNull();
  act(() => { hook.register(rows[0], node); hook.measure(); }); expect(hook.visibleCount).toBe(1);
  act(() => tree.update(<Probe source={[{ key: 'one' }]} />)); expect(hook.visibleCount).toBeNull();
  act(() => tree.unmount());
});
