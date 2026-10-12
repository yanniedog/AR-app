import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { cache } from '../src/data/cache';
import { DETAILS_CACHE_READ_CHUNK_BYTES, readDetailsCacheText } from '../src/data/detailsCacheText';
import { verifiedDetailsSha } from '../src/data/detailsIdentity';
import { MAX_PAYLOAD_INFLATED_BYTES } from '../src/data/payloadInflation';
import { yieldToUi } from '../src/lib/yieldToUi';
import { revisionManifest } from '../testUtils/payloadRevision';

jest.mock('../src/lib/yieldToUi', () => ({
  ...jest.requireActual('../src/lib/yieldToUi'),
  yieldToUi: jest.fn(async () => {}),
  parseJsonHeavy: async (text: string) => JSON.parse(text),
}));

const path = 'file:///docs/payload/details.json';
const originalPlatform = Platform.OS;
const fallback = jest.fn(async () => 'existing platform reader');

function installBytes(bytes: Buffer, maximumRead = Infinity, declaredSize = bytes.length) {
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: true, isDirectory: false, size: declaredSize, uri: path, modificationTime: 1,
  });
  jest.mocked(FileSystem.readAsStringAsync).mockImplementation(async (_path, options) => {
    if (options?.encoding !== 'base64') throw new Error('Unbounded UTF-8 read');
    const position = options.position ?? 0;
    return bytes.subarray(position, position + Math.min(options.length ?? bytes.length, maximumRead)).toString('base64');
  });
}

beforeEach(() => { jest.clearAllMocks(); Object.assign(Platform, { OS: 'android' }); });
afterEach(() => { jest.restoreAllMocks(); Object.assign(Platform, { OS: originalPlatform }); });

it.each([
  ['é', 1], ['日', 1], ['日', 2], ['😀', 1], ['😀', 2], ['😀', 3],
] as const)('preserves %s split after byte %s at a native read boundary', async (character, split) => {
  const text = `${'a'.repeat(DETAILS_CACHE_READ_CHUNK_BYTES - split)}${character} Crédit 日本語`;
  const bytes = Buffer.from(text);
  installBytes(bytes);
  await expect(readDetailsCacheText(path, fallback)).resolves.toBe(text);
  expect(FileSystem.readAsStringAsync).toHaveBeenCalledTimes(2);
  expect(FileSystem.readAsStringAsync).toHaveBeenNthCalledWith(1, path, {
    encoding: 'base64', position: 0, length: DETAILS_CACHE_READ_CHUNK_BYTES,
  });
  expect(FileSystem.readAsStringAsync).toHaveBeenNthCalledWith(2, path, {
    encoding: 'base64', position: DETAILS_CACHE_READ_CHUNK_BYTES, length: bytes.length - DETAILS_CACHE_READ_CHUNK_BYTES,
  });
  expect(yieldToUi).toHaveBeenCalledTimes(2);
  expect(fallback).not.toHaveBeenCalled();
});

it('advances by actual bytes after short reads without rereading or dropping a code point', async () => {
  const text = 'A😀éb';
  installBytes(Buffer.from(text), 3);
  await expect(readDetailsCacheText(path, fallback)).resolves.toBe(text);
  expect(jest.mocked(FileSystem.readAsStringAsync).mock.calls.map(([, options]) => options?.position)).toEqual([0, 3, 6]);
});

it.each([
  [0x80], [0xc0, 0xaf], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xe0, 0x80, 0x80], [0xf0, 0x90], [0xc2, 0x41],
])('rejects malformed or truncated UTF-8 %j even across short reads', async (...bytes) => {
  installBytes(Buffer.from(bytes), 1);
  await expect(readDetailsCacheText(path, fallback)).rejects.toThrow('UTF-8');
  expect(fallback).not.toHaveBeenCalled();
});

it.each([MAX_PAYLOAD_INFLATED_BYTES + 1, -1, NaN, Infinity, 1.5])('rejects invalid size %s before reading', async size => {
  installBytes(Buffer.from('text'), Infinity, size);
  await expect(readDetailsCacheText(path, fallback)).rejects.toThrow('file size');
  expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  expect(fallback).not.toHaveBeenCalled();
});

