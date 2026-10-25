import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { useSearchFilterOptions } from '../src/hooks/useSearchFilterOptions';
import { EMPTY_SEARCH_FILTER_OPTIONS, type SearchFilterOptions } from '../src/data/searchFilterOptions';
import { debugLog } from '../src/lib/debugLog';
import type { ProductDetail, RateRow } from '../src/types';

const mockPrepare = jest.fn();
const mockNavigationJobs: { run: () => void; cancelled: boolean }[] = [];
jest.mock('../src/data/searchFilterOptions', () => ({
  ...jest.requireActual('../src/data/searchFilterOptions'),
  prepareSearchFilterOptions: (...args: unknown[]) => mockPrepare(...args),
}));
jest.mock('../src/lib/yieldToUi', () => ({
  scheduleAfterInteractions: (run: () => void) => {
    const job = { run, cancelled: false };
    mockNavigationJobs.push(job);
    return () => { job.cancelled = true; };
  },
  scheduleAfterNavigation: (run: () => void) => {
    const job = { run, cancelled: false };
    mockNavigationJobs.push(job);
    return () => { job.cancelled = true; };
  },
}));

const rows: RateRow[] = [{ provider: 'Macquarie', product_name: 'Term Deposit', product_key: 'macquarie:TD001MBLTDA002', rate: '0.05' }];
let latest: ReturnType<typeof useSearchFilterOptions>;
function Probe({ details, revision = 0 }: { details?: Record<string, ProductDetail>; revision?: number }) {
  latest = useSearchFilterOptions(rows, details, 'TD', revision);
  return null;
}
function pendingPreparation() {
  let resolve!: (value: SearchFilterOptions | null) => void;
  const promise = new Promise<SearchFilterOptions | null>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => { mockPrepare.mockReset(); mockNavigationJobs.length = 0; });

test('route render queues facets after navigation and reports readiness only after a complete model', async () => {
  const pending = pendingPreparation();
  mockPrepare.mockReturnValue(pending.promise);
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    expect(mockPrepare).not.toHaveBeenCalled();
    expect(latest.ready).toBe(false);
    expect(latest.options).toBe(EMPTY_SEARCH_FILTER_OPTIONS);
    act(() => mockNavigationJobs[0].run());
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(latest.ready).toBe(false);
    const options = { ...EMPTY_SEARCH_FILTER_OPTIONS, providers: ['Macquarie'] };
    await act(async () => { pending.resolve(options); await pending.promise; });
    expect(latest).toEqual({ ready: true, options, error: null, retry: expect.any(Function) });
  } finally { act(() => tree.unmount()); }
});

test('replaced details cancel a prior preparation and cannot install stale options', async () => {
  const old = pendingPreparation();
  const corrected = pendingPreparation();
  mockPrepare.mockReturnValueOnce(old.promise).mockReturnValueOnce(corrected.promise);
  const originalDetails = { [rows[0].product_key]: { description: 'Original' } };
  const correctedDetails = { [rows[0].product_key]: { description: 'Corrected' } };
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe details={originalDetails} />); });
  try {
    act(() => mockNavigationJobs[0].run());
    const oldControl = mockPrepare.mock.calls[0][3];
    act(() => tree.update(<Probe details={correctedDetails} />));
    expect(mockNavigationJobs[0].cancelled).toBe(true);
    expect(oldControl.cancelled()).toBe(true);
    act(() => mockNavigationJobs[1].run());
    const options = { ...EMPTY_SEARCH_FILTER_OPTIONS, providers: ['Corrected'] };
    await act(async () => { corrected.resolve(options); await corrected.promise; });
    expect(latest).toEqual({ ready: true, options, error: null, retry: expect.any(Function) });
    await act(async () => { old.resolve({ ...options, providers: ['Stale'] }); await old.promise; });
    expect(latest).toEqual({ ready: true, options, error: null, retry: expect.any(Function) });
    act(() => tree.update(<Probe details={correctedDetails} revision={1} />));
    expect(latest.ready).toBe(false);
    expect(latest.options).toBe(EMPTY_SEARCH_FILTER_OPTIONS);
  } finally { act(() => tree.unmount()); }
});

test('a failed preparation becomes a terminal error and can retry without a route change', async () => {
  const log = jest.spyOn(debugLog, 'error').mockImplementation(() => undefined);
  mockPrepare.mockRejectedValueOnce(new Error('Facet preparation failed'));
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    await act(async () => { mockNavigationJobs[0].run(); });
    expect(latest.ready).toBe(false);
    expect(latest.error).toBe('Filter · Unavailable');
    expect(log).toHaveBeenCalledWith('searchFilterOptions', 'Facet preparation failed');
    expect(latest.options).toBe(EMPTY_SEARCH_FILTER_OPTIONS);
    const options = { ...EMPTY_SEARCH_FILTER_OPTIONS, providers: ['Macquarie'] };
    mockPrepare.mockResolvedValueOnce(options);
    act(() => latest.retry());
    expect(latest.error).toBeNull();
    await act(async () => { mockNavigationJobs[1].run(); });
    expect(latest).toEqual({ ready: true, options, error: null, retry: expect.any(Function) });
  } finally { act(() => tree.unmount()); log.mockRestore(); }
});
