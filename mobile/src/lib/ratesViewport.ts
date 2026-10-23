/** Read physical list geometry when FlashList omits an unchanged viewability event. */
export function measuredRatesViewport<Row>(list: {
  props: { data?: readonly Row[] | null; extraData?: unknown; keyExtractor?: (item: Row, index: number) => string };
  computeVisibleIndices(): { startIndex: number; endIndex: number };
  getWindowSize(): { height: number };
  getAbsoluteLastScrollOffset(): number;
  getFirstItemOffset(): number;
  getLayout(index: number): { y: number; height: number } | undefined;
} | null, rows: readonly Row[], revision: string) {
  if (!list || list.props.data !== rows || list.props.extraData !== revision) return null;
  try {
    const range = list.computeVisibleIndices();
    const height = list.getWindowSize().height;
    const offset = list.getAbsoluteLastScrollOffset() - list.getFirstItemOffset();
    if (!Number.isSafeInteger(range.startIndex) || !Number.isSafeInteger(range.endIndex) ||
      !Number.isFinite(height) || height <= 0 || !Number.isFinite(offset)) return null;
    const viewableItems: { item: Row; index: number; key?: string; isViewable: true }[] = [];
    for (let index = Math.max(0, range.startIndex); index <= Math.min(rows.length - 1, range.endIndex); index++) {
      const layout = list.getLayout(index);
      if (!layout || !Number.isFinite(layout.y) || !Number.isFinite(layout.height) || layout.height <= 0) return null;
      const overlap = Math.min(layout.y + layout.height, offset + height) - Math.max(layout.y, offset);
      if (overlap > 0 && overlap / layout.height >= 0.01) viewableItems.push({ item: rows[index], index,
        key: list.props.keyExtractor?.(rows[index], index), isViewable: true });
    }
    return { viewableItems };
  } catch { return null; }
}