it('rejects an early EOF instead of accepting partial details', async () => {
  installBytes(Buffer.from('{}'), Infinity, 5);
  await expect(readDetailsCacheText(path, fallback)).rejects.toThrow('Truncated');
  expect(jest.mocked(FileSystem.readAsStringAsync).mock.calls.map(([, options]) => options?.position)).toEqual([0, 2]);
  expect(fallback).not.toHaveBeenCalled();
});

it('rejects growth or disappearance during the read', async () => {
  for (const changed of [{ exists: true, isDirectory: false, size: 3, uri: path, modificationTime: 1 }, { exists: false, isDirectory: false, uri: path }]) {
    installBytes(Buffer.from('{}'));
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({ exists: true, isDirectory: false, size: 2, uri: path, modificationTime: 1 })
      .mockResolvedValueOnce(changed as FileSystem.FileInfo);
    await expect(readDetailsCacheText(path, fallback)).rejects.toThrow('changed');
  }
});

it.each(['!!!!', 'eA=A', 'eB==', 'eHl6', 'not base64'])('rejects malformed or oversized native result %s', async encoded => {
  installBytes(Buffer.from('x'));
  jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue(encoded);
  await expect(readDetailsCacheText(path, fallback)).rejects.toThrow();
  expect(fallback).not.toHaveBeenCalled();
});

it('propagates native read failure without retrying the unbounded Android reader', async () => {
  installBytes(Buffer.from('x'));
  const error = new Error('native read failed');
  jest.mocked(FileSystem.readAsStringAsync).mockRejectedValue(error);
  await expect(readDetailsCacheText(path, fallback)).rejects.toBe(error);
  expect(fallback).not.toHaveBeenCalled();
});

it.each(['ios', 'web'])('preserves the existing %s reader', async platform => {
  Object.assign(Platform, { OS: platform });
  await expect(readDetailsCacheText(path, fallback)).resolves.toBe('existing platform reader');
  expect(fallback).toHaveBeenCalledWith(path);
  expect(FileSystem.getInfoAsync).not.toHaveBeenCalled();
  expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
});

it('keeps exact details SHA binding after bounded reads and leaves changed JSON unverified', async () => {
  const manifest = revisionManifest(1), sha = manifest.files.details.sha256;
  const file = `${path}.${sha}`;
  const hash = (text: string): string => jest.requireActual('node:crypto').createHash('sha256').update(text).digest('hex');
  jest.spyOn(Crypto, 'digestStringAsync').mockImplementation(async (_algorithm, text) => hash(text));
  jest.spyOn(cache, 'readMeta').mockResolvedValue({ manifest, coreSha: manifest.files.core.sha256,
    detailsSha: sha, source: 'remote', savedAt: manifest.generated_at });
  const text = JSON.stringify({ schema_version: 1, run_date: manifest.run_date, products: {}, note: '日😀'.repeat(60_000) });
  const receipt = JSON.stringify({ schemaVersion: 1, assetSha256: sha, contentSha256: hash(text) });
  for (const contents of [text, text.replace('日', '月')]) {
    installBytes(Buffer.from(contents));
    const boundedRead = jest.mocked(FileSystem.readAsStringAsync).getMockImplementation()!;
    jest.mocked(FileSystem.readAsStringAsync).mockImplementation(async (name, options) => name === `${file}.verified`
      ? receipt : boundedRead(name, options));
    const details = await cache.readDetails();
    expect(details).not.toBeNull();
    expect(verifiedDetailsSha(details!)).toBe(contents === text ? sha : null);
  }
  expect(jest.mocked(FileSystem.readAsStringAsync).mock.calls.filter(([name]) => name === file)
    .every(([, options]) => options?.encoding === 'base64' && options.length! <= DETAILS_CACHE_READ_CHUNK_BYTES)).toBe(true);
});

it('returns the normal cache miss on a truncated Android file', async () => {
  jest.spyOn(cache, 'readMeta').mockResolvedValue(null);
  installBytes(Buffer.from('{}'), Infinity, 3);
  await expect(cache.readDetails()).resolves.toBeNull();
});
