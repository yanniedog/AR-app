import * as Crypto from 'expo-crypto';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync, strFromU8, strToU8 } from 'fflate';
import { Platform } from 'react-native';
import { automaticDataUrl } from '../src/lib/automaticDataAccess';
import { getNativeHistoryCodec } from '../modules/history-codec';
import * as payload from '../src/data/payload';
import * as yieldWork from '../src/lib/yieldToUi';

import core from '../assets/sample/core.json';
import details from '../assets/sample/details.json';
import { createV1AppHealthSourceContract } from '../src/lib/appHealth/sourceContract';
import { readLiveAppHealthSnapshot } from '../src/lib/appHealthLiveSource';
import {
  installAppHealthTransportGuard,
  type AuditTransportTarget,
} from '../src/lib/appHealthTransportGuard';

jest.mock('../modules/history-codec', () => ({ getNativeHistoryCodec: jest.fn() }));
const getCodec = jest.mocked(getNativeHistoryCodec);
const originalPlatform = Platform.OS;

function compressedFixture() {
  const contract = createV1AppHealthSourceContract();
  const coreText = JSON.stringify({ ...core, sourceProbe: JSON.parse('{"unicode":"Crédit 😀 日本語","__proto__":{"retained":true}}') });
  const detailsText = JSON.stringify({ ...details, sourceProbe: { unicode: 'Crédit 😀 日本語', amount: '1000.00' } });
  const coreBytes = gzipSync(strToU8(coreText));
  const detailsBytes = gzipSync(strToU8(detailsText));
  const assetUrl = (name: string) => `https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/${name}`;
  const descriptor = (name: string, bytes: Uint8Array) => ({ name, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), url: assetUrl(name) });
  const manifest = { schema_version: 1, run_date: core.run_date, files: {
    core: descriptor('core.json.gz', coreBytes), details: descriptor('details.json.gz', detailsBytes),
  } };
  const response = (url: string, value: unknown, bytes?: Uint8Array) => ({
    ok: true, status: 200, redirected: false, url: automaticDataUrl(url), json: async () => value,
    arrayBuffer: async () => bytes!.buffer.slice(bytes!.byteOffset, bytes!.byteOffset + bytes!.byteLength),
  });
  const read = async (onProgress?: (stage: string) => void) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce(response(contract.manifestUrl, manifest))
      .mockResolvedValueOnce(response(contract.datesIndexUrl, { schema_version: 1, dates: [core.run_date],
        count: 1, min_date: core.run_date, latest_date: core.run_date }))
      .mockResolvedValueOnce(response(assetUrl('core.json.gz'), null, coreBytes))
      .mockResolvedValueOnce(response(assetUrl('details.json.gz'), null, detailsBytes));
    const digest = jest.spyOn(Crypto, 'digest').mockImplementation(async (_algorithm, data) =>
      Uint8Array.from(createHash('sha256').update(data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer)).digest()).buffer);
    const guard = installAppHealthTransportGuard({ target: globalThis as unknown as AuditTransportTarget,
      mode: 'live-source', contract });
    try { return await readLiveAppHealthSnapshot({ guard, contract, appVersion: '1.0.0', onProgress }); }
    finally { guard.restore(); digest.mockRestore(); globalThis.fetch = originalFetch; }
  };
  return { read, manifest, coreText, detailsText, coreBytes, detailsBytes };
}

