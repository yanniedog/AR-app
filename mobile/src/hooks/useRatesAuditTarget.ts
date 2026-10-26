import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FlashListRef } from '@shopify/flash-list';
import { getPerformanceAuditState, subscribePerformanceAudit } from '../lib/performanceAudit';
import type { RatesAuditPagePreparation } from '../lib/ratesAuditPage';
import type { RatesPageSize } from '../data/ratesPagination';

type ViewToken<Row> = { item: Row; index?: number | null; key?: string; isViewable?: boolean | null };
type Unavailable = { unavailableReason: string };
interface Options<Row> {
  physicalViewport?: boolean;
  rows: readonly Row[]; results: readonly Row[]; page: number; size: RatesPageSize;
  revision: string; context: string; selectMode: boolean; canScroll: boolean;
  list: { current: FlashListRef<Row> | null };
  token(row: Row): string | null; key(row: Row, index: number): string;
  navigate(page: number): void;
}
interface Request<Row> {
  row: Row; token: string; index: number; page: number; size: RatesPageSize; context: string;
  list: FlashListRef<Row> | null;
  started: boolean; nativeDone: boolean; cancelled: boolean; settled: boolean; proven: boolean;
  receipt: RatesAuditPagePreparation;
  resolve(value: RatesAuditPagePreparation | Unavailable): void;
  reject(reason: unknown): void;
  signal?: AbortSignal; abort?: () => void;
}

