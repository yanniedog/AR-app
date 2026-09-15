import { HISTORY_DERIVATION_VERSION } from '../src/data/historyDerivation';
import { resolveLegacyPublications } from '../src/data/historicalPublication';
import { productMoveBreakdownForCatalog } from '../src/data/productHistory';
import { syncProductHistoryFromDailyPayloads, type ProductHistoryPayload } from '../src/data/productHistory';
import type { CorePayload, RateRow, SectionKey } from '../src/types';
import { downloadDatedCore, fetchDatesIndexJson, historyDatesUpTo } from '../src/data/historyDaily';

jest.mock('../src/data/historyDaily', () => {
  const actual = jest.requireActual('../src/data/historyDaily') as object;
  return {
    ...actual,
    downloadDatedCore: jest.fn(),
    fetchDatesIndexJson: jest.fn(),
    historyDatesUpTo: jest.fn(),
  };
});

jest.mock('../src/data/historicalPublication', () => ({ resolveLegacyPublications: jest.fn(async (index: any, dates: string[]) => new Map(dates.filter(date => !index.revision_heads?.[date]).map(date => [date, { identity: `legacy:${date}`, manifest: {} }]))) }));

const mockedDownload = jest.mocked(downloadDatedCore);
const mockedFetchIndex = jest.mocked(fetchDatesIndexJson);
const mockedHistoryDates = jest.mocked(historyDatesUpTo);

const EMPTY_RIBBON = {
  counts: { rates: 0, products: 0, providers: 0 },
  range: { min: null, max: null, mean: null, median: null },
  providers: [],
};

function rateRow(productKey: string, rate: string): RateRow {
  return { provider: 'Bank', product_key: productKey, product_name: productKey, rate };
}

function core(runDate: string, rowsBySection: Partial<Record<SectionKey, RateRow[]>>): CorePayload {
  return {
    schema_version: 1,
    run_date: runDate,
    sections: {
      Mortgage: { rates: rowsBySection.Mortgage ?? [], ribbon: EMPTY_RIBBON },
      Savings: { rates: rowsBySection.Savings ?? [], ribbon: EMPTY_RIBBON },
      TD: { rates: rowsBySection.TD ?? [], ribbon: EMPTY_RIBBON },
    },
    brands: {},
    rba: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedFetchIndex.mockResolvedValue({} as never);
});

test('always includes the current core date and records its revision', async () => {
  mockedHistoryDates.mockReturnValue(['2026-06-10']);

  const result = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-11',
    currentCore: core('2026-06-11', { Mortgage: [rateRow('P|1', '0.055')] }),
    coreSha: 'sha-new',
  });

  expect(result.run_dates).toEqual(['2026-06-10', '2026-06-11']);
  expect(result.products['P|1']).toEqual([null, 0.055]);
  expect(result.core_sha).toBe('sha-new');
});

test('returns an exact immutable cached ledger without rebuilding or checkpointing it', async () => {
  mockedHistoryDates.mockReturnValue(['2026-06-10', '2026-06-11']);
  const existing: ProductHistoryPayload = {
    schema_version: 3, derivation_version: HISTORY_DERIVATION_VERSION,
    source_identities: { '2026-06-10': 'legacy:2026-06-10', '2026-06-11': 'legacy:2026-06-11' },
    run_date: '2026-06-11',
    core_sha: 'sha-current',
    run_dates: ['2026-06-10', '2026-06-11'],
    products: { 'P|1': [0.06, 0.055] },
  };
  const onCheckpoint = jest.fn();

  const result = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-11',
    currentCore: core('2026-06-11', { Mortgage: [rateRow('P|1', '0.055')] }),
    coreSha: 'sha-current',
    existing,
    onCheckpoint,
  });

  expect(result).toBe(existing);
  expect(mockedDownload).not.toHaveBeenCalled();
  expect(onCheckpoint).not.toHaveBeenCalled();
});

