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

  expect(result.run_dates).toEqual(['2026-06-11']);
  expect(result.products['P|1']).toEqual([0.055]);
  expect(result.core_sha).toBe('sha-new');
});

test('does not cache a failed date and retries it on the next sync', async () => {
  mockedHistoryDates.mockReturnValue(['2026-06-10', '2026-06-11']);
  mockedDownload.mockRejectedValueOnce(new Error('temporary'));
  const current = core('2026-06-11', { Mortgage: [rateRow('P|1', '0.055')] });

  const first = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-11',
    currentCore: current,
  });
  expect(first.run_dates).toEqual(['2026-06-11']);

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
    schema_version: 2,
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
  // New catalog keys keep null history until those dates are missing from cache.
  expect(result.products['Q|2']).toEqual([null, 0.065]);
});

test('preserves rates when a product temporarily leaves then returns to the catalog', async () => {
  mockedHistoryDates.mockImplementation((_index, targetRunDate: string) =>
    ['2026-06-10', '2026-06-11', '2026-06-12'].filter((d) => d <= targetRunDate),
  );
  const existing: ProductHistoryPayload = {
    schema_version: 2,
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

  const restored = await syncProductHistoryFromDailyPayloads({
    targetRunDate: '2026-06-12',
    currentCore: core('2026-06-12', {
      Mortgage: [rateRow('P|1', '0.05'), rateRow('Q|2', '0.065')],
    }),
    existing: withoutQ,
  });
  expect(mockedDownload).not.toHaveBeenCalled();
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
    maxConcurrent: 1,
    circuitLimit: 3,
  });

  expect(result.run_dates).toEqual(['2026-06-06']);
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
    maxConcurrent: 99,
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

  expect(result.run_dates).toEqual(['2026-06-03', '2026-06-04', '2026-06-05']);
  expect(checkpoints).toEqual([
    {
      dates: ['2026-06-03', '2026-06-04', '2026-06-05'],
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
  expect(result.run_dates).toEqual(['2026-06-03']);
});
