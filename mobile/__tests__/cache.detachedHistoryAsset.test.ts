import * as FileSystem from 'expo-file-system/legacy';
import { cache } from '../src/data/cache';
import { DETACHED_HISTORY_MAX_ENCODED } from '../src/data/detachedHistoricalBankRateCatalogueWire';

const files = new Map<string, string>();
const path = `${FileSystem.documentDirectory}payload/bank-rate-history-asset.base64`;
const checkpoint = `${FileSystem.documentDirectory}payload/bank-rate-history.json`;
const accepted = async (value: string) => value === 'dmVyaWZpZWQ=' ? value : null;

beforeEach(() => {
  jest.clearAllMocks(); files.clear();
  jest.mocked(FileSystem.getInfoAsync).mockImplementation(async name => ({ exists: files.has(name) || name.endsWith('payload/'),
    isDirectory: name.endsWith('payload/'), size: files.get(name)?.length ?? 0 } as FileSystem.FileInfo));
  jest.mocked(FileSystem.readAsStringAsync).mockImplementation(async name => {
    if (!files.has(name)) throw new Error('missing'); return files.get(name)!;
  });
  jest.mocked(FileSystem.writeAsStringAsync).mockImplementation(async (name, value) => { files.set(name, value); });
  jest.mocked(FileSystem.deleteAsync).mockImplementation(async name => { files.delete(name); });
  jest.mocked(FileSystem.moveAsync).mockImplementation(async ({ from, to }) => {
    if (!files.has(from)) throw new Error('missing'); files.set(to, files.get(from)!); files.delete(from);
  });
  jest.mocked(FileSystem.makeDirectoryAsync).mockResolvedValue(undefined);
});

test('stores exact raw-byte representation separately from the derived checkpoint', async () => {
  files.set(checkpoint, 'derived checkpoint');
  await cache.writeDetachedBankRateHistoryAsset('dmVyaWZpZWQ=');
  expect(files.get(path)).toBe('dmVyaWZpZWQ='); expect(files.has(`${path}.tmp`)).toBe(false);
  expect(files.get(checkpoint)).toBe('derived checkpoint');
  expect(await cache.readDetachedBankRateHistoryAsset(accepted)).toBe('dmVyaWZpZWQ=');
});

test.each(['before-delete', 'before-move'] as const)('recovers a completed temporary asset after interruption %s', async where => {
  files.set(path, 'previous edition');
  if (where === 'before-delete') jest.mocked(FileSystem.deleteAsync).mockRejectedValueOnce(new Error('interrupted'));
  else jest.mocked(FileSystem.moveAsync).mockRejectedValueOnce(new Error('interrupted'));
  await expect(cache.writeDetachedBankRateHistoryAsset('dmVyaWZpZWQ=')).rejects.toThrow('interrupted');
  expect(await cache.readDetachedBankRateHistoryAsset(accepted)).toBe('dmVyaWZpZWQ=');
});

test.each(['truncated', 'another edition'] as const)('a %s temporary asset cannot hide an authenticated primary', async temporary => {
  files.set(path, 'dmVyaWZpZWQ='); files.set(`${path}.tmp`, temporary);
  const decode = jest.fn(accepted);
  expect(await cache.readDetachedBankRateHistoryAsset(decode)).toBe('dmVyaWZpZWQ=');
  expect(decode.mock.calls.map(([value]) => value)).toEqual([temporary, 'dmVyaWZpZWQ=']);
});

test('rejects oversized physical files before reading or decoding their contents', async () => {
  files.set(path, 'oversized');
  jest.mocked(FileSystem.getInfoAsync).mockImplementation(async name => ({ exists: name === path,
    isDirectory: false, size: DETACHED_HISTORY_MAX_ENCODED + 1 } as FileSystem.FileInfo));
  const decode = jest.fn(accepted);
  expect(await cache.readDetachedBankRateHistoryAsset(decode)).toBeNull();
  expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled(); expect(decode).not.toHaveBeenCalled();
  await expect(cache.writeDetachedBankRateHistoryAsset('x'.repeat(DETACHED_HISTORY_MAX_ENCODED + 1))).rejects.toThrow('budget');
  expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
});

test('cancellation after staging preserves the committed primary and leaves only a bounded recoverable temporary', async () => {
  let current = true; files.set(path, 'dmVyaWZpZWQ=');
  jest.mocked(FileSystem.writeAsStringAsync).mockImplementation(async (name, value) => { files.set(name, value); current = false; });
  await cache.writeDetachedBankRateHistoryAsset('new edition', () => current);
  expect(files.get(path)).toBe('dmVyaWZpZWQ=');
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled(); expect(FileSystem.moveAsync).not.toHaveBeenCalled();
  expect(await cache.readDetachedBankRateHistoryAsset(accepted)).toBe('dmVyaWZpZWQ=');
});

test('serialized writes leave one raw asset and cannot grow an unbounded edition inventory', async () => {
  await Promise.all(['first', 'second', 'dmVyaWZpZWQ='].map(value => cache.writeDetachedBankRateHistoryAsset(value)));
  expect([...files.keys()]).toEqual([path]);
  expect(await cache.readDetachedBankRateHistoryAsset(accepted)).toBe('dmVyaWZpZWQ=');
});
