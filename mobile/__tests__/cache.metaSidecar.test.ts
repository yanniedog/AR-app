import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { verifiedDetailsSha } from '../src/data/detailsIdentity';

import { cache, v3GenerationCache, type CacheMeta } from '../src/data/cache';
import { sampleCore, sampleManifest } from '../src/data/sample';
import { revisionHead, revisionManifest } from '../testUtils/payloadRevision';
import { compressCatalogue } from '../src/data/historicalBankRateCatalogueCompression';
import { decodeSavedHistoricalCatalogueAsync } from '../src/data/historicalBankRateCatalogueSync';
import * as uiYield from '../src/lib/yieldToUi';
import type { RbaMarketOutlook } from '../src/data/rbaMarketOutlookTypes';

const files = new Map<string, string>();

function marketContext(checkedAt = '2026-09-22T00:00:00.000Z'): RbaMarketOutlook {
  return {
    schema_version: 1,
    fetchedAt: checkedAt,
    checkedAt,
    refreshStatus: 'partial',
    bondForwards: null,
    economists: {
      surveyDate: '2026-08-01', publicationDate: '2026-08-28',
      points: [{ date: '2026-12-01', value: 4.35 }],
    },
  };
}

function resetFs() {
  files.clear();
  (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (path: string) => ({
    exists: files.has(path) || path.endsWith('payload/'),
    isDirectory: path.endsWith('payload/'),
  }));
  (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async (path: string) => {
    if (!files.has(path)) throw new Error(`missing ${path}`);
    return files.get(path)!;
  });
  (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (path: string, contents: string) => {
    files.set(path, contents);
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
  (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(async (path: string) =>
    [...files.keys()].filter((file) => file.startsWith(path)).map((file) => file.slice(path.length)));
}

describe('cache core-meta sidecar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFs();
  });

  it('stores RBA market context separately and recovers a completed temporary write after an interrupted move', async () => {
    const context = marketContext();
    files.set(`${FileSystem.documentDirectory}payload/rba-economic-outlook.json`, '{"existing":"untouched"}');
    (FileSystem.moveAsync as jest.Mock).mockRejectedValueOnce(new Error('interrupted move'));
    await expect(cache.writeRbaMarketOutlook(context)).rejects.toThrow('interrupted move');
    expect(await cache.readRbaMarketOutlook()).toEqual(context);
    expect(files.get(`${FileSystem.documentDirectory}payload/rba-economic-outlook.json`)).toBe('{"existing":"untouched"}');
    await cache.writeRbaMarketOutlook(context);
    expect(files.has(`${FileSystem.documentDirectory}payload/rba-market-outlook.json.tmp`)).toBe(false);
    expect(await cache.readRbaMarketOutlook()).toEqual(context);
  });

  it('recovers complete bank-rate history after its final move is interrupted', async () => {
    const path = `${FileSystem.documentDirectory}payload/bank-rate-history.json`;
    await cache.writeBankRateHistory('{"edition":"previous"}');
    const corrected = '{"edition":"corrected","historical_revision":2}';
    (FileSystem.moveAsync as jest.Mock).mockRejectedValueOnce(new Error('interrupted history move'));
    await expect(cache.writeBankRateHistory(corrected)).rejects.toThrow('interrupted history move');
    expect(files.has(path)).toBe(false);
    expect(files.get(`${path}.tmp`)).toBe(corrected);
    expect(await cache.readBankRateHistory(JSON.parse)).toEqual(JSON.parse(corrected));
    await cache.writeBankRateHistory(corrected);
    expect(await cache.readBankRateHistory(JSON.parse)).toEqual(JSON.parse(corrected));
    expect(files.has(`${path}.tmp`)).toBe(false);
  });

  it('recovers a completed bank-history temporary write before the older primary is deleted', async () => {
    const path = `${FileSystem.documentDirectory}payload/bank-rate-history.json`;
    const previous = '{"historical_revision":1}';
    const corrected = '{"historical_revision":2}';
    await cache.writeBankRateHistory(previous);
    (FileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(new Error('interrupted history delete'));
    await expect(cache.writeBankRateHistory(corrected)).rejects.toThrow('interrupted history delete');
    expect(files.get(path)).toBe(previous);
    expect(files.get(`${path}.tmp`)).toBe(corrected);
    expect(await cache.readBankRateHistory(JSON.parse)).toEqual({ historical_revision: 2 });
  });

  it.each(['{broken', '{"historical_revision":99}'])(
    'falls back to the valid bank-history primary when a temporary checkpoint fails decoding: %s',
    async broken => {
      const path = `${FileSystem.documentDirectory}payload/bank-rate-history.json`;
      files.set(path, '{"historical_revision":1}');
      files.set(`${path}.tmp`, broken);
      const decode = (text: string) => {
        const value = JSON.parse(text);
        return value.historical_revision === 1 ? value : null;
      };
      expect(await cache.readBankRateHistory(decode)).toEqual({ historical_revision: 1 });
      files.delete(path);
      expect(await cache.readBankRateHistory(decode)).toBeNull();
    },
  );

  it.each(['accepted', 'rejected', 'throws'])('awaits an asynchronous bank-history checkpoint validator: %s', async result => {
    const path = `${FileSystem.documentDirectory}payload/bank-rate-history.json`;
    files.set(path, '{"historical_revision":1}');
    files.set(`${path}.tmp`, '{"historical_revision":2}');
    const decode = async (text: string) => {
      await Promise.resolve();
      const value = JSON.parse(text) as { historical_revision: number };
      if (value.historical_revision === 2) {
        if (result === 'throws') throw new Error('Invalid temporary checkpoint');
        if (result === 'rejected') return null;
      }
      return value;
    };
    expect(await cache.readBankRateHistory(decode)).toEqual({ historical_revision: result === 'accepted' ? 2 : 1 });
  });

  it.each(['digest', 'schema'])('recovers the verified primary when cooperative catalogue recovery rejects the temporary %s', async corruption => {
    const path = `${FileSystem.documentDirectory}payload/bank-rate-history.json`;
    const manifest = revisionManifest(1), day = manifest.run_date, head = revisionHead(manifest);
    const value = { schema_version: 2, core_bindings: { [day]: { core_sha256: manifest.files.core.sha256, manifest_sha256: head.manifest_sha256 } },
      index: { schema_version: 1, revision_protocol: 1, dates: [day], min_date: day, latest_date: day, count: 1, revision_heads: { [day]: head } },
      catalogue: { schema_version: 2, run_dates: [day], sources: {}, unavailable_dates: {}, evidence: [{ status: 'unknown' }],
        sections: { Mortgage: [], Savings: [], TD: [] } } };
    files.set(path, JSON.stringify(compressCatalogue(value)));
    const temporary = corruption === 'schema' ? compressCatalogue({ ...value, schema_version: 99 }) :
      { ...compressCatalogue(value), sha256: 'f'.repeat(64) };
    files.set(`${path}.tmp`, JSON.stringify(temporary));
    const yieldWork = jest.spyOn(uiYield, 'yieldToUi').mockResolvedValue(undefined);
    try {
      expect(await cache.readBankRateHistory(decodeSavedHistoricalCatalogueAsync)).toEqual(value);
      expect(FileSystem.readAsStringAsync).toHaveBeenNthCalledWith(1, `${path}.tmp`);
      expect(FileSystem.readAsStringAsync).toHaveBeenNthCalledWith(2, path);
    } finally { yieldWork.mockRestore(); }
  });

  it.each(['{broken', '{"schema_version":99}'])(
    'recovers a valid temporary RBA cache when the primary is malformed: %s',
    async (broken) => {
      const path = `${FileSystem.documentDirectory}payload/rba-market-outlook.json`;
      const temporary = marketContext();
      files.set(path, broken);
      files.set(`${path}.tmp`, JSON.stringify(temporary));
      expect(await cache.readRbaMarketOutlook()).toEqual(temporary);
    },
  );

  it('recovers the latest completed RBA write without letting an older temporary file replace it', async () => {
    const path = `${FileSystem.documentDirectory}payload/rba-market-outlook.json`;
    const old = marketContext('2026-09-21T00:00:00.000Z');
    const recent = marketContext();
    recent.economists!.points[0].value = 4.5;
    files.set(path, JSON.stringify(old));
    files.set(`${path}.tmp`, JSON.stringify(recent));
    expect(await cache.readRbaMarketOutlook()).toEqual(recent);
    files.set(path, JSON.stringify(recent));
    files.set(`${path}.tmp`, JSON.stringify(old));
    expect(await cache.readRbaMarketOutlook()).toEqual(recent);
  });

  it('keeps a newer source vintage even when the temporary cache was checked more recently', async () => {
    const path = `${FileSystem.documentDirectory}payload/rba-market-outlook.json`;
    const primary = marketContext('2026-09-21T00:00:00.000Z');
    primary.economists!.surveyDate = '2026-09-01';
    primary.economists!.publicationDate = '2026-09-04';
    const temporary = marketContext();
    files.set(path, JSON.stringify(primary));
    files.set(`${path}.tmp`, JSON.stringify(temporary));
    expect(await cache.readRbaMarketOutlook()).toMatchObject({
      checkedAt: temporary.checkedAt,
      economists: primary.economists,
      refreshStatus: 'partial',
    });
  });

  it('binds the exact stored details bytes and rejects valid-JSON replacement or missing identity', async () => {
    const digest = jest.spyOn(Crypto, 'digestStringAsync').mockImplementation(async (_algorithm, text) => jest.requireActual('crypto').createHash('sha256').update(text).digest('hex'));
    try {
      const installed = revisionManifest(1), sha = installed.files.details.sha256;
      const details = { schema_version: 1, run_date: installed.run_date, products: {} };
      await cache.writeDetails(JSON.stringify(details), sha);
      await cache.writeBundle({ manifest: installed, source: 'remote', savedAt: installed.generated_at, coreSha: installed.files.core.sha256, detailsSha: sha }, JSON.stringify(sampleCore));
      expect(verifiedDetailsSha((await cache.readDetails())!)).toBe(sha);
      const file = `${FileSystem.documentDirectory}payload/details.json.${sha}`;
      files.set(file, JSON.stringify({ ...details, products: { changed: {} } }));
      expect(verifiedDetailsSha((await cache.readDetails())!)).toBeNull();
      files.set(file, JSON.stringify(details)); files.delete(`${file}.verified`);
      expect(verifiedDetailsSha((await cache.readDetails())!)).toBeNull();
    } finally { digest.mockRestore(); }
  });

  it('retains installed revision details while a new edition is staged', async () => {
    const installed = revisionManifest(1);
    const details = { schema_version: 1, run_date: installed.run_date, products: {} };
    await cache.writeDetails(JSON.stringify(details), installed.files.details.sha256);
    await cache.writeBundle({ manifest: installed, source: 'remote', savedAt: installed.generated_at,
      coreSha: installed.files.core.sha256, detailsSha: installed.files.details.sha256 }, JSON.stringify(sampleCore));
    await cache.writeDetails('{}', 'f'.repeat(64));
    await cache.writeHistoryBanks('{}');
    expect(await cache.readDetails()).toEqual(details);
    expect(await cache.readHistoryBanks()).toBeNull();
    await cache.updateMeta({ manifest: revisionManifest(2), coreSha: installed.files.core.sha256, detailsSha: 'f'.repeat(64) });
    expect((await cache.readMeta())?.manifest.payload_revision?.revision).toBe(1);
    await cache.writeBundle({ manifest: revisionManifest(2), source: 'remote', savedAt: installed.generated_at,
      coreSha: installed.files.core.sha256, detailsSha: installed.files.details.sha256 }, JSON.stringify(sampleCore));
    await expect(cache.writeBundle({ manifest: installed, source: 'remote', savedAt: installed.generated_at,
      coreSha: installed.files.core.sha256, detailsSha: null }, JSON.stringify(sampleCore))).rejects.toThrow('stale');
    expect((await cache.readMeta())?.manifest.payload_revision?.revision).toBe(2);
  });

  it('prunes old unreferenced revision assets while protecting recent staging and the previous edition', async () => {
    const current = revisionManifest(2);
    const previous = revisionManifest(1, { files: { ...sampleManifest.files,
      details: { ...sampleManifest.files.details, sha256: 'a'.repeat(64) } } });
    const path = `${FileSystem.documentDirectory}payload/details.json.`;
    await cache.writeDetails('{}', previous.files.details.sha256);
    await cache.writeBundle({ manifest: previous, source: 'remote', savedAt: previous.generated_at,
      coreSha: previous.files.core.sha256, detailsSha: previous.files.details.sha256 }, JSON.stringify(sampleCore));
    files.set(`${path}${previous.files.details.sha256}.created`, String(Date.now() - 3 * 24 * 60 * 60 * 1000));
    const old = path + 'e'.repeat(64);
    const pending = path + 'f'.repeat(64);
    files.set(old, '{}');
    files.set(`${old}.created`, String(Date.now() - 2 * 24 * 60 * 60 * 1000));
    files.set(pending, '{}');
    files.set(`${pending}.created`, String(Date.now()));
    await cache.writeDetails('{}', current.files.details.sha256);
    await cache.writeBundle({ manifest: current, source: 'remote', savedAt: current.generated_at,
      coreSha: current.files.core.sha256, detailsSha: current.files.details.sha256 }, JSON.stringify(sampleCore));
    expect(files.has(old)).toBe(false);
    expect(files.has(pending)).toBe(true);
    expect(files.has(path + current.files.details.sha256)).toBe(true);
    expect(files.has(path + previous.files.details.sha256)).toBe(true);
  });

  it('writeBundle stores a tiny core-meta sidecar and updateMeta never rewrites the bundle', async () => {
    const meta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: null,
    };
    const coreText = JSON.stringify(sampleCore);
    await cache.writeBundle(meta, coreText);

    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    const bundlePath = `${FileSystem.documentDirectory}payload/core-bundle.json`;
    expect(files.has(metaPath)).toBe(true);
    expect(files.has(bundlePath)).toBe(true);
    const bundleBefore = files.get(bundlePath)!;

    await cache.updateMeta({
      manifest: sampleManifest,
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: sampleManifest.files.details.sha256,
      savedAt: '2026-07-14T01:00:00Z',
      source: 'remote',
    });

    expect(files.get(bundlePath)).toBe(bundleBefore);
    const read = await cache.readMeta();
    expect(read?.detailsSha).toBe(sampleManifest.files.details.sha256);
    // Sidecar stays tiny relative to embedding a multi-MB core rewrite.
    expect(files.get(metaPath)!.length).toBeLessThan(bundleBefore.length);
  });

  it('readMeta falls back to embedded bundle meta when sidecar is missing', async () => {
    const meta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: 'embedded-details-sha',
    };
    const bundlePath = `${FileSystem.documentDirectory}payload/core-bundle.json`;
    files.set(bundlePath, JSON.stringify({ meta, core: sampleCore }));

    const read = await cache.readMeta();
    expect(read?.detailsSha).toBe('embedded-details-sha');
    expect(read?.coreSha).toBe(sampleManifest.files.core.sha256);
  });

  it('writeBundle invalidates a prior sidecar before committing the new bundle', async () => {
    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    const bundlePath = `${FileSystem.documentDirectory}payload/core-bundle.json`;
    const oldMeta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-13T00:00:00Z',
      coreSha: 'old-core-sha',
      detailsSha: 'old-details-sha',
    };
    files.set(metaPath, JSON.stringify(oldMeta));
    files.set(bundlePath, JSON.stringify({ meta: oldMeta, core: sampleCore }));

    const newMeta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: null,
    };
    await cache.writeBundle(newMeta, JSON.stringify(sampleCore));

    const read = await cache.readMeta();
    expect(read?.coreSha).toBe(sampleManifest.files.core.sha256);
    expect(read?.detailsSha).toBeNull();
    expect(JSON.parse(files.get(metaPath)!).coreSha).toBe(sampleManifest.files.core.sha256);
  });

  it('readMeta falls back to tmp bundle when the main bundle is missing', async () => {
    const meta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: 'tmp-details-sha',
    };
    const tmpPath = `${FileSystem.documentDirectory}payload/core-bundle.json.tmp`;
    files.set(tmpPath, JSON.stringify({ meta, core: sampleCore }));

    const read = await cache.readMeta();
    expect(read?.detailsSha).toBe('tmp-details-sha');
    expect(read?.coreSha).toBe(sampleManifest.files.core.sha256);
  });

  it('readMeta recovers core-meta.tmp when the final sidecar move did not finish', async () => {
    const meta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: 'tmp-sidecar-details',
    };
    const tmpMetaPath = `${FileSystem.documentDirectory}payload/core-meta.json.tmp`;
    files.set(tmpMetaPath, JSON.stringify(meta));

    const read = await cache.readMeta();
    expect(read?.detailsSha).toBe('tmp-sidecar-details');
  });

  it('propagates native bank-spread cache read failures instead of treating them as a miss', async () => {
    const indexPath = `${FileSystem.documentDirectory}payload/bank-spread-history-v2/index.json`;
    (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (path: string) => {
      if (path === indexPath) throw new Error('native read failed');
      return { exists: files.has(path) || path.endsWith('payload/'), isDirectory: path.endsWith('payload/') };
    });

    await expect(cache.readBankSpreadHistoryFor(
      'a'.repeat(64),
      'b'.repeat(64),
      sampleCore.run_date,
      () => true,
    )).rejects.toThrow(/native read failed/);
  });

  it('propagates native v3 cache read failures instead of treating them as an empty cache', async () => {
    const headPath = `${FileSystem.documentDirectory}payload/v3/head.json`;
    (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (path: string) => {
      if (path === headPath) throw new Error('native v3 read failed');
      return { exists: files.has(path) || path.endsWith('payload/'), isDirectory: path.endsWith('payload/') };
    });

    await expect(v3GenerationCache.readCurrent()).rejects.toThrow(/native v3 read failed/);
  });

  it('writeBundle still succeeds when the core-meta sidecar write fails', async () => {
    const meta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: null,
    };
    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    const metaTmpPath = `${FileSystem.documentDirectory}payload/core-meta.json.tmp`;
    (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (path: string, contents: string) => {
      if (path === metaTmpPath) throw new Error('sidecar write failed');
      files.set(path, contents);
    });

    await expect(cache.writeBundle(meta, JSON.stringify(sampleCore))).resolves.toBeUndefined();
    expect(files.has(`${FileSystem.documentDirectory}payload/core-bundle.json`)).toBe(true);
    expect(files.has(metaPath)).toBe(false);
    const read = await cache.readMeta();
    expect(read?.coreSha).toBe(sampleManifest.files.core.sha256);
  });

  it('readBundle prefers a matching sidecar and ignores a mismatched coreSha sidecar', async () => {
    const meta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: null,
    };
    await cache.writeBundle(meta, JSON.stringify(sampleCore));

    const sidecarMeta: CacheMeta = {
      ...meta,
      detailsSha: 'sidecar-details-sha-1234',
      savedAt: '2026-07-14T01:00:00Z',
    };
    await cache.updateMeta(sidecarMeta);
    const withSidecar = await cache.readBundle();
    expect(withSidecar?.meta.detailsSha).toBe('sidecar-details-sha-1234');
    expect(withSidecar?.integrity.generationDigest).toBeNull();
    expect(withSidecar?.integrity.coreSha256).toBe(sampleManifest.files.core.sha256);

    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    // updateMeta no-ops on coreSha mismatch, so plant a stale sidecar directly.
    files.set(
      metaPath,
      JSON.stringify({
        ...sidecarMeta,
        coreSha: 'stale-core-sha-5678',
      }),
    );
    const withStale = await cache.readBundle();
    expect(withStale?.meta.detailsSha).toBeNull();
    expect(withStale?.meta.coreSha).toBe(sampleManifest.files.core.sha256);
    expect(withStale?.integrity.generationDigest).toBeNull();
  });

  it('atomically writes product-history checkpoints and recovers a complete tmp file', async () => {
    const productHistoryPath = `${FileSystem.documentDirectory}payload/product-history.json`;
    const productHistoryTmpPath = `${productHistoryPath}.tmp`;
    const first = JSON.stringify({
      schema_version: 2,
      run_date: '2026-07-28',
      run_dates: ['2026-07-28'],
      products: { 'P|1': [0.055] },
    });

    await cache.writeProductHistory(first);

    expect(files.get(productHistoryPath)).toBe(first);
    expect(files.has(productHistoryTmpPath)).toBe(false);
    const recovered = JSON.stringify({
      schema_version: 2,
      run_date: '2026-07-28',
      run_dates: ['2026-07-27', '2026-07-28'],
      products: { 'P|1': [0.06, 0.055] },
    });
    files.delete(productHistoryPath);
    files.set(productHistoryTmpPath, recovered);

    await expect(cache.readProductHistory()).resolves.toEqual(JSON.parse(recovered));
  });

  it('deletes an invalid product-history tmp checkpoint instead of retrying it', async () => {
    const productHistoryPath = `${FileSystem.documentDirectory}payload/product-history.json`;
    const productHistoryTmpPath = `${productHistoryPath}.tmp`;
    files.set(productHistoryTmpPath, JSON.stringify({ schema_version: 2, run_dates: ['invalid'] }));

    await expect(cache.readProductHistory()).resolves.toBeNull();
    expect(files.has(productHistoryTmpPath)).toBe(false);
  });

  it('updateMeta no-ops on coreSha mismatch and older manifests', async () => {
    const meta: CacheMeta = {
      manifest: { ...sampleManifest, generated_at: '2026-07-14T12:00:00Z' },
      source: 'remote',
      savedAt: '2026-07-14T12:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: 'keep-me',
    };
    await cache.writeBundle(meta, JSON.stringify(sampleCore));
    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    const before = files.get(metaPath)!;

    await cache.updateMeta({
      manifest: sampleManifest,
      coreSha: 'other-core-sha',
      detailsSha: 'should-not-apply',
      savedAt: '2026-07-14T13:00:00Z',
      source: 'remote',
    });
    expect(files.get(metaPath)).toBe(before);

    await cache.updateMeta({
      manifest: { ...sampleManifest, generated_at: '2026-07-13T00:00:00Z' },
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: 'older-should-not-apply',
      savedAt: '2026-07-14T13:00:00Z',
      source: 'remote',
    });
    expect(files.get(metaPath)).toBe(before);
    expect((await cache.readMeta())?.detailsSha).toBe('keep-me');
  });
});