test('does not cache a failed date and retries it on the next sync', async () => {
  mockedHistoryDates.mockReturnValue(['2026-06-10', '2026-06-11']);
  mockedDownload.mockRejectedValueOnce(new Error('temporary'));
  const current = core('2026-06-11', { Mortgage: [rateRow('P|1', '0.055')] });

  const first = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-11',
    currentCore: current,
  });
  expect(first.run_dates).toEqual(['2026-06-10', '2026-06-11']);
  expect(first.date_status?.['2026-06-10']).toBe('unavailable');

  mockedDownload.mockResolvedValueOnce(core('2026-06-10', { Mortgage: [rateRow('P|1', '0.06')] }));
  const second = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-11',
    currentCore: current,
    existing: first,
  });
  expect(second.run_dates).toEqual(['2026-06-10', '2026-06-11']);
  expect(second.products['P|1']).toEqual([0.06, 0.055]);
  expect(mockedDownload).toHaveBeenCalledTimes(2);
});

test('reuses prior dates when the catalog grows instead of refetching history', async () => {
  mockedHistoryDates.mockReturnValue(['2026-06-10', '2026-06-11']);
  const existing: ProductHistoryPayload = {
    schema_version: 3, derivation_version: HISTORY_DERIVATION_VERSION,
    source_identities: { '2026-06-10': 'legacy:2026-06-10', '2026-06-11': 'legacy:2026-06-11' },
    run_date: '2026-06-10',
    run_dates: ['2026-06-10'],
    products: { 'P|1': [0.06] },
  };

  const result = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-11',
    currentCore: core('2026-06-11', { Mortgage: [rateRow('P|1', '0.055'), rateRow('Q|2', '0.065')] }),
    existing,
  });

  expect(mockedDownload).not.toHaveBeenCalled();
  expect(result.products['P|1']).toEqual([0.06, 0.055]);
  // Version 3 stored the complete historical catalogue: a missing key is a real absence.
  expect(result.products['Q|2']).toEqual([null, 0.065]);
});

test('preserves rates when a product temporarily leaves then returns to the catalog', async () => {
  mockedHistoryDates.mockImplementation((_index, targetRunDate: string) =>
    ['2026-06-10', '2026-06-11', '2026-06-12'].filter((d) => d <= targetRunDate),
  );
  const existing: ProductHistoryPayload = {
    schema_version: 3, derivation_version: HISTORY_DERIVATION_VERSION,
    source_identities: { '2026-06-10': 'legacy:2026-06-10', '2026-06-11': 'legacy:2026-06-11' },
    run_date: '2026-06-10',
    run_dates: ['2026-06-10'],
    products: { 'P|1': [0.06], 'Q|2': [0.07] },
  };

  const withoutQ = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-11',
    currentCore: core('2026-06-11', { Mortgage: [rateRow('P|1', '0.055')] }),
    existing,
  });
  expect(mockedDownload).not.toHaveBeenCalled();
  expect(withoutQ.products['P|1']).toEqual([0.06, 0.055]);
  // Absent catalog keys keep their historical series so reuse stays valid.
  expect(withoutQ.products['Q|2']).toEqual([0.07, null]);

  mockedDownload.mockResolvedValueOnce(core('2026-06-11', { Mortgage: [rateRow('P|1', '0.055')] }));
  const restored = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-12',
    currentCore: core('2026-06-12', {
      Mortgage: [rateRow('P|1', '0.05'), rateRow('Q|2', '0.065')],
    }),
    existing: withoutQ,
  });
  expect(mockedDownload).toHaveBeenCalledTimes(1);
  expect(restored.products['Q|2']).toEqual([0.07, null, 0.065]);
});

test('stops dated fetches after consecutive network failures', async () => {
  mockedHistoryDates.mockReturnValue([
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
  ]);
  mockedDownload.mockRejectedValue(new Error('network error'));

  const result = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-06',
    currentCore: core('2026-06-06', { Mortgage: [rateRow('P|1', '0.055')] }),
    circuitLimit: 3,
  });

  expect(result.run_dates).toEqual(['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06']);
  expect(mockedDownload.mock.calls.length).toBeLessThanOrEqual(3);
});

