import { gzipSync, strToU8 } from 'fflate';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { automaticDataUrl, trustedPayloadReleaseUrl, MissingPublicPayloadError, APP_DATA_ORIGIN } from '../src/lib/automaticDataAccess';
import { downloadInflate, fetchManifest } from '../src/data/payload';

jest.mock('expo-crypto', () => ({ ...jest.requireActual('expo-crypto'), digest: jest.fn() }));
jest.mock('../src/lib/yieldToUi', () => ({
  yieldToUi: jest.fn(async () => undefined),
  parseJsonHeavy: jest.fn(async (text: string) => JSON.parse(text)),
}));

beforeEach(() => {
  jest.mocked(Crypto.digest).mockImplementation(async (_algorithm, bytes) => {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);
    return sha256(view).slice().buffer as ArrayBuffer;
  });
});

const source = 'https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json';
const companion = `${APP_DATA_ORIGIN}/v1/release/app-payload-latest/manifest.json`;
it('keeps canonical identities separate from their Cloudflare delivery', () => {
  expect(trustedPayloadReleaseUrl(source)).toBe(source);
  expect(trustedPayloadReleaseUrl(companion)).toBeNull();
  expect(automaticDataUrl(source.replace('manifest.json', 'core-2026-09-18-123456789abc.json.gz.enc')))
    .toBe(`${APP_DATA_ORIGIN}/v1/release/app-payload-latest/core-2026-09-18-123456789abc.json.gz.enc`);
});

it.each(['bank-rate-history-catalogue', 'bank-rate-history-catalogue-packed', 'bank-rate-history-ready'])(
  'routes %s through Cloudflare without changing its immutable identity', prefix => {
  const name = `${prefix}-2026-09-27-123456789abc.json.gz`;
  const url = source.replace('app-payload-latest', 'app-payload-2026-09-27-r000001').replace('manifest.json', name);
  expect(automaticDataUrl(url)).toBe(`${APP_DATA_ORIGIN}/v1/release/app-payload-2026-09-27-r000001/${name}`);
});

it.each(['app-payload-latest', 'app-payload-2026-09-18', 'app-payload-2026-09-18-r000002'])(
  'maps %s while preserving immutable domain references', tag => {
    expect(automaticDataUrl(source.replace('app-payload-latest', tag) + '?_=123'))
      .toBe(`${APP_DATA_ORIGIN}/v1/release/${tag}/manifest.json?_=123`);
  });

it('maps both rolling selectors through Cloudflare', () => {
  expect(automaticDataUrl(source.replace('manifest.json', 'dates-index.json') + '?_=789'))
    .toBe(`${APP_DATA_ORIGIN}/v1/release/app-payload-latest/dates-index.json?_=789`);
});

it.each(['http://github.com/yanniedog/AR-local/releases/download/app-payload-latest/a.json',
  'https://evil.test/a.json', source.replace('AR-local', 'AR-app'), source + '?url=http://localhost',
  source.replace('manifest.json', '%2fprivate.json'), source.replace('manifest.json', '..private.json'),
  source.replace('github.com', 'user:secret@github.com'), source + '#secret',
  source.replace('manifest.json', 'preservation.zip'), companion])('does not map unapproved canonical source %s', url => {
  expect(automaticDataUrl(url)).toBeNull();
  expect(trustedPayloadReleaseUrl(url)).toBeNull();
});

function mockDownload(bytes: Uint8Array | Uint8Array[], status = 200) {
  const requests: string[] = [];
  const headers: [string, string][] = [];
  const previous = globalThis.XMLHttpRequest;
  class Download {
    status = status;
    response = (Array.isArray(bytes) ? bytes[Math.min(requests.length, bytes.length - 1)] : bytes).slice().buffer;
    onload?: () => void;
    open(_method: string, url: string) { requests.push(url); }
    send() { this.onload?.(); }
    setRequestHeader(name: string, value: string) { headers.push([name, value]); }
  }
  globalThis.XMLHttpRequest = Download as unknown as typeof XMLHttpRequest;
  return { requests, headers, restore: () => { globalThis.XMLHttpRequest = previous; } };
}

it('opens verified legacy ARE1 on the service without a device key and keeps native gzip processing', async () => {
  const encrypted = new Uint8Array(80); encrypted.set(strToU8('ARE1'));
  const text = JSON.stringify({ historical: true });
  const download = mockDownload([encrypted, gzipSync(strToU8(text))]);
  const digest = bytesToHex(sha256(encrypted));
  jest.mocked(SecureStore.getItemAsync).mockClear();
  try {
    await expect(downloadInflate(source.replace('manifest.json', 'history.json.gz.enc'), digest)).resolves.toBe(text);
    expect(download.headers).toEqual([['X-AR-Legacy-SHA256', digest]]);
    expect(download.requests).toHaveLength(2);
    expect(new Set(download.requests).size).toBe(1);
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  } finally { download.restore(); }
});

