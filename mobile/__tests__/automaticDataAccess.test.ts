import { gzipSync, strToU8 } from 'fflate';
import * as SecureStore from 'expo-secure-store';
import { automaticDataUrl, APP_DATA_ORIGIN } from '../src/lib/automaticDataAccess';
import { downloadInflate, fetchManifest } from '../src/data/payload';

jest.mock('../src/lib/yieldToUi', () => ({
  yieldToUi: jest.fn(async () => undefined),
  parseJsonHeavy: jest.fn(async (text: string) => JSON.parse(text)),
}));

const source = 'https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json';
it('routes frozen encrypted domain assets without local setup keys', () => {
  expect(automaticDataUrl(source.replace('manifest.json', 'core-2026-09-18-123456789abc.json.gz.enc')))
    .toBe(`${APP_DATA_ORIGIN}/v1/release/app-payload-latest/core-2026-09-18-123456789abc.json.gz.enc`);
});

it.each(['app-payload-latest', 'app-payload-2026-09-18', 'app-payload-2026-09-18-r000002'])(
  'maps %s while preserving immutable domain references', tag => {
    expect(automaticDataUrl(source.replace('app-payload-latest', tag) + '?_=123'))
      .toBe(`${APP_DATA_ORIGIN}/v1/release/${tag}/manifest.json?_=123`);
  });

it.each(['http://github.com/yanniedog/AR-local/releases/download/app-payload-latest/a.json',
  'https://evil.test/a.json', source.replace('AR-local', 'AR-app'), source + '?url=http://localhost',
  source.replace('manifest.json', '%2fprivate.json'), source.replace('manifest.json', '..private.json'),
  source.replace('github.com', 'user:secret@github.com'), source + '#secret',
  source.replace('manifest.json', 'preservation.zip')])('does not proxy unapproved source %s', url => {
  expect(automaticDataUrl(url)).toBeNull();
});

function mockDownload(bytes: Uint8Array, status = 200) {
  const requests: string[] = [];
  const previous = globalThis.XMLHttpRequest;
  class Download {
    status = status;
    response = bytes.slice().buffer;
    onload?: () => void;
    open(_method: string, url: string) { requests.push(url); }
    send() { this.onload?.(); }
    setRequestHeader() { /* accepted service header */ }
  }
  globalThis.XMLHttpRequest = Download as unknown as typeof XMLHttpRequest;
  return { requests, restore: () => { globalThis.XMLHttpRequest = previous; } };
}

it('loads first-launch current and historical manifests with an empty device key store', async () => {
  const raw = { schema_version: 1, run_date: '2026-09-19', files: {} };
  const download = mockDownload(strToU8(JSON.stringify(raw)));
  jest.mocked(SecureStore.getItemAsync).mockClear();
  try {
    await expect(fetchManifest(source)).resolves.toEqual(raw);
    await expect(fetchManifest(source.replace('app-payload-latest', 'app-payload-2026-09-18-r000002'))).resolves.toEqual(raw);
    expect(download.requests.every(url => url.startsWith(APP_DATA_ORIGIN + '/v1/release/'))).toBe(true);
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

it('refuses an unopened service response instead of asking for a key', async () => {
  const bytes = new Uint8Array(80); bytes.set(strToU8('ARE2'));
  const download = mockDownload(bytes);
  jest.mocked(SecureStore.getItemAsync).mockClear();
  try {
    await expect(fetchManifest(source)).rejects.toThrow('unopened transport');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  } finally { download.restore(); }
});