test('downloads missing dates newest-first with only one heavy core in flight', async () => {
  mockedHistoryDates.mockReturnValue([
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
  ]);
  let inFlight = 0;
  let maxInFlight = 0;
  mockedDownload.mockImplementation(async (runDate: string) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    inFlight -= 1;
    return core(runDate, { Mortgage: [rateRow('P|1', '0.06')] });
  });

  await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-04',
    currentCore: core('2026-06-04', { Mortgage: [rateRow('P|1', '0.055')] }),
  });

  expect(mockedDownload.mock.calls.map(([runDate]) => runDate)).toEqual([
    '2026-06-03',
    '2026-06-02',
    '2026-06-01',
  ]);
  expect(maxInFlight).toBe(1);
});

test('publishes a checkpoint every five successful dates and a final checkpoint', async () => {
  mockedHistoryDates.mockReturnValue([
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
    '2026-06-07',
  ]);
  mockedDownload.mockImplementation(async (runDate: string) =>
    core(runDate, { Mortgage: [rateRow('P|1', '0.06')] }),
  );
  const checkpoints: {
    dates: string[];
    successfulDates: number;
    done: boolean;
  }[] = [];

  const result = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-07',
    currentCore: core('2026-06-07', { Mortgage: [rateRow('P|1', '0.055')] }),
    onCheckpoint: async (payload, progress) => {
      checkpoints.push({
        dates: payload.run_dates,
        successfulDates: progress.successfulDates,
        done: progress.done,
      });
    },
  });

  expect(checkpoints).toHaveLength(2);
  expect(checkpoints[0]).toMatchObject({ successfulDates: 5, done: false });
  expect(checkpoints[0].dates).toEqual([
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
    '2026-06-07',
  ]);
  expect(checkpoints[1]).toMatchObject({ successfulDates: 6, done: true });
  expect(result.run_dates).toEqual([
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
    '2026-06-07',
  ]);
});

test('marks an exact checkpoint multiple final without writing the same payload twice', async () => {
  mockedHistoryDates.mockReturnValue([
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
  ]);
  mockedDownload.mockImplementation(async (runDate: string) =>
    core(runDate, { Mortgage: [rateRow('P|1', '0.06')] }),
  );
  const checkpoints: { successfulDates: number; done: boolean }[] = [];

  await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-06',
    currentCore: core('2026-06-06', { Mortgage: [rateRow('P|1', '0.055')] }),
    onCheckpoint: (_payload, progress) => {
      checkpoints.push({
        successfulDates: progress.successfulDates,
        done: progress.done,
      });
    },
  });

  expect(checkpoints).toEqual([{ successfulDates: 5, done: true }]);
});

test('final checkpoint preserves successful recent dates when the circuit opens', async () => {
  mockedHistoryDates.mockReturnValue([
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
  ]);
  mockedDownload
    .mockResolvedValueOnce(core('2026-06-04', { Mortgage: [rateRow('P|1', '0.06')] }))
    .mockResolvedValueOnce(core('2026-06-03', { Mortgage: [rateRow('P|1', '0.061')] }))
    .mockRejectedValue(new Error('network error'));
  const checkpoints: {
    dates: string[];
    done: boolean;
    circuitOpen: boolean;
  }[] = [];

  const result = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-05',
    currentCore: core('2026-06-05', { Mortgage: [rateRow('P|1', '0.055')] }),
    circuitLimit: 2,
    onCheckpoint: (payload, progress) => {
      checkpoints.push({
        dates: payload.run_dates,
        done: progress.done,
        circuitOpen: progress.circuitOpen,
      });
    },
  });

  expect(result.run_dates).toEqual(['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05']);
  expect(checkpoints).toEqual([
    {
      dates: ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'],
      done: true,
      circuitOpen: true,
    },
  ]);
});

test('stops stale revision work without publishing its downloaded core', async () => {
  mockedHistoryDates.mockReturnValue([
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
  ]);
  let current = true;
  mockedDownload.mockImplementation(async (runDate: string) => {
    current = false;
    return core(runDate, { Mortgage: [rateRow('P|1', '0.06')] });
  });
  const onCheckpoint = jest.fn();

  const result = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-03',
    currentCore: core('2026-06-03', { Mortgage: [rateRow('P|1', '0.055')] }),
    isCurrent: () => current,
    onCheckpoint,
  });

  expect(mockedDownload).toHaveBeenCalledTimes(1);
  expect(onCheckpoint).not.toHaveBeenCalled();
  expect(result.run_dates).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
});

