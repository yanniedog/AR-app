import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { useRatesAuditTarget } from '../src/hooks/useRatesAuditTarget';
const row = { id: 'one' }, rows = [row];
let mockStatus = 'idle';
let mockAuditListener: (() => void) | undefined;
jest.mock('../src/lib/performanceAudit', () => ({
  getPerformanceAuditState: () => ({ status: mockStatus }),
  subscribePerformanceAudit: (listener: () => void) => {
    mockAuditListener = listener;
    return () => { mockAuditListener = undefined; };
  },
}));
let renders = 0;
let hook!: ReturnType<typeof useRatesAuditTarget<typeof row>>;
function Probe({ physicalViewport = true }) {
  renders++;
  hook = useRatesAuditTarget({ rows, results: rows, page: 0, size: 20, revision: 'a', context: 'test', selectMode: true,
    canScroll: true, physicalViewport,
    list: { current: { props: { data: rows, extraData: 'a' }, computeVisibleIndices: () => ({ startIndex: 99, endIndex: 99 }), getLayout: () => ({ y: 900, height: 100 }), getWindowSize: () => ({ height: 300 }), getAbsoluteLastScrollOffset: () => 0, getFirstItemOffset: () => 0 } as never },
    token: item => item.id, key: item => item.id, navigate: () => {} });
  return null;
}
beforeEach(() => { mockStatus = 'idle'; renders = 0; });
test('physical committed row proof survives stale recycler estimates, then revokes immediately', () => {
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  let cleanup!: () => void;
  act(() => { cleanup = hook.onCellCommit(row, 'a'); hook.onViewableItemsChanged({ viewableItems: [{ item: row, index: 0, key: 'one', isViewable: true }] }); });
  expect(hook.isVisible(row)).toBe(true);
  act(() => { hook.onViewableItemsChanged({ viewableItems: [] }); });
  expect(hook.isVisible(row)).toBe(false);
  act(() => { cleanup(); tree.unmount(); });
});

test('ordinary cell commits and scrolling retain proof without rerendering Rates', () => {
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  const initialRenders = renders;
  let cleanup!: () => void;
  act(() => { cleanup = hook.onCellCommit(row, 'a'); });
  act(() => { hook.onViewableItemsChanged({ viewableItems: [{ item: row, index: 0, key: 'one', isViewable: true }] }); });
  expect(hook.isVisible(row)).toBe(true);
  expect(renders).toBe(initialRenders);
  act(() => { mockStatus = 'running'; mockAuditListener?.(); });
  expect(renders).toBe(initialRenders + 1);
  expect(hook.cellRevision).toBe(1);
  expect(hook.viewport).toContain('one');
  const auditRenders = renders;
  act(() => { hook.onViewableItemsChanged({ viewableItems: [{ item: row, index: 0, key: 'one', isViewable: true }] }); });
  expect(renders).toBe(auditRenders);
  act(() => { cleanup(); });
  expect(hook.isVisible(row)).toBe(false);
  expect(hook.cellRevision).toBe(2);
  act(() => { tree.unmount(); });
});
