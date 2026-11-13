import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { usePhysicalListVisibility } from '../src/hooks/usePhysicalListVisibility';
import { useFocusMeasurement } from '../src/hooks/useFocusMeasurement';
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
let onFocus: (() => void) | undefined;
const navigation = { addListener: (_event: 'focus', listener: () => void) => {
  onFocus = listener; return () => { onFocus = undefined; };
} };
function Probe({ revision = 'a', unobscured = true, source = rows }) {
  hook = usePhysicalListVisibility(revision, source, unobscured, rowKey, measured);
  useFocusMeasurement(navigation, true, hook.measure);
  return null;
}
type Measure = (x: number, y: number, width: number, height: number) => void;
afterEach(() => { jest.useRealTimers(); measured.mockClear(); });

test('native focus retries an exhausted detached measurement without a blur render or new revision', () => {
  jest.useFakeTimers(); let tree!: ReactTestRenderer;
  let attached = false;
  act(() => { tree = TestRenderer.create(<Probe />); });
  Object.assign(hook.viewport, { current: { measureInWindow: (cb: Measure) => cb(0, 0, 400, 700) } });
  act(() => {
    hook.register(rows[0], { measureInWindow: (cb: Measure) => cb(0, attached ? 100 : -1000, 400, 200) } as never);
    hook.measure(); jest.advanceTimersByTime(10_000);
  });
  expect(hook.visibleCount).toBe(0);
  // Frozen navigation returns the same mounted tree, so no prop/state identity
  // changes can trigger the hook's ordinary effect. Only the native focus fires.
  attached = true;
  act(() => onFocus?.());
  expect(hook.visibleCount).toBe(0);
  act(() => jest.advanceTimersByTime(40));
  expect(hook.visibleCount).toBe(1);
  act(() => tree.unmount());
  expect(onFocus).toBeUndefined();
});
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

test('a detached recycled cell cannot block independently measured visible cells on return', () => {
  jest.useFakeTimers(); let tree!: ReactTestRenderer;
  const source = [...rows, { key: 'two' }, { key: 'detached' }];
  act(() => { tree = TestRenderer.create(<Probe source={source} />); jest.runOnlyPendingTimers(); });
  Object.assign(hook.viewport, { current: { measureInWindow: (cb: Measure) => cb(0, 0, 400, 700) } });
  const dropped: Measure[] = [];
  act(() => {
    hook.register(source[0], { measureInWindow: (cb: Measure) => cb(0, 100, 400, 200) } as never);
    hook.register(source[1], { measureInWindow: (cb: Measure) => cb(0, 300, 400, 200) } as never);
    hook.register(source[2], { measureInWindow: (cb: Measure) => dropped.push(cb) } as never);
    jest.advanceTimersByTime(20);
    measured.mockClear();
    hook.measure();
  });
  expect(hook.visibleCount).toBeNull();
  act(() => { jest.advanceTimersByTime(20); });
  expect(hook.visibleCount).toBe(2);
  expect(measured.mock.calls.filter(([info]) => info.viewableItems.length > 0)).toHaveLength(1);
  expect(measured.mock.calls.at(-1)![0].viewableItems.map((item: { key: string }) => item.key)).toEqual(['one', 'two']);
  // The missing cell has no visibility proof. A late response from an older
  // measurement must not add it after a scroll/revision changed the viewport.
  const stale = dropped.shift()!;
  act(() => { tree.update(<Probe source={source} revision="b" />); stale(0, 100, 400, 200); });
  expect(hook.visibleCount).toBeNull();
  act(() => tree.unmount());
});

test('refocusing unchanged frozen rows restarts physical measurement after a long detached interval', () => {
  jest.useFakeTimers(); let tree!: ReactTestRenderer;
  const source = [...rows, { key: 'recycled' }];
  const detachedCallbacks: Measure[] = [];
  let attached = true;
  act(() => { tree = TestRenderer.create(<Probe source={source} />); jest.runOnlyPendingTimers(); });
  Object.assign(hook.viewport, { current: { measureInWindow: (cb: Measure) => {
    if (attached) cb(0, 0, 400, 700); else detachedCallbacks.push(cb);
  } } });
  act(() => {
    hook.register(source[0], { measureInWindow: (cb: Measure) => cb(0, 100, 400, 200) } as never);
    hook.register(source[1], { measureInWindow: () => {} } as never);
    hook.measure();
    jest.advanceTimersByTime(40);
  });
  expect(hook.visibleCount).toBe(1);
  // react-native-screens allows the blur render before freezing. Preserve the
  // same row/revision identities while native views remain detached for longer
  // than the retry budget, as when several stack routes cover Rates.
  act(() => { attached = false; tree.update(<Probe source={source} unobscured={false} />); jest.advanceTimersByTime(12_000); });
  expect(hook.visibleCount ?? 0).toBe(0);
  act(() => { tree.update(<Probe source={source} />); });
  act(() => { jest.advanceTimersByTime(20); });
  expect(hook.visibleCount).toBeNull();
  expect(detachedCallbacks.length).toBeGreaterThan(0);
  act(() => { attached = true; jest.advanceTimersByTime(640); });
  expect(hook.visibleCount).toBe(1);
  // A measurement started before reattachment cannot replace current proof.
  act(() => { detachedCallbacks.forEach(cb => cb(0, -900, 400, 700)); });
  expect(hook.visibleCount).toBe(1);
  expect(measured.mock.calls.at(-1)![0].viewableItems.map((item: { key: string }) => item.key)).toEqual(['one']);
  act(() => tree.unmount());
});
