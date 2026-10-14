import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { usePreparedSearchRows } from '../src/hooks/usePreparedSearchRows';
import { EMPTY_FILTERS, type SortKey } from '../src/data/selectors';
import type { ProductDetail, RateRow } from '../src/types';
import type { SearchIndexPayload } from '../src/data/detailSearch';
import sample from '../assets/sample/core.json';

const mockPrepare = jest.fn();
const mockJobs: { run: () => void; cancelled: boolean; navigation: boolean }[] = [];
jest.mock('../src/data/selectors', () => ({
  ...jest.requireActual('../src/data/selectors'),
  prepareSearchRows: (...args: unknown[]) => mockPrepare(...args),
}));
jest.mock('../src/lib/yieldToUi', () => ({
  scheduleAfterNavigation: (run: () => void) => {
    const job = { run, cancelled: false, navigation: true }; mockJobs.push(job);
    return () => { job.cancelled = true; };
  },
  scheduleAfterInteractions: (run: () => void) => {
    const job = { run, cancelled: false, navigation: false }; mockJobs.push(job);
    return () => { job.cancelled = true; };
  },
}));
const rows = Array.from({ length: 160 }, (_, index) => sample.sections.TD.rates[index % sample.sections.TD.rates.length]) as RateRow[];
const filters = { ...EMPTY_FILTERS, includeNonStandard: true };
let latest: ReturnType<typeof usePreparedSearchRows>;
function Probe({ sort = 'rate', details, index = null, revision = 0, focused = true }: {
  sort?: SortKey; details?: Record<string, ProductDetail>; index?: SearchIndexPayload | null; revision?: number; focused?: boolean;
}) {
  latest = usePreparedSearchRows(rows, filters, sort, 'TD', details, index, 'max', 'comparison', revision, focused);
  return null;
}
function pending() {
  let resolve!: (rows: RateRow[] | null) => void;
  const promise = new Promise<RateRow[] | null>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => { mockPrepare.mockReset(); mockJobs.length = 0; });

test('large results stay pending until the full active request completes', async () => {
  const job = pending(); mockPrepare.mockReturnValue(job.promise);
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    expect(mockPrepare).not.toHaveBeenCalled();
    expect(latest.ready).toBe(false); expect(latest.rows).toEqual([]);
    act(() => mockJobs[0].run());
    await act(async () => { job.resolve(rows); await job.promise; });
    expect(latest.ready).toBe(true); expect(latest.rows).toBe(rows);
    expect(mockJobs[0].navigation).toBe(true);
    act(() => tree.update(<Probe sort="bank" />));
    expect(mockJobs[1].navigation).toBe(false);
    await act(async () => { mockJobs[1].run(); });
    act(() => tree.update(<Probe focused={false} />));
    act(() => tree.update(<Probe />));
    expect(mockJobs[2].navigation).toBe(true);
    expect(latest.ready).toBe(false);
    await act(async () => { mockJobs[2].run(); });
    expect(latest.rows).toBe(rows);
  } finally { act(() => tree.unmount()); }
});

test('obsolete sort completion cannot replace new results and previous rows are withheld', async () => {
  const old = pending(), next = pending();
  mockPrepare.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    act(() => mockJobs[0].run());
    const oldControl = mockPrepare.mock.calls[0][8];
    act(() => tree.update(<Probe sort="bank" />));
    expect(oldControl.cancelled()).toBe(true);
    expect(latest.ready).toBe(false); expect(latest.rows).toEqual([]);
    act(() => mockJobs[1].run());
    const sorted = rows.slice().reverse();
    await act(async () => { next.resolve(sorted); await next.promise; });
    expect(latest.rows).toBe(sorted);
    await act(async () => { old.resolve(rows); await old.promise; });
    expect(latest.rows).toBe(sorted);
    act(() => tree.update(<Probe sort="bank" revision={1} />));
    expect(latest.ready).toBe(false); expect(latest.rows).toEqual([]);
  } finally { act(() => tree.unmount()); }
});

test('same-date details and index replacement invalidate the installed results', async () => {
  const details = { [rows[0].product_key]: { description: 'Original' } };
  const index = { schema_version: 1, run_date: sample.run_date, products: {} };
  mockPrepare.mockResolvedValue(rows);
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe details={details} index={index} />); });
  try {
    await act(async () => { mockJobs[0].run(); });
    expect(latest.ready).toBe(true);
    act(() => tree.update(<Probe details={{ ...details }} index={index} />));
    expect(latest.ready).toBe(false);
    await act(async () => { mockJobs[1].run(); });
    expect(latest.ready).toBe(true);
    act(() => tree.update(<Probe details={details} index={{ ...index }} />));
    expect(latest.ready).toBe(false); expect(latest.rows).toEqual([]);
  } finally { act(() => tree.unmount()); }
});

test('errors have a retry and blur cancels scheduled preparation', async () => {
  mockPrepare.mockRejectedValueOnce(new Error('Failed search preparation')).mockResolvedValue(rows);
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    await act(async () => { mockJobs[0].run(); });
    expect(latest.error).toBe('Failed search preparation'); expect(latest.ready).toBe(false);
    act(() => latest.retry());
    await act(async () => { mockJobs[1].run(); });
    expect(latest.error).toBeNull(); expect(latest.ready).toBe(true);
    act(() => tree.update(<Probe sort="bank" />));
    act(() => tree.update(<Probe sort="bank" focused={false} />));
    expect(mockJobs[2].cancelled).toBe(true);
    expect(latest.rows).toEqual([]); expect(latest.ready).toBe(false);
  } finally { act(() => tree.unmount()); }
});
