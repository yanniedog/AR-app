import type { AppState, StoreGet, StoreSet } from '../src/data/storeTypes';
import type { BankSpreadHistoryPayload } from '../src/data/bankSpreadHistory';
import { sampleCore, sampleManifest } from '../src/data/sample';

const mockReadBankSpreadHistoryFor = jest.fn();
const mockWriteBankSpreadHistoryFor = jest.fn(async (
  _coreSha: string,
  _spreadSha: string,
  _runDate: string,
  _verifiedBytes: Uint8Array,
  _stillCurrent: () => boolean,
): Promise<void> => {});
const mockDownloadBankSpreadHistory = jest.fn();

jest.mock('../src/data/cache', () => ({
  cache: {
    readBankSpreadHistoryFor: (
      coreSha: string,
      spreadSha: string,
      runDate: string,
      stillCurrent: () => boolean,
    ) => mockReadBankSpreadHistoryFor(coreSha, spreadSha, runDate, stillCurrent),
    writeBankSpreadHistoryFor: (
      coreSha: string,
      spreadSha: string,
      runDate: string,
      verifiedBytes: Uint8Array,
      stillCurrent: () => boolean,
    ) => mockWriteBankSpreadHistoryFor(coreSha, spreadSha, runDate, verifiedBytes, stillCurrent),
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

const CORE_A = 'a'.repeat(64);
const CORE_B = 'b'.repeat(64);
const SPREAD_A = 'c'.repeat(64);
const SPREAD_B = 'd'.repeat(64);
const spreadA: BankSpreadHistoryPayload = {
  schema_version: 1,
  run_date: sampleCore.run_date,
  run_dates: [sampleCore.run_date],
  method: 'mean_rate_rows_per_product_then_mean_products_per_provider',
  cohorts: { mortgage: 'mortgage-a', savings: 'savings-a' },
  banks: {
    'Example Bank': {
      mortgage_mean: [0.06],
      savings_mean: [0.04],
      gap: [0.02],
      mortgage_count: [1],
      savings_count: [1],
      mortgage_hash: ['mortgage-a'],
      savings_hash: ['savings-a'],
      quality: ['complete'],
    },
  },
};
const spreadB: BankSpreadHistoryPayload = {
  ...spreadA,
  cohorts: { mortgage: 'mortgage-b', savings: 'savings-b' },
  banks: {
    'Example Bank': {
      ...spreadA.banks['Example Bank'],
      gap: [0.015],
      mortgage_hash: ['mortgage-b'],
      savings_hash: ['savings-b'],
    },
  },
};

function manifestFor(coreSha: string, spreadSha: string) {
  return {
    ...sampleManifest,
    files: {
      ...sampleManifest.files,
      core: { ...sampleManifest.files.core, sha256: coreSha },
      bank_spread_history: {
        name: 'bank-spread-history.json.gz',
        bytes: 100,
        sha256: spreadSha,
        url: 'https://example.test/bank-spread-history.json.gz',
      },
    },
  };
}

function harness(existing: BankSpreadHistoryPayload | null = null) {
  const state = {
    core: sampleCore,
    manifest: manifestFor(CORE_A, SPREAD_A),
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

function installGeneration(
  state: AppState,
  coreSha: string,
  spreadSha: string,
  spread: BankSpreadHistoryPayload | null,
) {
  state.manifest = manifestFor(coreSha, spreadSha);
  state.bankSpreadHistory = spread;
  state.bankSpreadHistoryError = null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function waitForCall(mock: jest.Mock) {
  for (let attempt = 0; attempt < 20 && mock.mock.calls.length === 0; attempt += 1) {
    await Promise.resolve();
  }
  expect(mock).toHaveBeenCalled();
}

describe('Bank spread store integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadBankSpreadHistoryFor.mockResolvedValue(null);
    mockWriteBankSpreadHistoryFor.mockResolvedValue(undefined);
  });

  it('fails closed instead of trusting a captured unbound in-memory fallback', async () => {
    mockDownloadBankSpreadHistory.mockRejectedValue(new Error('offline'));
    const { state, actions } = harness(spreadA);

    await actions.ensureBankSpreadHistory();

    expect(state.bankSpreadHistory).toBeNull();
    expect(state.bankSpreadHistoryError).toBe('offline');
    expect(mockReadBankSpreadHistoryFor).toHaveBeenNthCalledWith(
      1, CORE_A, SPREAD_A, spreadA.run_date, expect.any(Function),
    );
    expect(mockReadBankSpreadHistoryFor).toHaveBeenNthCalledWith(
      2, CORE_A, SPREAD_A, spreadA.run_date, expect.any(Function),
    );
  });

  it('loads only the exact current generation cache key without downloading', async () => {
    mockReadBankSpreadHistoryFor.mockImplementation(async (coreSha: string, spreadSha: string) =>
      coreSha === CORE_A && spreadSha === SPREAD_A ? spreadA : null);
    const { state, actions } = harness();

    await actions.ensureBankSpreadHistory();

    expect(state.bankSpreadHistory).toEqual(spreadA);
    expect(state.bankSpreadHistoryError).toBeNull();
    expect(mockDownloadBankSpreadHistory).not.toHaveBeenCalled();
  });

  it('does not install A after a deferred cache read when the live core advances to B', async () => {
    const readA = deferred<BankSpreadHistoryPayload | null>();
    mockReadBankSpreadHistoryFor.mockReturnValueOnce(readA.promise);
    const { state, actions } = harness(spreadA);

    const pending = actions.ensureBankSpreadHistory();
    await waitForCall(mockReadBankSpreadHistoryFor);
    installGeneration(state, CORE_B, SPREAD_B, null);
    readA.resolve(spreadA);
    await pending;

    expect(state.bankSpreadHistory).toBeNull();
    expect(mockDownloadBankSpreadHistory).not.toHaveBeenCalled();
  });

  it('writes A only to its immutable key and never overwrites B state during a delayed write', async () => {
    const writeA = deferred<void>();
    mockDownloadBankSpreadHistory.mockResolvedValue({
      text: JSON.stringify(spreadA),
      bankSpreadHistory: spreadA,
      verifiedBytes: new Uint8Array([1, 2, 3]),
    });
    mockWriteBankSpreadHistoryFor.mockReturnValueOnce(writeA.promise);
    const { state, actions } = harness();

    const pending = actions.ensureBankSpreadHistory();
    await waitForCall(mockWriteBankSpreadHistoryFor);
    installGeneration(state, CORE_B, SPREAD_B, spreadB);
    writeA.resolve();
    await pending;

    expect(mockWriteBankSpreadHistoryFor).toHaveBeenCalledWith(
      CORE_A,
      SPREAD_A,
      spreadA.run_date,
      new Uint8Array([1, 2, 3]),
      expect.any(Function),
    );
    expect(state.bankSpreadHistory).toBe(spreadB);
    expect(state.bankSpreadHistoryError).toBeNull();
  });

  it('recovers only B when A download fails after B becomes current', async () => {
    const downloadA = deferred<never>();
    mockDownloadBankSpreadHistory.mockReturnValueOnce(downloadA.promise);
    mockReadBankSpreadHistoryFor.mockImplementation(async (coreSha: string, spreadSha: string) =>
      coreSha === CORE_B && spreadSha === SPREAD_B ? spreadB : null);
    const { state, actions } = harness();

    const pending = actions.ensureBankSpreadHistory();
    await waitForCall(mockDownloadBankSpreadHistory);
    installGeneration(state, CORE_B, SPREAD_B, null);
    downloadA.reject(new Error('A failed after promotion'));
    await pending;

    expect(mockReadBankSpreadHistoryFor).toHaveBeenLastCalledWith(
      CORE_B, SPREAD_B, spreadB.run_date, expect.any(Function),
    );
    expect(state.bankSpreadHistory).toBe(spreadB);
    expect(state.bankSpreadHistoryError).toBeNull();
  });
});
