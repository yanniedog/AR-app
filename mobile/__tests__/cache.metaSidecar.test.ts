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
import type { DatesIndex } from '../src/data/datesIndex';
import { revisionTag } from '../src/data/payloadRevision';
import type { Manifest } from '../src/types';

const files = new Map<string, string>();

/** Publication receipts around the captured sample; no replacement business data. */
function historyRecoveryMeta(manifest: Manifest = revisionManifest(1), historicalRevision = 3): CacheMeta {
  const priorDay = new Date(Date.parse(`${manifest.run_date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const historyDatesIndex: DatesIndex = {
    schema_version: 1, revision_protocol: 1, dates: [priorDay, manifest.run_date],
    count: 2, min_date: priorDay, latest_date: manifest.run_date,
    revision_heads: {
      [priorDay]: { ...revisionHead(manifest), revision: historicalRevision,
        generation_id: `historical-${historicalRevision}`, bundle_sha256: String(historicalRevision).padStart(64, '0'),
        manifest_url: `https://github.com/${manifest.repo}/releases/download/${revisionTag(priorDay, historicalRevision)}/manifest.json` },
      [manifest.run_date]: revisionHead(manifest),
    },
  };
  return { manifest, source: 'remote', savedAt: manifest.generated_at,
    coreSha: manifest.files.core.sha256, detailsSha: manifest.files.details.sha256, historyDatesIndex };
}

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

  it('retains a sidecar-only historical correction when the next bundle write is interrupted before staging', async () => {
    const embedded = { ...historyRecoveryMeta(revisionManifest(1), 2),
      detailsSha: null, historyBanksSha: '7'.repeat(64) };
    await cache.writeBundle(embedded, JSON.stringify(sampleCore));
    const corrected = historyRecoveryMeta(embedded.manifest, 3);
    await cache.updateMeta({ manifest: corrected.manifest, coreSha: corrected.coreSha,
      detailsSha: corrected.detailsSha, historyBanksSha: '8'.repeat(64),
      historyDatesIndex: corrected.historyDatesIndex });
    expect((await cache.readMeta())?.historyDatesIndex).toEqual(corrected.historyDatesIndex);
    const next = historyRecoveryMeta(revisionManifest(2), 3);
    const bundlePath = `${FileSystem.documentDirectory}payload/core-bundle.json`;
    const before = files.get(bundlePath);
    const write = (FileSystem.writeAsStringAsync as jest.Mock).getMockImplementation()!;
    (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (path: string, contents: string) => {
      if (path === `${bundlePath}.tmp`) throw new Error('interrupted before staging bundle');
      return write(path, contents);
    });

    await expect(cache.writeBundle(next, JSON.stringify(sampleCore))).rejects.toThrow('interrupted before staging bundle');

    expect(files.get(bundlePath)).toBe(before);
    expect(files.has(`${FileSystem.documentDirectory}payload/bank-rate-history.json`)).toBe(false);
    // The deferred catalogue checkpoint has not run; the receipt alone must
    // prevent bootstrap from reusing superseded observations in that checkpoint.
    // A recovery copy contributes no details/optional-asset metadata.
    const expected = { ...embedded, historyDatesIndex: corrected.historyDatesIndex };
    expect(await cache.readMeta()).toEqual(expected);
    expect((await cache.readBundle())?.meta).toEqual(expected);
  });

  it('does not replace a newer embedded receipt with the same-core repair recovery copy', async () => {
    const embedded = historyRecoveryMeta(revisionManifest(1), 2);
    await cache.writeBundle(embedded, JSON.stringify(sampleCore));
    const corrected = historyRecoveryMeta(embedded.manifest, 3);
    await cache.updateMeta({ manifest: corrected.manifest, coreSha: corrected.coreSha,
      historyDatesIndex: corrected.historyDatesIndex });
    // A repair can adopt a newer historical selection without changing today's
    // core SHA, revision, or other immutable edition identities.
    const repaired = historyRecoveryMeta(embedded.manifest, 4);
    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    const write = (FileSystem.writeAsStringAsync as jest.Mock).getMockImplementation()!;
    (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (path: string, contents: string) => {
      if (path === `${metaPath}.tmp`) throw new Error('interrupted repair sidecar');
      return write(path, contents);
    });

    await expect(cache.writeBundle(repaired, JSON.stringify(sampleCore))).resolves.toBeUndefined();

    expect(files.has(metaPath)).toBe(false);
    expect(await cache.readMeta()).toEqual(repaired);
    expect((await cache.readBundle())?.meta).toEqual(repaired);
  });

  it.each(['bundle move', 'sidecar write', 'sidecar move'])(
    'recovers the new core and its embedded history receipt after an interrupted %s', async interruption => {
      const old = historyRecoveryMeta(revisionManifest(1), 2);
      await cache.writeBundle(old, JSON.stringify(sampleCore));
      const next = historyRecoveryMeta(revisionManifest(2, { files: { ...sampleManifest.files,
        core: { ...sampleManifest.files.core, sha256: 'b'.repeat(64) } } }));
      const bundlePath = `${FileSystem.documentDirectory}payload/core-bundle.json`;
      const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
      const move = (FileSystem.moveAsync as jest.Mock).getMockImplementation()!;
      const write = (FileSystem.writeAsStringAsync as jest.Mock).getMockImplementation()!;
      (FileSystem.moveAsync as jest.Mock).mockImplementation(async args => {
        if ((interruption === 'bundle move' && args.to === bundlePath) ||
            (interruption === 'sidecar move' && args.to === metaPath)) throw new Error('interrupted commit');
        return move(args);
      });
      (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (path: string, contents: string) => {
        if (interruption === 'sidecar write' && path === `${metaPath}.tmp`) throw new Error('interrupted sidecar');
        return write(path, contents);
      });

      const committing = cache.writeBundle(next, JSON.stringify(sampleCore));
      if (interruption === 'bundle move') await expect(committing).rejects.toThrow('interrupted commit');
      else await expect(committing).resolves.toBeUndefined();

      expect(files.has(metaPath)).toBe(false);
      expect(files.has(`${FileSystem.documentDirectory}payload/bank-rate-history.json`)).toBe(false);
      const committedPath = interruption === 'bundle move' ? `${bundlePath}.tmp` : bundlePath;
      expect(JSON.parse(files.get(committedPath)!).meta.historyDatesIndex).toEqual(next.historyDatesIndex);
      expect(await cache.readMeta()).toEqual(next);
      const restored = await cache.readBundle();
      expect(restored?.meta).toEqual(next);
      expect(restored?.integrity.coreSha256).toBe(next.coreSha);
    },
  );

  it.each(['delete', 'move'])('recovers an index-only sidecar update after its final %s is interrupted', async interruption => {
    const old = { ...historyRecoveryMeta(revisionManifest(1), 2), detailsSha: null };
    const next = historyRecoveryMeta(old.manifest, 3);
    await cache.writeBundle(old, JSON.stringify(sampleCore));
    const bundlePath = `${FileSystem.documentDirectory}payload/core-bundle.json`;
    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    const bundleBefore = files.get(bundlePath);
    const interruptedOperation = interruption === 'delete' ? FileSystem.deleteAsync : FileSystem.moveAsync;
    (interruptedOperation as jest.Mock).mockRejectedValueOnce(new Error(`interrupted sidecar ${interruption}`));

    await expect(cache.updateMeta({ manifest: next.manifest, coreSha: next.coreSha,
      detailsSha: next.detailsSha, historyDatesIndex: next.historyDatesIndex })).rejects.toThrow(`interrupted sidecar ${interruption}`);

    expect(files.has(metaPath)).toBe(interruption === 'delete');
    if (interruption === 'delete') expect(JSON.parse(files.get(metaPath)!)).toEqual(old);
    expect(JSON.parse(files.get(`${metaPath}.tmp`)!).historyDatesIndex).toEqual(next.historyDatesIndex);
    expect(files.get(bundlePath)).toBe(bundleBefore);
    expect(await cache.readMeta()).toEqual(next);
    expect((await cache.readBundle())?.meta).toEqual(next);
    await expect(cache.updateMeta({ manifest: old.manifest, coreSha: old.coreSha,
      historyDatesIndex: old.historyDatesIndex })).rejects.toThrow('Historical publication index is stale');
  });

  it.each(['older revision', 'equivocated revision', 'equal heads', 'different core SHA', 'different payload revision',
    'different manifest details SHA', 'malformed receipt', 'malformed manifest'])(
    'retains the primary metadata when a completed temporary sidecar has %s', async kind => {
      const primary = historyRecoveryMeta();
      await cache.writeBundle(primary, JSON.stringify(sampleCore));
      const temp = { ...historyRecoveryMeta(kind === 'different payload revision' ? revisionManifest(2) : primary.manifest,
        kind === 'older revision' ? 2 : kind === 'equal heads' || kind === 'equivocated revision' ? 3 : 4),
      savedAt: '2030-01-01T00:00:00Z', historyBanksSha: 'e'.repeat(64) };
      if (kind === 'equivocated revision') temp.historyDatesIndex!.revision_heads![temp.historyDatesIndex!.min_date].manifest_sha256 = 'f'.repeat(64);
      if (kind === 'different core SHA') temp.coreSha = 'f'.repeat(64);
      if (kind === 'different manifest details SHA') temp.manifest = { ...temp.manifest,
        files: { ...temp.manifest.files, details: { ...temp.manifest.files.details, sha256: 'f'.repeat(64) } } };
      if (kind === 'malformed receipt') temp.historyDatesIndex = { dates: [null] } as unknown as DatesIndex;
      if (kind === 'malformed manifest') temp.manifest = { generated_at: primary.manifest.generated_at } as Manifest;
      const path = `${FileSystem.documentDirectory}payload/core-meta.json`;
      files.set(`${path}.tmp`, JSON.stringify(temp));
      const before = new Map(files);

      expect(await cache.readMeta()).toEqual(primary);
      expect((await cache.readBundle())?.meta).toEqual(primary);
      expect(files).toEqual(before);
    },
  );

  it.each(['missing', 'malformed'])('recovers a valid temporary receipt when the primary receipt is %s', async kind => {
    const primary = historyRecoveryMeta();
    await cache.writeBundle(primary, JSON.stringify(sampleCore));
    const temp = { ...historyRecoveryMeta(primary.manifest, 4), historyBanksSha: 'e'.repeat(64) };
    const path = `${FileSystem.documentDirectory}payload/core-meta.json`;
    files.set(path, JSON.stringify({ ...primary, historyDatesIndex: kind === 'missing' ? undefined : { dates: [null] } }));
    files.set(`${path}.tmp`, JSON.stringify(temp));

    expect(await cache.readMeta()).toEqual(temp);
    expect((await cache.readBundle())?.meta).toEqual(temp);
  });

  it('preserves the selected history receipt through a details-only metadata patch', async () => {
    const meta = historyRecoveryMeta();
    await cache.writeBundle({ ...meta, detailsSha: null }, JSON.stringify(sampleCore));
    const bundlePath = `${FileSystem.documentDirectory}payload/core-bundle.json`;
    const before = files.get(bundlePath);
    await cache.updateMeta({ manifest: meta.manifest, coreSha: meta.coreSha,
      detailsSha: meta.manifest.files.details.sha256 });
    expect(files.get(bundlePath)).toBe(before);
    expect(await cache.readMeta()).toMatchObject({ detailsSha: meta.manifest.files.details.sha256,
      historyDatesIndex: meta.historyDatesIndex });
    expect((await cache.readBundle())?.meta.historyDatesIndex).toEqual(meta.historyDatesIndex);
  });

  it('does not let a corrupt inherited optional receipt block details recovery', async () => {
    const meta = historyRecoveryMeta();
    await cache.writeBundle({ ...meta, detailsSha: null }, JSON.stringify(sampleCore));
    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    files.set(metaPath, JSON.stringify({ ...meta, detailsSha: null, historyDatesIndex: { dates: [null] } }));
    await cache.updateMeta({ manifest: meta.manifest, coreSha: meta.coreSha,
      detailsSha: meta.manifest.files.details.sha256 });
    expect((await cache.readMeta())?.detailsSha).toBe(meta.manifest.files.details.sha256);
    expect((await cache.readBundle())?.meta.historyDatesIndex).toBeUndefined();
  });

  describe.each(['updateMeta', 'writeBundle'] as const)('%s history receipt protection', operation => {
    it.each(['older revision', 'equivocated revision', 'missing historical head'])(
      'rejects a %s before changing any disk bytes', async corruption => {
        const installed = historyRecoveryMeta();
        await cache.writeBundle(installed, JSON.stringify(sampleCore));
        const next = historyRecoveryMeta(installed.manifest, corruption === 'older revision' ? 2 : 3);
        const day = next.historyDatesIndex!.min_date;
        if (corruption === 'equivocated revision') next.historyDatesIndex!.revision_heads![day].manifest_sha256 = 'f'.repeat(64);
        if (corruption === 'missing historical head') delete next.historyDatesIndex!.revision_heads![day];
        const before = new Map(files);
        jest.clearAllMocks();

        const writing = operation === 'writeBundle'
          ? cache.writeBundle(next, JSON.stringify(sampleCore))
          : cache.updateMeta({ manifest: next.manifest, coreSha: next.coreSha, historyDatesIndex: next.historyDatesIndex });
        await expect(writing).rejects.toThrow('Historical publication index is stale');

        expect(files).toEqual(before);
        expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
        expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
        expect(FileSystem.moveAsync).not.toHaveBeenCalled();
        expect((await cache.readMeta())?.historyDatesIndex).toEqual(installed.historyDatesIndex);
      },
    );
  });

  it.each(['core SHA', 'payload revision'])('cannot recover history receipts from a sidecar with a different %s', async mismatch => {
    const embedded = historyRecoveryMeta();
    await cache.writeBundle(embedded, JSON.stringify(sampleCore));
    const sidecar = historyRecoveryMeta(mismatch === 'payload revision' ? revisionManifest(2) : embedded.manifest, 4);
    if (mismatch === 'core SHA') sidecar.coreSha = 'f'.repeat(64);
    files.set(`${FileSystem.documentDirectory}payload/core-meta.json`, JSON.stringify(sidecar));

    const recovered = await cache.readBundle();
    expect(recovered?.meta).toEqual(embedded);
    expect(recovered?.meta.historyDatesIndex).not.toEqual(sidecar.historyDatesIndex);
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