/** Exact Cell commits and native viewport evidence; data membership is not visibility. */
export function useRatesAuditTarget<Row>(options: Options<Row>) {
  const current = useRef(options); current.current = options;
  const mounted = useRef(true);
  const commits = useRef(new Map<Row, { revision: string; owner: symbol }>());
  const visible = useRef<{ revision: string; rows: Set<Row> }>({ revision: '', rows: new Set() });
  const request = useRef<Request<Row> | null>(null);
  const [, wake] = useState(0);
  const [cellRevision, setCellRevision] = useState(0);
  const [viewport, setViewport] = useState('');
  const notify = useCallback(() => { if (mounted.current) wake(n => n + 1); }, []);

  const inViewport = useCallback((row: Row, index: number): boolean => {
    const active = current.current, list = active.list.current;
    if (!list || list.props.data?.[index] !== row || list.props.extraData !== active.revision) return false;
    try {
      const range = list.computeVisibleIndices(), layout = list.getLayout(index), window = list.getWindowSize();
      const offset = list.getAbsoluteLastScrollOffset() - list.getFirstItemOffset();
      if (!layout || !Number.isFinite(offset) || !Number.isSafeInteger(range.startIndex) || !Number.isSafeInteger(range.endIndex) ||
      !(window.height > 0) || !(layout.height > 0) ||
      index < range.startIndex || index > range.endIndex) return false;
      const overlap = Math.min(layout.y + layout.height, offset + window.height) - Math.max(layout.y, offset);
      return overlap > 0 && overlap / layout.height >= 0.01;
    } catch { return false; }
  }, []);
  const isVisible = useCallback((row: Row): boolean => {
    const active = current.current, index = active.rows.indexOf(row);
    if (request.current?.started && !request.current.nativeDone) return false;
    return index >= 0 && active.canScroll && commits.current.get(row)?.revision === active.revision &&
      visible.current.revision === active.revision && visible.current.rows.has(row) && (active.physicalViewport || inViewport(row, index));
  }, [inViewport]);
  const onCellCommit = useCallback((row: Row, revision: string) => {
    const owner = Symbol('rates-cell');
    if (revision === current.current.revision && current.current.rows.includes(row)) {
      commits.current.set(row, { revision, owner });
      if (mounted.current) setCellRevision(n => n + 1);
    }
    return () => {
      if (commits.current.get(row)?.owner !== owner) return;
      commits.current.delete(row);
      if (mounted.current) setCellRevision(n => n + 1);
    };
  }, []);
  const onViewableItemsChanged = useCallback((info: { viewableItems: ViewToken<Row>[] }) => {
    const active = current.current;
    if (!active.canScroll || request.current?.started && !request.current.nativeDone) return;
    const rows = new Set<Row>();
    for (const token of info.viewableItems) {
      if (token.isViewable !== true) continue;
      const index = token.index;
      if (index == null || !Number.isSafeInteger(index) || active.rows[index] !== token.item ||
        token.key !== active.key(token.item, index) || (!active.physicalViewport && !inViewport(token.item, index))) continue;
      rows.add(token.item);
    }
    visible.current = { revision: active.revision, rows };
    // Only genuine native viewport changes affect the surface render revision.
    const signature = JSON.stringify([active.revision, [...rows].map(row => active.token(row))]);
    setViewport(previous => previous === signature ? previous : signature);
    notify();
  }, [inViewport, notify]);
  const settle = useCallback((pending: Request<Row>, value: RatesAuditPagePreparation | Unavailable) => {
    if (!pending.settled) {
      pending.settled = true; pending.signal?.removeEventListener('abort', pending.abort!); pending.resolve(value);
    }
  }, []);
  const retire = useCallback((pending: Request<Row>) => {
    if (request.current === pending) request.current = null;
    notify();
  }, [notify]);
  const cancel = useCallback(() => {
    const pending = request.current;
    if (!pending) return;
    const wasSettled = pending.settled;
    pending.cancelled = true;
    // Issued native work must drain. Never race its promise with cancellation.
    if (!pending.started || pending.nativeDone) {
      settle(pending, { unavailableReason: 'Exact rate preparation interrupted' });
      // An invalidated, unproven target remains an honest readiness error for
      // the current step. A proven or never-issued scope can be retired.
      if (!pending.started || pending.proven || !wasSettled) retire(pending);
    }
    notify();
  }, [notify, retire, settle]);
  const matchesCurrentRequest = useCallback((pending: Request<Row>) => {
    const active = current.current;
    return mounted.current && request.current === pending && !pending.cancelled &&
      !getPerformanceAuditState().cancelRequested && active.context === pending.context &&
      active.results[pending.index] === pending.row && active.size === pending.size &&
      active.page === pending.page && active.selectMode &&
      (!pending.list || active.list.current === pending.list);
  }, []);
  const selectionFinished = useCallback((row: Row) => {
    const pending = request.current;
    if (pending?.row === row && pending.settled && pending.nativeDone) retire(pending);
  }, [retire]);
  useLayoutEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribePerformanceAudit(() => {
      const state = getPerformanceAuditState();
      if (state.cancelRequested) cancel();
      if ((state.status === 'queued' || ['idle', 'complete', 'failed', 'cancelled'].includes(state.status)) &&
        request.current?.nativeDone) { request.current = null; notify(); }
    });
    return () => { mounted.current = false; unsubscribe(); cancel(); };
  }, [cancel, notify]);
  const prepare = useCallback((token: string, signal?: AbortSignal): Promise<RatesAuditPagePreparation | Unavailable> | Unavailable => {
    if (signal?.aborted) return { unavailableReason: 'Exact rate preparation interrupted' };
    const active = current.current, index = active.results.findIndex(row => active.token(row) === token);
    if (!token || index < 0) return { unavailableReason: 'The selected exact rate is not in the filtered results' };
    if (request.current && !request.current.settled) return { unavailableReason: 'Exact rate preparation is pending' };
    const row = active.results[index], page = Math.floor(index / active.size) + 1;
    const proof = active.selectMode && isVisible(row) ? token : null;
    const receipt: RatesAuditPagePreparation = { selectionToken: token, resultIndex: index, pageSize: active.size,
      pageBefore: active.page, requestedPage: page, selectionModeBefore: active.selectMode,
      renderedSelectionToken: proof, committedSelectionToken: proof, viewableSelectionToken: proof };
    const promise = new Promise<RatesAuditPagePreparation | Unavailable>((resolve, reject) => {
      request.current = { row, token, index, page, size: active.size, context: active.context, list: null, started: false,
        nativeDone: false, cancelled: false, settled: false, proven: false, receipt, resolve, reject, signal };
      const pending = request.current;
      pending.abort = () => { if (request.current === pending) cancel(); };
      signal?.addEventListener('abort', pending.abort, { once: true });
    });
    active.navigate(page);
    notify();
    return promise;
  }, [cancel, isVisible, notify]);
  useEffect(() => {
    const pending = request.current, active = current.current;
    if (!pending || pending.cancelled) return;
    if (!matchesCurrentRequest(pending)) { cancel(); return; }
    if (pending.started) {
      if (pending.nativeDone && isVisible(pending.row)) pending.proven = true;
      return;
    }
    if (!active.canScroll || !active.list.current) return;
    const alreadyVisible = isVisible(pending.row);
    pending.started = true;
    if (alreadyVisible) {
      pending.nativeDone = true; pending.proven = true; settle(pending, pending.receipt); notify(); return;
    }
    const list = active.list.current;
    pending.list = list;
    // Return the entire native operation through the registered action promise.
    // FlashList may resolve without visibility, or remain pending after unmount.
    void Promise.resolve().then(() => {
      if (!matchesCurrentRequest(pending)) { cancel(); return; }
      return list.scrollToIndex({ index: pending.index % pending.size, animated: false, viewPosition: 0.5 });
    }).then(() => {
      pending.nativeDone = true;
      if (!matchesCurrentRequest(pending)) {
        settle(pending, { unavailableReason: 'Exact rate preparation interrupted' }); retire(pending); return;
      }
      visible.current = { revision: '', rows: new Set() };
      // Pre-resolution callbacks can describe FlashList's offset projection.
      // The required target probe separately bounds viewport/Cell readiness;
      // only actual native work belongs in the mutation barrier.
      list.recomputeViewableItems();
      settle(pending, pending.receipt); notify();
    }).catch(error => {
      pending.nativeDone = true;
      // A genuine native failure must retain action-failure accounting.
      if (!pending.settled) {
        pending.settled = true; pending.signal?.removeEventListener('abort', pending.abort!); pending.reject(error);
      }
      retire(pending);
    });
  });
  const pending = request.current;
  const ready = !!pending && !pending.cancelled && pending.nativeDone && options.selectMode && isVisible(pending.row);
  return { prepare, selectionFinished, isVisible, onCellCommit, onViewableItemsChanged, viewport, cellRevision,
    targetProbe: { id: 'search.audit-target', kind: 'list' as const, required: !!pending,
      status: !pending || ready ? 'ready' as const : pending.cancelled ? 'error' as const : 'pending' as const,
      ...(pending ? { expectedCount: 1, actualCount: commits.current.get(pending.row)?.revision === options.revision ? 1 : 0,
        visibleCount: ready ? 1 : 0, ...(pending.cancelled ? { error: 'Exact rate preparation interrupted' } : {}) } : {}) } };
}
