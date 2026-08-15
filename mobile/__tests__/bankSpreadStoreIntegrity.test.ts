import type { AppState, StoreGet, StoreSet } from '../src/data/storeTypes';
import type { BankSpreadHistoryPayload } from '../src/data/bankSpreadHistory';
import { sampleCore, sampleManifest } from '../src/data/sample';

const mockReadOptionalMeta = jest.fn();
const mockReadBankSpreadHistory = jest.fn();
const mockWriteBankSpreadHistory = jest.fn(async (_value: string) => undefined);
const mockWriteOptionalMeta = jest.fn(async (_value: unknown) => undefined);
const mockDownloadBankSpreadHistory = jest.fn();

jest.mock('../src/data/cache', () => ({
  cache: {
    readOptionalMeta: () => mockReadOptionalMeta(),
    readBankSpreadHistory: () => mockReadBankSpreadHistory(),
    writeBankSpreadHistory: (value: string) => mockWriteBankSpreadHistory(value),
    writeOptionalMeta: (value: unknown) => mockWriteOptionalMeta(value),
  },
}));

jest.mock('../src/data/payload', () => ({
  downloadBankSpreadHistory: (...args: unknown[]) => mockDownloadBankSpreadHistory(...args),
  downloadBankInsights: jest.fn(),
  downloadDetails: jest.fn(),
  downloadHistoryBanks: jest.fn(),
  downloadRbaCalendar: jest.fn(),
  downloadSearchIndex: jest.fn(),
}));

// eslint-disable-next-line import/first -- store action import must follow its cache/payload mocks
import { createEnsureActions } from '../src/data/storeEnsure';

const CORE_SHA = 'new-core-sha';
const SPREAD_SHA = 'spread-sha';
const spread: BankSpreadHistoryPayload = {
  schema_version: 1,
  run_date: sampleCore.run_date,
  run_dates: [sampleCore.run_date],
  method: 'mean_rate_rows_per_product_then_mean_products_per_provider',
  cohorts: { mortgage: 'mortgage', savings: 'savings' },
  banks: {
    'Example Bank': {
      mortgage_mean: [0.06],
      savings_mean: [0.04],
      gap: [0.02],
      mortgage_count: [1],
      savings_count: [1],
      mortgage_hash: ['mortgage'],
      savings_hash: ['savings'],
      quality: ['complete'],
    },
  },
};

function harness(existing: BankSpreadHistoryPayload | null = null) {
  const manifest = {
    ...sampleManifest,
    files: {
      ...sampleManifest.files,
      core: { ...sampleManifest.files.core, sha256: CORE_SHA },
      bank_spread_history: {
        name: 'bank-spread-history.json.gz',
        bytes: 100,
        sha256: SPREAD_SHA,
        url: 'https://example.test/bank-spread-history.json.gz',
      },
    },
  };
  const state = {
    core: sampleCore,
    manifest,
    source: 'remote',
    bankSpreadHistory: existing,
    bankSpreadHistoryError: null,
  } as unknown as AppState;
  const set: StoreSet = (patch) => {
    Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  };
  const get: StoreGet = () => state;
  return { state, actions: createEnsureActions(set, get) };
}

describe('Bank spread store integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadBankSpreadHistory.mockResolvedValue(spread);
    mockWriteBankSpreadHistory.mockResolvedValue(undefined);
    mockWriteOptionalMeta.mockResolvedValue(undefined);
  });

  it('drops a same-day old-core cold cache when the replacement download fails', async () => {
    mockReadOptionalMeta.mockResolvedValue({
      coreSha: 'old-core-sha',
      bankSpreadHistorySha: SPREAD_SHA,
    });
    mockDownloadBankSpreadHistory.mockRejectedValue(new Error('offline'));
    const { state, actions } = harness(spread);

    await actions.ensureBankSpreadHistory();

    expect(state.bankSpreadHistory).toBeNull();
    expect(state.bankSpreadHistoryError).toBe('offline');
    expect(mockReadOptionalMeta).toHaveBeenCalledTimes(2);
  });

  it('retains an exact current-core cache without attempting a download', async () => {
    mockReadOptionalMeta.mockResolvedValue({
      coreSha: CORE_SHA,
      bankSpreadHistorySha: SPREAD_SHA,
    });
    const { state, actions } = harness();

    await actions.ensureBankSpreadHistory();

    expect(state.bankSpreadHistory).toEqual(spread);
    expect(state.bankSpreadHistoryError).toBeNull();
    expect(mockDownloadBankSpreadHistory).not.toHaveBeenCalled();
  });

  it('drops the fallback when the live core changes during a failed download', async () => {
    mockReadOptionalMeta.mockResolvedValue({
      coreSha: CORE_SHA,
      bankSpreadHistorySha: 'stale-spread-sha',
    });
    const { state, actions } = harness(spread);
    mockDownloadBankSpreadHistory.mockImplementation(async () => {
      state.manifest = {
        ...state.manifest!,
        files: {
          ...state.manifest!.files,
          core: { ...state.manifest!.files.core, sha256: 'newer-core-sha' },
        },
      };
      throw new Error('superseded');
    });

    await actions.ensureBankSpreadHistory();

    expect(state.bankSpreadHistory).toBeNull();
    expect(state.bankSpreadHistoryError).toBe('superseded');
  });

  it('does not overwrite a concurrently installed spread bound to the new live core', async () => {
    const concurrentSpread = { ...spread, banks: { ...spread.banks } };
    mockReadOptionalMeta
      .mockResolvedValueOnce({ coreSha: CORE_SHA, bankSpreadHistorySha: 'stale-spread-sha' })
      .mockResolvedValueOnce({ coreSha: 'newer-core-sha', bankSpreadHistorySha: 'newer-spread-sha' });
    const { state, actions } = harness(spread);
    mockDownloadBankSpreadHistory.mockImplementation(async () => {
      state.manifest = {
        ...state.manifest!,
        files: {
          ...state.manifest!.files,
          core: { ...state.manifest!.files.core, sha256: 'newer-core-sha' },
          bank_spread_history: {
            ...state.manifest!.files.bank_spread_history!,
            sha256: 'newer-spread-sha',
          },
        },
      };
      state.bankSpreadHistory = concurrentSpread;
      throw new Error('superseded');
    });

    await actions.ensureBankSpreadHistory();

    expect(state.bankSpreadHistory).toBe(concurrentSpread);
    expect(state.bankSpreadHistoryError).toBeNull();
  });
});
