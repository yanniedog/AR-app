import { measuredRatesViewport } from '../src/lib/ratesViewport';

const rows = ['first', 'second', 'third'];
function native() {
  return { props: { data: rows, extraData: 'current' },
    computeVisibleIndices: () => ({ startIndex: 0, endIndex: 2 }),
    getWindowSize: () => ({ height: 100 }), getAbsoluteLastScrollOffset: () => 75,
    getFirstItemOffset: () => 0, getLayout: (index: number) => ({ y: index * 100, height: 100 }) };
}
test('measures overlapping native rows without relying on a changed viewability callback', () => {
  expect(measuredRatesViewport(native(), rows, 'current')?.viewableItems.map(item => item.item)).toEqual(['first', 'second']);
});
test('rejects stale data, old UI revisions, invalid geometry and unavailable native measurement', () => {
  expect(measuredRatesViewport(native(), [...rows], 'current')).toBeNull();
  expect(measuredRatesViewport(native(), rows, 'old')).toBeNull();
  expect(measuredRatesViewport({ ...native(), getWindowSize: () => ({ height: 0 }) }, rows, 'current')).toBeNull();
  expect(measuredRatesViewport({ ...native(), getLayout: () => ({ y: NaN, height: 100 }) }, rows, 'current')?.viewableItems).toEqual([]);
  expect(measuredRatesViewport({ ...native(), computeVisibleIndices: () => { throw new Error('not mounted'); } }, rows, 'current')).toBeNull();
});