test('refetches revised dates with one pinned index and clears withdrawn values', async () => {
  const index = { revision_heads: { '2026-06-10': {
    revision: 2, bundle_sha256: 'new-bundle', manifest_sha256: 'new-manifest',
  } } } as never;
  mockedFetchIndex.mockResolvedValue(index);
  mockedHistoryDates.mockReturnValue(['2026-06-10', '2026-06-11']);
  mockedDownload.mockResolvedValue(core('2026-06-10', { Savings: [rateRow('S|new', '0')] }));
  const result = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-11', coreSha: 'same-core',
    currentCore: core('2026-06-11', { Savings: [rateRow('S|old', '0.01')] }),
    existing: { schema_version: 3, derivation_version: HISTORY_DERIVATION_VERSION, run_date: '2026-06-11', core_sha: 'same-core',
      source_identities: { '2026-06-10': 'revision:1:old:old' },
      run_dates: ['2026-06-10', '2026-06-11'], products: { 'S|old': [0.05, 0.01] } },
  });
  expect(mockedFetchIndex).toHaveBeenCalledTimes(1);
  expect(mockedDownload).toHaveBeenCalledWith('2026-06-10', index, undefined);
  expect(result.products['S|old']).toEqual([null, 0.01]);
  expect(result.products['S|new']).toEqual([0, null]);
  expect(result.source_identities?.['2026-06-10']).toBe('revision:2:new-bundle:new-manifest');
});

test('does not relabel a failed corrected date as verified or keep its old value', async () => {
  mockedHistoryDates.mockReturnValue(['2026-06-10', '2026-06-11']);
  mockedDownload.mockRejectedValue(new Error('offline'));
  const result = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-11',
    currentCore: core('2026-06-11', { Mortgage: [rateRow('P|1', '0.055')] }),
    existing: { schema_version: 2, run_date: '2026-06-11',
      run_dates: ['2026-06-10', '2026-06-11'], products: { 'P|1': [0.09, 0.055] } },
  });
  expect(result.run_dates).toEqual(['2026-06-10', '2026-06-11']);
  expect(result.products['P|1']).toEqual([null, 0.055]);
  expect(result.source_identities?.['2026-06-10']).toBeUndefined();
});

test('migrates old catalog-restricted caches and discovers historic-only products', async () => {
  mockedHistoryDates.mockReturnValue(['2026-06-10', '2026-06-11']);
  mockedDownload.mockResolvedValue(core('2026-06-10', {
    Mortgage: [rateRow('P|1', '0.06'), rateRow('Q|historic', '0.07')],
  }));
  const result = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-11',
    currentCore: core('2026-06-11', { Mortgage: [rateRow('P|1', '0.055')] }),
    existing: { schema_version: 2, run_date: '2026-06-10',
      run_dates: ['2026-06-10'], products: { 'P|1': [0.06] } },
  });
  expect(result.schema_version).toBe(3);
  expect(result.products['Q|historic']).toEqual([0.07, null]);
});

test('a stale dates index cannot downgrade a previously verified corrected date', async () => {
  mockedHistoryDates.mockReturnValue(['2026-06-10', '2026-06-11']);
  const result = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-11',
    currentCore: core('2026-06-11', { Mortgage: [rateRow('P|1', '0.055')] }),
    existing: { schema_version: 3, derivation_version: HISTORY_DERIVATION_VERSION, run_date: '2026-06-11',
      source_identities: { '2026-06-10': 'revision:2:verified:verified' },
      run_dates: ['2026-06-10', '2026-06-11'], products: { 'P|1': [0.06, 0.055] } },
  });
  expect(mockedDownload).not.toHaveBeenCalled();
  expect(result.products['P|1']).toEqual([0.06, 0.055]);
  expect(result.source_identities?.['2026-06-10']).toBe('revision:2:verified:verified');
});


