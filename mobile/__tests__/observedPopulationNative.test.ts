import { gzipSync } from 'fflate';
import { utf8ToBytes } from '@noble/hashes/utils';
import { createObservedPopulationTransport, createObservedPopulationNativeStorage, observedPopulationCodec } from '../src/data/observedPopulationNative';
import { OBSERVED_POPULATION_INDEX_URL, OBSERVED_POPULATION_CAPABILITY as capability, observedPopulationTransportUrl } from '../src/data/observedPopulationChannel';
import { inflatePayloadOffThread } from '../src/data/payloadInflation';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => undefined, parseJsonHeavy: async (value: string) => JSON.parse(value) }));
jest.mock('../src/data/payloadInflation', () => ({ ...jest.requireActual('../src/data/payloadInflation'), inflatePayloadOffThread: jest.fn(async () => null) }));
const mockFiles = new Map<string, Uint8Array>();
const mockDirectories = new Set<string>();
jest.mock('expo-file-system', () => {
  const uri = (...parts: any[]) => parts.map(p => typeof p === 'string' ? p : p.uri).join('/').replace(/\/{2,}/g, '/');
  class Directory {
    uri: string;
    constructor(...parts: any[]) { this.uri = uri(...parts); }
    get exists() { return mockDirectories.has(this.uri); }
    create() { mockDirectories.add(this.uri); }
    delete() { for (const key of mockFiles.keys()) if (key.startsWith(this.uri + '/')) mockFiles.delete(key); mockDirectories.delete(this.uri); }
  }
  class File {
    uri: string;
    constructor(...parts: any[]) { this.uri = uri(...parts); }
    get exists() { return mockFiles.has(this.uri); }
    get size() { return mockFiles.get(this.uri)!.length; }
    create() { mockFiles.set(this.uri, new Uint8Array()); }
    open() {
      const key = this.uri; let offset = 0;
      return { close() {}, get size() { return mockFiles.get(key)!.length; },
        readBytes(length: number) { const bytes = mockFiles.get(key)!.slice(offset, offset + length); offset += bytes.length; return bytes; },
        writeBytes(bytes: Uint8Array) { const old = mockFiles.get(key)!, next = new Uint8Array(offset + bytes.length); next.set(old); next.set(bytes, offset); offset += bytes.length; mockFiles.set(key, next); } };
    }
  }
  return { File, Directory, Paths: { document: new Directory('/documents') } };
});
const url = observedPopulationTransportUrl(OBSERVED_POPULATION_INDEX_URL, capability);
function response(parts: Uint8Array[], patch = {}) {
  let offset = 0;
  const reader = { read: jest.fn(async () => offset < parts.length ? { done: false, value: parts[offset++] } : { done: true }),
    cancel: jest.fn(async () => undefined), releaseLock: jest.fn() };
  const body = { getReader: () => reader, cancel: jest.fn(async () => undefined) };
  return { reader, response: { ok: true, redirected: false, url, body, ...patch } };
}

test('streamed transport uses exact capability path, rejects redirects and enforces bytes while reading', async () => {
  const r = response([utf8ToBytes('ab'), utf8ToBytes('cd')]);
  const fetcher = jest.fn(async () => r.response);
  const transport = createObservedPopulationTransport(fetcher as never);
  expect(await transport.readText({ url, redirect: 'error', maxBytes: 4 })).toBe('abcd');
  expect(fetcher).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: 'error', credentials: 'omit' }));
  const excess = response([new Uint8Array(5)]); fetcher.mockImplementation(async () => excess.response);
  await expect(transport.readBytes({ url, redirect: 'error', maxBytes: 4 })).rejects.toThrow('byte limit');
  expect(excess.reader.cancel).toHaveBeenCalled();
  expect(excess.reader.releaseLock).toHaveBeenCalled();
});

test.each([{ ok: false }, { redirected: true }, { url: 'https://other.example/' }, { body: null }])('rejects unsupported HTTP response %j', async patch => {
  const r = response([], patch);
  const transport = createObservedPopulationTransport(jest.fn(async () => r.response) as never);
  await expect(transport.readBytes({ url, redirect: 'error', maxBytes: 100 })).rejects.toThrow('HTTP');
});

test.each(['https://other.example/', url.replace('/capabilities/observed-population-v1', ''), url + '?x=1', url.replace('dates-index.json', '../manifest.json')])('rejects route %s before network', async requested => {
  const fetcher = jest.fn(), transport = createObservedPopulationTransport(fetcher);
  await expect(transport.readBytes({ url: requested, redirect: 'error', maxBytes: 100 })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});

test('native codec is bounded and never retries a rejected native decode', async () => {
  const bytes = gzipSync(utf8ToBytes('{"observed":true}'));
  expect(await observedPopulationCodec.decode(bytes, 100)).toEqual({ observed: true });
  await expect(observedPopulationCodec.decode(bytes, 5)).rejects.toThrow('exceeds');
  jest.mocked(inflatePayloadOffThread).mockRejectedValueOnce(Error('native heap limit'));
  await expect(observedPopulationCodec.decode(bytes, 100)).rejects.toThrow('native heap limit');
});

test('native adapter confines binary chunks and cleanup to candidate storage', async () => {
  mockFiles.clear(); mockDirectories.clear();
  const storage = createObservedPopulationNativeStorage();
  expect(createObservedPopulationNativeStorage()).toBe(storage);
  const bytes = new Uint8Array(700_000).map((_, i) => i % 251);
  await storage.write('edition-1/core.bin', bytes);
  expect(await storage.read('edition-1/core.bin', bytes.length)).toEqual(bytes);
  await expect(storage.read('edition-1/core.bin', 100)).rejects.toThrow('byte limit');
  for (const key of ['../payload/core-bundle.json', 'edition-1/../../payload', '/tmp/data', 'edition-0/core.bin']) {
    await expect(storage.read(key, 100)).rejects.toThrow('key');
    await expect(storage.write(key, bytes)).rejects.toThrow('key');
  }
  mockFiles.set('/documents/payload/core-bundle.json', utf8ToBytes('legacy'));
  await storage.removeEdition(1);
  expect(await storage.read('edition-1/core.bin', bytes.length)).toBeNull();
  expect(mockFiles.get('/documents/payload/core-bundle.json')).toEqual(utf8ToBytes('legacy'));
  await expect(storage.removeEdition(-1)).rejects.toThrow();
});
