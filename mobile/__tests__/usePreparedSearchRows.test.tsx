import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { usePreparedSearchRows } from '../src/hooks/usePreparedSearchRows';
import { EMPTY_FILTERS, sortRows, type Filters, type SortKey } from '../src/data/selectors';
import type { ProductDetail, RateRow, SectionKey } from '../src/types';
import type { SearchIndexPayload } from '../src/data/detailSearch';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import sample from '../assets/sample/core.json';

const mockPrepare = jest.fn();
const mockSort = jest.fn();
const mockJobs: { run: () => void; cancelled: boolean; navigation: boolean }[] = [];
jest.mock('../src/data/selectors', () => ({
  ...jest.requireActual('../src/data/selectors'),
  prepareSearchRows: (...args: unknown[]) => mockPrepare(...args),
  sortRowsCooperatively: (...args: unknown[]) => mockSort(...args),
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
function Probe({ sort = 'rate', details, index = null, revision = 0, focused = true, inputRows = rows,
  inputFilters = filters, section = 'TD' }: {
  sort?: SortKey; details?: Record<string, ProductDetail>; index?: SearchIndexPayload | null; revision?: number; focused?: boolean;
  inputRows?: RateRow[]; inputFilters?: Filters; section?: SectionKey;
}) {
  latest = usePreparedSearchRows(inputRows, inputFilters, sort, section, details, index, 'max', 'comparison', revision, focused);
  return null;
}
function pending() {
  let resolve!: (rows: RateRow[] | null) => void;
  const promise = new Promise<RateRow[] | null>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  mockPrepare.mockReset(); mockSort.mockReset().mockImplementation((values: RateRow[]) => Promise.resolve(values.slice()));
  mockJobs.length = 0;
});

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
    expect(latest.rows).toEqual(rows);
    expect(latest.rows.every((row, index) => row === rows[index])).toBe(true);
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

test('a small matching set sorts immediately without refiltering and keeps original core tie order', async () => {
  const matching = Array.from({ length: 9 }, (_, i) => ({ ...rows[0], product_key: `matching-${i}`,
    product_name: 'Same product', provider: 'Same bank', rate: String(0.03 + i / 1000) })) as RateRow[];
  const source = [...matching, ...rows];
  const ordered = sortRows(matching, 'rate', 'TD', 'max');
  mockPrepare.mockResolvedValue(ordered);
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe inputRows={source} />); });
  try {
    await act(async () => { mockJobs[0].run(); });
    expect(latest.rows).toEqual(ordered);
    act(() => tree.update(<Probe inputRows={source} sort="bank" />));
    expect(latest.ready).toBe(true);
    expect(latest.rows).toEqual(matching);
    expect(latest.rows.every(row => source.includes(row))).toBe(true);
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockSort).not.toHaveBeenCalled();
    expect(mockJobs).toHaveLength(1);
  } finally { act(() => tree.unmount()); }
});

test('small synchronous results recheck mandatory eligibility when the gate revision changes', () => {
  const source = rows.slice(0, 3);
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe inputRows={source} />); });
  try {
    expect(latest.rows).toHaveLength(3);
    installMandatoryEligibility({ active: true, loading: false, rows: new WeakSet([source[0]]),
      productKeys: new Set([source[0].product_key]) });
    act(() => tree.update(<Probe inputRows={source} revision={1} sort="bank" />));
    expect(latest.rows).toEqual([source[0]]); expect(latest.ready).toBe(true);
    expect(mockPrepare).not.toHaveBeenCalled();
  } finally {
    act(() => tree.unmount());
    installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() });
  }
});

test('a large pure sort reuses membership internally but withholds rows until the current order completes', async () => {
  const firstSort = pending(), secondSort = pending();
  mockPrepare.mockResolvedValue(rows);
  mockSort.mockReturnValueOnce(firstSort.promise).mockReturnValueOnce(secondSort.promise);
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    await act(async () => { mockJobs[0].run(); });
    act(() => tree.update(<Probe sort="bank" />));
    expect(latest.rows).toEqual([]); expect(latest.ready).toBe(false);
    act(() => mockJobs[1].run());
    expect(mockSort.mock.calls[0][0]).toEqual(rows);
    const abandoned = mockSort.mock.calls[0][5];
    act(() => tree.update(<Probe sort="comparison" />));
    expect(abandoned.cancelled()).toBe(true);
    expect(latest.rows).toEqual([]); expect(latest.ready).toBe(false);
    act(() => mockJobs[2].run());
    const installed = rows.slice().reverse();
    await act(async () => { secondSort.resolve(installed); await secondSort.promise; });
    expect(latest.rows).toBe(installed); expect(latest.ready).toBe(true);
    await act(async () => { firstSort.resolve(rows); await firstSort.promise; });
    expect(latest.rows).toBe(installed);
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockSort).toHaveBeenCalledTimes(2);
  } finally { act(() => tree.unmount()); }
});

test.each(['query', 'facets', 'rows', 'section', 'revision'] as const)('%s changes withhold membership during a pending sort', async change => {
  const sorting = pending(), replacement = pending();
  mockPrepare.mockResolvedValueOnce(rows).mockReturnValueOnce(replacement.promise);
  mockSort.mockReturnValue(sorting.promise);
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    await act(async () => { mockJobs[0].run(); });
    act(() => tree.update(<Probe sort="bank" />));
    act(() => mockJobs[1].run());
    const changed = change === 'query' ? { inputFilters: { ...filters, query: 'different' } }
      : change === 'facets' ? { inputFilters: { ...filters, providers: ['Different bank'] } }
        : change === 'rows' ? { inputRows: rows.slice() }
          : change === 'section' ? { section: 'Savings' as const } : { revision: 1 };
    act(() => tree.update(<Probe sort="bank" {...changed} />));
    expect(mockSort.mock.calls[0][5].cancelled()).toBe(true);
    expect(latest.rows).toEqual([]); expect(latest.ready).toBe(false);
    act(() => mockJobs[2].run());
    await act(async () => { sorting.resolve(rows); await sorting.promise; });
    expect(latest.rows).toEqual([]); expect(latest.ready).toBe(false);
    await act(async () => { replacement.resolve([]); await replacement.promise; });
    expect(latest.rows).toEqual([]); expect(latest.ready).toBe(true);
  } finally { act(() => tree.unmount()); }
});