test('failed corrected middle date stays null, prevents exact daily attribution, retries once then recognizes verified absence', async () => {
  const dates = ['2026-06-09', '2026-06-10', '2026-06-11'];
  mockedHistoryDates.mockReturnValue(dates);
  mockedFetchIndex.mockResolvedValue({ revision_heads: { '2026-06-10': { revision: 2, bundle_sha256: 'b2', manifest_sha256: 'm2' } } } as never);
  const existing: ProductHistoryPayload = { schema_version: 3, derivation_version: HISTORY_DERIVATION_VERSION, run_date: dates[2], run_dates: dates,
    source_identities: { [dates[0]]: `legacy:${dates[0]}`, [dates[1]]: 'revision:1:b1:m1' }, products: { P: [0.05, 0.055, 0.06] } };
  mockedDownload.mockRejectedValueOnce(new Error('offline'));
  const opts = { targetRunDate: dates[2], coreSha: 'current-sha', currentCore: core(dates[2], { Savings: [rateRow('P', '0.06')] }) };
  const failed = await syncProductHistoryFromDailyPayloads({ ...opts, existing });
  expect(failed.run_dates).toEqual(dates); expect(failed.products.P).toEqual([0.05, null, 0.06]);
  expect(failed.date_status?.[dates[1]]).toBe('unavailable'); expect(failed.revision_high_water?.[dates[1]]).toBe('revision:1:b1:m1');
  expect(productMoveBreakdownForCatalog(failed, [{ productKey: 'P', productName: 'P', rateIndex: 1 }], { date: dates[2] })).toEqual({ matched: 0, moves: [] });
  mockedDownload.mockResolvedValueOnce(core(dates[1], {}));
  const retried = await syncProductHistoryFromDailyPayloads({ ...opts, existing: failed });
  expect(retried.date_status?.[dates[1]]).toBe('verified'); expect(retried.products.P).toEqual([0.05, null, 0.06]);
  mockedDownload.mockClear(); await syncProductHistoryFromDailyPayloads({ ...opts, existing: retried }); expect(mockedDownload).not.toHaveBeenCalled();
});

test('derivation change rebuilds unchanged-source cells while retaining rollback barriers', async () => {
  const dates = ['2026-06-10', '2026-06-11']; mockedHistoryDates.mockReturnValue(dates);
  mockedDownload.mockResolvedValue(core(dates[0], { Savings: [rateRow('P', '0.04')] }));
  const opts = { targetRunDate: dates[1], coreSha: 'same', currentCore: core(dates[1], { Savings: [rateRow('P', '0.06')] }) };
  const existing: ProductHistoryPayload = { schema_version: 3, derivation_version: 'older-normalizer', run_date: dates[1], core_sha: 'same', run_dates: dates, source_identities: { [dates[0]]: `legacy:${dates[0]}` }, products: { P: [0.9, 0.06] } };
  const result = await syncProductHistoryFromDailyPayloads({ ...opts, existing }); expect(result.products.P).toEqual([0.04, 0.06]); expect(mockedDownload).toHaveBeenCalledTimes(1);
  mockedDownload.mockClear(); existing.source_identities![dates[0]] = 'revision:2:verified:verified';
  const stale = await syncProductHistoryFromDailyPayloads({ ...opts, existing }); expect(mockedDownload).not.toHaveBeenCalled();
  expect(stale.products.P).toEqual([null, 0.06]); expect(stale.revision_high_water?.[dates[0]]).toBe('revision:2:verified:verified');
});

test('legacy manifest refresh failure leaves old value unavailable instead of endorsing cached content', async () => {
  const dates = ['2026-06-10', '2026-06-11']; mockedHistoryDates.mockReturnValue(dates);
  jest.mocked(resolveLegacyPublications).mockResolvedValueOnce(new Map());
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: dates[1], currentCore: core(dates[1], { Savings: [rateRow('P', '0.06')] }),
    existing: { schema_version: 3, derivation_version: HISTORY_DERIVATION_VERSION, run_date: dates[1], run_dates: dates,
      source_identities: { [dates[0]]: `legacy:${dates[0]}` }, products: { P: [0.05, 0.06] } } });
  expect(result.products.P).toEqual([null, 0.06]); expect(result.date_status?.[dates[0]]).toBe('unavailable'); expect(mockedDownload).not.toHaveBeenCalled();
});