describe('live app-health source validation', () => {
  beforeEach(() => { getCodec.mockReturnValue(null); Object.assign(Platform, { OS: 'android' }); });
  afterEach(() => { jest.restoreAllMocks(); getCodec.mockReset(); Object.assign(Platform, { OS: originalPlatform }); });

  it('rejects a malformed HTTP-success manifest instead of auditing cached state', async () => {
    const originalFetch = globalThis.fetch;
    const contract = createV1AppHealthSourceContract();
    const fetchSpy = jest.fn(async () => ({
      ok: true,
      status: 200,
      redirected: false,
      url: automaticDataUrl(contract.manifestUrl),
      json: async () => ({ schema_version: 1, files: {} }),
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchSpy;
    const guard = installAppHealthTransportGuard({
      target: globalThis as unknown as AuditTransportTarget,
      mode: 'live-source',
      contract,
    });
    try {
      await expect(readLiveAppHealthSnapshot({
        guard,
        contract,
        appVersion: '1.0.0',
      })).rejects.toThrow('Core asset is not a JSON object');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      guard.restore();
      globalThis.fetch = originalFetch;
    }
  });

  it('carries the fetched dates index and verified payload into the live snapshot', async () => {
    const originalFetch = globalThis.fetch;
    const contract = createV1AppHealthSourceContract();
    const encoder = new TextEncoder();
    const coreBytes = encoder.encode(JSON.stringify(core));
    const detailsBytes = encoder.encode(JSON.stringify(details));
    const assetUrl = (name: string) =>
      `https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/${name}`;
    const manifest = {
      schema_version: 1,
      run_date: core.run_date,
      generated_at: `${core.run_date}T01:00:00Z`,
      app_min_version: '1.0.0',
      repo: 'yanniedog/AR-local',
      tag: 'app-payload-latest',
      counts: {},
      schedule: { label: 'daily', next_due_utc: `${core.run_date}T15:00:00Z` },
      files: {
        core: { name: 'core.json', bytes: coreBytes.length, sha256: '0'.repeat(64), url: assetUrl('core.json') },
        details: { name: 'details.json', bytes: detailsBytes.length, sha256: '0'.repeat(64), url: assetUrl('details.json') },
      },
    };
    const response = (url: string, value: unknown, bytes?: Uint8Array) => ({
      ok: true,
      status: 200,
      redirected: false,
      url: automaticDataUrl(url),
      json: async () => value,
      arrayBuffer: async () => bytes?.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    });
    const fetchSpy = jest.fn()
      .mockResolvedValueOnce(response(contract.manifestUrl, manifest))
      .mockResolvedValueOnce(response(contract.datesIndexUrl, {
        schema_version: 1,
        dates: [core.run_date],
        count: 1,
        min_date: core.run_date,
        latest_date: core.run_date,
      }))
      .mockResolvedValueOnce(response(assetUrl('core.json'), null, coreBytes))
      .mockResolvedValueOnce(response(assetUrl('details.json'), null, detailsBytes));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const digest = jest.spyOn(Crypto, 'digest').mockResolvedValue(new Uint8Array(32).buffer);
    const progress = jest.fn();
    const controller = new AbortController();
    const guard = installAppHealthTransportGuard({
      target: globalThis as unknown as AuditTransportTarget,
      mode: 'live-source',
      contract,
    });
    try {
      const snapshot = await readLiveAppHealthSnapshot({
        guard,
        contract,
        appVersion: '1.0.0',
        onProgress: progress,
        signal: controller.signal,
      });
      expect(snapshot.datesIndex).toEqual({ dates: [core.run_date], latestRunDate: core.run_date });
      expect(snapshot.core?.run_date).toBe(core.run_date);
      expect(snapshot.details?.runDate).toBe(core.run_date);
      expect(getCodec).not.toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledTimes(4);
      expect(fetchSpy.mock.calls.every(([, init]) => init?.signal === controller.signal)).toBe(true);
      expect(progress.mock.calls.map(([stage]) => stage)).toEqual([
        'manifest:fetched',
        'dates-index:fetched',
        'Core asset:downloaded',
        'Core asset:hash-verified',
        'Core asset:inflated',
        'Core asset:text-decoded',
        'Core asset:decoded',
        'core:history-sealed',
        'core:normalized',
        'Details asset:downloaded',
        'Details asset:hash-verified',
        'Details asset:inflated',
        'Details asset:text-decoded',
        'Details asset:decoded',
      ]);
    } finally {
      guard.restore();
      digest.mockRestore();
      globalThis.fetch = originalFetch;
    }
  });

  it('uses the existing native codec after verification and preserves the complete Core and Details JSON', async () => {
    const fixture = compressedFixture();
    const portableSnapshot = await fixture.read();
    const fallback = jest.spyOn(payload, 'gunzipCooperatively');
    const parse = jest.spyOn(yieldWork, 'parseJsonHeavy');
    const progress = jest.fn();
    let nativeCalls = 0;
    const inflatePayloadAsync = jest.fn(async (bytes: Uint8Array) => {
      const label = ++nativeCalls === 1 ? 'Core asset' : 'Details asset';
      expect(progress).toHaveBeenLastCalledWith(`${label}:hash-verified`);
      const text = strFromU8(gunzipSync(bytes));
      return [text.slice(0, 65_536), text.slice(65_536)];
    });
    getCodec.mockReturnValue({ compressAsync: jest.fn(), decompressAsync: jest.fn(), inflatePayloadAsync });
    const nativeSnapshot = await fixture.read(progress);
    expect(nativeSnapshot).toEqual(portableSnapshot);
    expect(parse.mock.calls.map(([text]) => text)).toEqual([fixture.coreText, fixture.detailsText]);
    expect(Object.getOwnPropertyDescriptor((nativeSnapshot.core as unknown as { sourceProbe: object }).sourceProbe, '__proto__')?.value)
      .toEqual({ retained: true });
    expect(inflatePayloadAsync.mock.calls.map(([bytes]) => bytes)).toEqual([fixture.coreBytes, fixture.detailsBytes]);
    for (const call of inflatePayloadAsync.mock.calls) expect(call).toEqual([expect.any(Uint8Array), 192 * 1024 * 1024, -1]);
    expect(fallback).not.toHaveBeenCalled();
    for (const label of ['Core asset', 'Details asset']) {
      const stages = progress.mock.calls.map(([stage]) => stage);
      const hash = stages.indexOf(`${label}:hash-verified`);
      expect(stages.slice(hash, hash + 5)).toEqual([
        `${label}:hash-verified`, `${label}:native-inflated-and-text-decoded`,
        `${label}:inflated`, `${label}:text-decoded`, `${label}:decoded`,
      ]);
    }
  });

  it.each(['module', 'method'])('uses the complete portable fallback when the optional native %s is absent', async missing => {
    const fixture = compressedFixture();
    if (missing === 'method') getCodec.mockReturnValue({ compressAsync: jest.fn(), decompressAsync: jest.fn() });
    const fallback = jest.spyOn(payload, 'gunzipCooperatively');
    const parse = jest.spyOn(yieldWork, 'parseJsonHeavy');
    const progress = jest.fn();
    const snapshot = await fixture.read(progress);
    expect(getCodec).toHaveBeenCalledTimes(2);
    expect(fallback).toHaveBeenCalledTimes(2);
    expect(fallback).toHaveBeenNthCalledWith(1, fixture.coreBytes, 64 * 1024, 192 * 1024 * 1024);
    expect(fallback).toHaveBeenNthCalledWith(2, fixture.detailsBytes, 64 * 1024, 192 * 1024 * 1024);
    expect(parse.mock.calls.map(([text]) => text)).toEqual([fixture.coreText, fixture.detailsText]);
    expect(snapshot.details?.productCount).toBe(Object.keys(details.products).length);
    expect(progress.mock.calls.map(([stage]) => stage)).not.toContain('Core asset:native-inflated-and-text-decoded');
  });

  it.each(['CRC mismatch', 'Payload exceeds decoded budget', 'Invalid UTF-8'])(
    'propagates supported native validation failure %s without a portable retry or partial snapshot', async message => {
      const fixture = compressedFixture();
      const error = new Error(message);
      const inflatePayloadAsync = jest.fn().mockRejectedValue(error);
      getCodec.mockReturnValue({ compressAsync: jest.fn(), decompressAsync: jest.fn(), inflatePayloadAsync });
      const fallback = jest.spyOn(payload, 'gunzipCooperatively');
      const parse = jest.spyOn(yieldWork, 'parseJsonHeavy');
      const progress = jest.fn();
      await expect(fixture.read(progress)).rejects.toBe(error);
      expect(inflatePayloadAsync).toHaveBeenCalledTimes(1);
      expect(inflatePayloadAsync).toHaveBeenCalledWith(fixture.coreBytes, 192 * 1024 * 1024, -1);
      expect(fallback).not.toHaveBeenCalled();
      expect(parse).not.toHaveBeenCalled();
      expect(progress).toHaveBeenLastCalledWith('Core asset:hash-verified');
    },
  );

  it.each(['bytes', 'sha256'] as const)('rejects an invalid compressed %s receipt before invoking any codec', async field => {
    const fixture = compressedFixture();
    if (field === 'bytes') fixture.manifest.files.core.bytes += 1;
    else fixture.manifest.files.core.sha256 = '0'.repeat(64);
    const inflatePayloadAsync = jest.fn();
    getCodec.mockReturnValue({ compressAsync: jest.fn(), decompressAsync: jest.fn(), inflatePayloadAsync });
    const fallback = jest.spyOn(payload, 'gunzipCooperatively');
    await expect(fixture.read()).rejects.toThrow(field === 'bytes' ? 'size mismatch' : 'sha256 mismatch');
    expect(getCodec).not.toHaveBeenCalled();
    expect(inflatePayloadAsync).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });
});
