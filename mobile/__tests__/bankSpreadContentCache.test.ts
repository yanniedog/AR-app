import * as FileSystem from 'expo-file-system/legacy';

import { cache } from '../src/data/cache';
import type { BankSpreadHistoryPayload } from '../src/data/bankSpreadHistory';
import { sampleCore } from '../src/data/sample';

const files = new Map<string, string>();
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
      mortgage_mean: [0.055],
      mortgage_hash: ['mortgage-b'],
      savings_hash: ['savings-b'],
    },
  },
};

function resetFs() {
  files.clear();
  (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (path: string) => ({
    exists: files.has(path) || path.endsWith('/'),
    isDirectory: path.endsWith('/'),
  }));
  (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async (path: string) => {
    const value = files.get(path);
    if (value === undefined) throw new Error(`missing ${path}`);
    return value;
  });
  (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (path: string, value: string) => {
    files.set(path, value);
  });
  (FileSystem.deleteAsync as jest.Mock).mockImplementation(async (path: string) => {
    files.delete(path);
  });
  (FileSystem.moveAsync as jest.Mock).mockImplementation(async ({ from, to }: { from: string; to: string }) => {
    const value = files.get(from);
    if (value === undefined) throw new Error(`missing ${from}`);
    files.set(to, value);
    files.delete(from);
  });
  (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
}

function recordPath(coreSha: string, spreadSha: string) {
  return `${FileSystem.documentDirectory}payload/bank-spread-history/${coreSha}/${spreadSha}.json`;
}

describe('content-addressed bank spread cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFs();
  });

  it('keeps A and B immutable and a cold exact-key read can load only B', async () => {
    await cache.writeBankSpreadHistoryFor(CORE_A, SPREAD_A, JSON.stringify(spreadA));
    await cache.writeBankSpreadHistoryFor(CORE_B, SPREAD_B, JSON.stringify(spreadB));

    expect(files.has(recordPath(CORE_A, SPREAD_A))).toBe(true);
    expect(files.has(recordPath(CORE_B, SPREAD_B))).toBe(true);
    await expect(cache.readBankSpreadHistoryFor(CORE_B, SPREAD_B)).resolves.toEqual(spreadB);
    await expect(cache.readBankSpreadHistoryFor(CORE_B, SPREAD_A)).resolves.toBeNull();
    await expect(cache.readBankSpreadHistoryFor(CORE_A, SPREAD_A)).resolves.toEqual(spreadA);
  });

  it('rejects a different payload under an existing exact content address', async () => {
    await cache.writeBankSpreadHistoryFor(CORE_A, SPREAD_A, JSON.stringify(spreadA));

    await expect(
      cache.writeBankSpreadHistoryFor(CORE_A, SPREAD_A, JSON.stringify(spreadB)),
    ).rejects.toThrow(/content-address collision/);
    await expect(cache.readBankSpreadHistoryFor(CORE_A, SPREAD_A)).resolves.toEqual(spreadA);
  });

  it('fails closed on a mutated record without affecting another generation', async () => {
    await cache.writeBankSpreadHistoryFor(CORE_A, SPREAD_A, JSON.stringify(spreadA));
    await cache.writeBankSpreadHistoryFor(CORE_B, SPREAD_B, JSON.stringify(spreadB));
    const pathA = recordPath(CORE_A, SPREAD_A);
    const recordA = JSON.parse(files.get(pathA)!) as { payload_text: string };
    recordA.payload_text = JSON.stringify(spreadB);
    files.set(pathA, JSON.stringify(recordA));

    await expect(cache.readBankSpreadHistoryFor(CORE_A, SPREAD_A)).resolves.toBeNull();
    await expect(cache.readBankSpreadHistoryFor(CORE_B, SPREAD_B)).resolves.toEqual(spreadB);
  });
});
