import * as Crypto from 'expo-crypto';

import core from '../assets/sample/core.json';
import details from '../assets/sample/details.json';
import { createV1AppHealthSourceContract } from '../src/lib/appHealth/sourceContract';
import { readLiveAppHealthSnapshot } from '../src/lib/appHealthLiveSource';
import {
  installAppHealthTransportGuard,
  type AuditTransportTarget,
} from '../src/lib/appHealthTransportGuard';

describe('live app-health source validation', () => {
  it('rejects a malformed HTTP-success manifest instead of auditing cached state', async () => {
    const originalFetch = globalThis.fetch;
    const contract = createV1AppHealthSourceContract();
    const fetchSpy = jest.fn(async () => ({
      ok: true,
      status: 200,
      redirected: false,
      url: contract.manifestUrl,
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
      url,
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
      expect(fetchSpy).toHaveBeenCalledTimes(4);
      expect(fetchSpy.mock.calls.every(([, init]) => init?.signal === controller.signal)).toBe(true);
      expect(progress.mock.calls.map(([stage]) => stage)).toEqual([
        'manifest:fetched',
        'dates-index:fetched',
        'Core asset:downloaded',
        'Core asset:hash-verified',
        'Core asset:decoded',
        'core:normalized',
        'Details asset:downloaded',
        'Details asset:hash-verified',
        'Details asset:decoded',
      ]);
    } finally {
      guard.restore();
      digest.mockRestore();
      globalThis.fetch = originalFetch;
    }
  });
});
