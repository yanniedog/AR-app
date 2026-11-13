import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { useRatesAuditTarget } from '../src/hooks/useRatesAuditTarget';
const row = { id: 'one' }, rows = [row];
let hook!: ReturnType<typeof useRatesAuditTarget<typeof row>>;
function Probe({ physicalViewport = true }) {
  hook = useRatesAuditTarget({ rows, results: rows, page: 0, size: 20, revision: 'a', context: 'test', selectMode: true,
    canScroll: true, physicalViewport,
    list: { current: { props: { data: rows, extraData: 'a' }, computeVisibleIndices: () => ({ startIndex: 99, endIndex: 99 }), getLayout: () => ({ y: 900, height: 100 }), getWindowSize: () => ({ height: 300 }), getAbsoluteLastScrollOffset: () => 0, getFirstItemOffset: () => 0 } as never },
    token: item => item.id, key: item => item.id, navigate: () => {} });
  return null;
}
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