it('never requests legacy plaintext when its ciphertext does not match the descriptor', async () => {
  const encrypted = new Uint8Array(80); encrypted.set(strToU8('ARE1'));
  const download = mockDownload(encrypted);
  try {
    await expect(downloadInflate(source.replace('manifest.json', 'history.json.gz.enc'), 'f'.repeat(64))).rejects.toThrow('sha256 mismatch');
    expect(download.requests).toHaveLength(1);
    expect(download.headers).toEqual([]);
  } finally { download.restore(); }
});

it('rejects legacy service responses that remain encrypted', async () => {
  const encrypted = new Uint8Array(80); encrypted.set(strToU8('ARE1'));
  const download = mockDownload(encrypted);
  jest.mocked(SecureStore.getItemAsync).mockClear();
  try {
    await expect(downloadInflate(source.replace('manifest.json', 'history.json.gz.enc'), bytesToHex(sha256(encrypted))))
      .rejects.toThrow('Historical data service returned unopened transport');
    expect(download.requests).toHaveLength(2);
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  } finally { download.restore(); }
});

it('loads first-launch current and historical manifests with an empty device key store', async () => {
  const raw = { schema_version: 1, run_date: '2026-09-19', files: {} };
  const download = mockDownload(strToU8(JSON.stringify(raw)));
  jest.mocked(SecureStore.getItemAsync).mockClear();
  try {
    await expect(fetchManifest(source)).resolves.toEqual(raw);
    await expect(fetchManifest(source.replace('app-payload-latest', 'app-payload-2026-09-18-r000002'))).resolves.toEqual(raw);
    expect(download.requests.map(url => url.split('?')[0])).toEqual([
      companion, `${APP_DATA_ORIGIN}/v1/release/app-payload-2026-09-18-r000002/manifest.json`,
    ]);
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  } finally { download.restore(); }
});

it('preserves exact domain sizes and gzip decoding without local key access', async () => {
  const text = JSON.stringify({ technical: 'transport regression' });
  const bytes = gzipSync(strToU8(text));
  const download = mockDownload(bytes);
  jest.mocked(SecureStore.getItemAsync).mockClear();
  try {
    await expect(downloadInflate(source.replace('manifest.json', 'core.json.gz'), undefined,
      { expectedBytes: bytes.length, maxCompressedBytes: bytes.length, requireExactBytes: true })).resolves.toBe(text);
    await expect(downloadInflate(source, undefined, { expectedBytes: bytes.length - 1,
      maxCompressedBytes: bytes.length, requireExactBytes: true })).rejects.toThrow('size mismatch');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  } finally { download.restore(); }
});

it('refuses unopened ARE2 service bytes without asking for a key', async () => {
  const bytes = new Uint8Array(80); bytes.set(strToU8('ARE2'));
  const download = mockDownload(bytes);
  jest.mocked(SecureStore.getItemAsync).mockClear();
  try {
    await expect(fetchManifest(source)).rejects.toThrow('unopened transport');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(download.requests).toHaveLength(1);
  } finally { download.restore(); }
});

it.each([404, 429, 503])('does not fall back to encrypted releases or another service on HTTP %s', async status => {
  const download = mockDownload(new Uint8Array(), status);
  jest.mocked(SecureStore.getItemAsync).mockClear();
  try {
    const failed = fetchManifest(source);
    await expect(failed).rejects.toThrow(status === 404 ? 'Refresh data to load the current edition' : `HTTP ${status}`);
    if (status === 404) await expect(failed).rejects.toBeInstanceOf(MissingPublicPayloadError);
    else await expect(failed).rejects.not.toBeInstanceOf(MissingPublicPayloadError);
    expect(download.requests).toHaveLength(1);
    expect(download.requests[0].split('?')[0]).toBe(companion);
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  } finally { download.restore(); }
});

it('does not label unrelated HTTP 404 failures as missing readable history', async () => {
  const download = mockDownload(new Uint8Array(), 404);
  try {
    await expect(fetchManifest('https://example.test/manifest.json')).rejects.not.toBeInstanceOf(MissingPublicPayloadError);
  } finally { download.restore(); }
});

it('rejects readable bytes under a different descriptor hash', async () => {
  const download = mockDownload(gzipSync(strToU8('{"technical":"changed"}')));
  jest.mocked(SecureStore.getItemAsync).mockClear();
  try {
    await expect(downloadInflate(source.replace('manifest.json', 'core.json.gz'), 'f'.repeat(64))).rejects.toThrow('sha256 mismatch');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  } finally { download.restore(); }
});
