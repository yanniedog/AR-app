import { gzipSync, strToU8 } from 'fflate';

import {
  createBankSpreadContentCache,
  type BankSpreadCacheIdentity,
  type BankSpreadContentStorage,
} from '../src/data/bankSpreadContentCache';
import { sha256Bytes } from '../src/contracts/v3/contractPrimitives';
import type { BankSpreadHistoryPayload } from '../src/data/bankSpreadHistory';
import { sampleCore } from '../src/data/sample';

const ROOT = 'payload/bank-spread';
const CORE_A = 'a'.repeat(64);
const CORE_B = 'b'.repeat(64);
const CORE_C = 'c'.repeat(64);
const CORE_D = 'd'.repeat(64);

class MemoryStorage implements BankSpreadContentStorage {
  readonly files = new Map<string, string>();
  blockWriteTarget: string | null = null;
  failWriteTarget: string | null = null;
  failMoveTargetAfterDestinationDelete: string | null = null;
  afterRemove: ((path: string) => void) | null = null;
  private blocked: (() => void) | null = null;
  private releaseBlock: (() => void) | null = null;

  async read(path: string) { return this.files.get(path) ?? null; }
  async write(path: string, value: string) {
    if (this.failWriteTarget === path) throw new Error(`write failed: ${path}`);
    if (this.blockWriteTarget === path) {
      await new Promise<void>((resolve) => {
        this.releaseBlock = resolve;
        this.blocked?.();
      });
    }
    this.files.set(path, value);
  }
  async remove(path: string) {
    this.files.delete(path);
    this.afterRemove?.(path);
  }
  async move(from: string, to: string) {
    const value = this.files.get(from);
    if (value === undefined) throw new Error(`missing ${from}`);
    if (this.failMoveTargetAfterDestinationDelete === to) {
      this.files.delete(to);
      throw new Error(`move failed after destination delete: ${to}`);
    }
    this.files.set(to, value);
    this.files.delete(from);
  }
  async list(path: string) {
    const prefix = path.endsWith('/') ? path : `${path}/`;
    const children = new Set<string>();
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const child = key.slice(prefix.length).split('/')[0];
      if (child) children.add(child);
    }
    return [...children];
  }
  waitUntilWriteBlocked() {
    return new Promise<void>((resolve) => { this.blocked = resolve; });
  }
  releaseWrite() {
    this.releaseBlock?.();
    this.releaseBlock = null;
    this.blocked = null;
  }
}

function payload(label: string, gap: number): BankSpreadHistoryPayload {
  return {
    schema_version: 1,
    run_date: sampleCore.run_date,
    run_dates: [sampleCore.run_date],
    method: 'mean_rate_rows_per_product_then_mean_products_per_provider',
    cohorts: { mortgage: `mortgage-${label}`, savings: `savings-${label}` },
    banks: {
      'Example Bank': {
        mortgage_mean: [0.04 + gap],
        savings_mean: [0.04],
        gap: [gap],
        mortgage_count: [1],
        savings_count: [1],
        mortgage_hash: [`mortgage-${label}`],
        savings_hash: [`savings-${label}`],
        quality: ['complete'],
      },
    },
  };
}

function fixture(coreSha: string, label: string, gap: number) {
  const value = payload(label, gap);
  const raw = gzipSync(strToU8(JSON.stringify(value)));
  const identity: BankSpreadCacheIdentity = {
    coreSha,
    spreadSha: sha256Bytes(raw),
    runDate: value.run_date,
  };
  return { value, raw, identity };
}

function recordPath(identity: BankSpreadCacheIdentity) {
  return `${ROOT}/records/${identity.coreSha}-${identity.spreadSha}.json`;
}

function indexEntries(storage: MemoryStorage) {
  const raw = storage.files.get(`${ROOT}/index.json`)!;
  return (JSON.parse(raw) as { entries: { core_sha256: string; bank_spread_history_sha256: string }[] }).entries;
}

describe('content-addressed bank spread cache', () => {
  const a = fixture(CORE_A, 'a', 0.02);
  const b = fixture(CORE_B, 'b', 0.015);
  const c = fixture(CORE_C, 'c', 0.01);
  const d = fixture(CORE_D, 'd', 0.005);

  it('binds every cold read to the live compressed asset SHA and exact run date', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await expect(cache.install(a.identity, a.raw, () => true)).resolves.toBe(true);
    await expect(cache.install(b.identity, b.raw, () => true)).resolves.toBe(true);

    await expect(cache.load(b.identity, () => true)).resolves.toEqual(b.value);
    await expect(cache.load({ ...b.identity, spreadSha: a.identity.spreadSha }, () => true))
      .resolves.toBeNull();
    await expect(cache.load({ ...b.identity, runDate: '2026-01-01' }, () => true))
      .resolves.toBeNull();
  });

  it('rejects mutable base64 bytes that no longer hash to the manifest spread SHA', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(a.identity, a.raw, () => true);
    const path = recordPath(a.identity);
    const record = JSON.parse(storage.files.get(path)!) as { raw_base64: string; compressed_bytes: number; encoded_bytes: number };
    record.raw_base64 = Buffer.from(b.raw).toString('base64');
    record.compressed_bytes = b.raw.byteLength;
    record.encoded_bytes = record.raw_base64.length;
    storage.files.set(path, JSON.stringify(record));

    await expect(cache.load(a.identity, () => true)).resolves.toBeNull();
  });

  it('enforces compressed and inflated ceilings before accepting a record', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT, {
      maxCompressedBytes: 512,
      maxInflatedBytes: 1024,
      maxEncodedBytes: 1024,
      maxTotalCompressedBytes: 1024,
      maxTotalEncodedBytes: 2048,
    });
    const oversizedRaw = new Uint8Array(513);
    const oversizedIdentity = {
      coreSha: CORE_A,
      spreadSha: sha256Bytes(oversizedRaw),
      runDate: sampleCore.run_date,
    };
    await expect(cache.install(oversizedIdentity, oversizedRaw, () => true))
      .rejects.toThrow(/oversized raw bytes/);

    const bombText = JSON.stringify({ ...a.value, padding: 'x'.repeat(2048) });
    const bombRaw = gzipSync(strToU8(bombText));
    const bombIdentity = {
      coreSha: CORE_A,
      spreadSha: sha256Bytes(bombRaw),
      runDate: sampleCore.run_date,
    };
    expect(bombRaw.byteLength).toBeLessThan(512);
    await expect(cache.install(bombIdentity, bombRaw, () => true))
      .rejects.toThrow(/oversized raw bytes/);
  });

  it('retains current plus one verified predecessor under the explicit entry budget', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(a.identity, a.raw, () => true);
    await cache.install(b.identity, b.raw, () => true);
    await cache.install(c.identity, c.raw, () => true);

    expect(indexEntries(storage)).toEqual([
      expect.objectContaining({ core_sha256: CORE_C }),
      expect.objectContaining({ core_sha256: CORE_B }),
    ]);
    // A remains for one transaction as rollback grace.  The authoritative
    // index is still capped at current + one predecessor.
    expect(storage.files.has(recordPath(a.identity))).toBe(true);
    expect(storage.files.has(recordPath(b.identity))).toBe(true);
    expect(storage.files.has(recordPath(c.identity))).toBe(true);
  });

  it('enforces the total retained compressed-byte budget as well as the entry cap', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT, {
      maxTotalCompressedBytes: b.raw.byteLength + c.raw.byteLength - 1,
    });
    await cache.install(b.identity, b.raw, () => true);
    await cache.install(c.identity, c.raw, () => true);

    expect(indexEntries(storage)).toEqual([
      expect.objectContaining({ core_sha256: CORE_C }),
    ]);
    expect(storage.files.has(recordPath(b.identity))).toBe(true);
    expect(storage.files.has(recordPath(c.identity))).toBe(true);
  });

  it('bounds physical rollback grace to one record beyond the two-entry index', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(a.identity, a.raw, () => true);
    await cache.install(b.identity, b.raw, () => true);
    await cache.install(c.identity, c.raw, () => true);
    await cache.install(d.identity, d.raw, () => true);

    expect(indexEntries(storage).map((entry) => entry.core_sha256)).toEqual([CORE_D, CORE_C]);
    expect(storage.files.has(recordPath(a.identity))).toBe(false);
    expect(storage.files.has(recordPath(b.identity))).toBe(true);
    expect(storage.files.has(recordPath(c.identity))).toBe(true);
    expect(storage.files.has(recordPath(d.identity))).toBe(true);
  });

  it('recovers an authenticated temporary index after iOS destination deletion and move crash', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(b.identity, b.raw, () => true);
    storage.failMoveTargetAfterDestinationDelete = `${ROOT}/index.json`;

    await expect(cache.install(c.identity, c.raw, () => true))
      .rejects.toThrow(/move failed after destination delete/);
    expect(storage.files.has(`${ROOT}/index.json`)).toBe(false);
    expect(storage.files.has(`${ROOT}/index.json.tmp`)).toBe(true);
    storage.failMoveTargetAfterDestinationDelete = null;

    await expect(cache.load(c.identity, () => true)).resolves.toEqual(c.value);
    expect(indexEntries(storage).map((entry) => entry.core_sha256)).toEqual([CORE_C, CORE_B]);
    expect(storage.files.has(`${ROOT}/index.json.tmp`)).toBe(false);
  });

  it('recovers authenticated temporary raw bytes after record replacement move crashes', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    storage.failMoveTargetAfterDestinationDelete = recordPath(a.identity);

    await expect(cache.install(a.identity, a.raw, () => true))
      .rejects.toThrow(/move failed after destination delete/);
    expect(storage.files.has(recordPath(a.identity))).toBe(false);
    expect(storage.files.has(`${recordPath(a.identity)}.tmp`)).toBe(true);
    storage.failMoveTargetAfterDestinationDelete = null;

    await expect(cache.load(a.identity, () => true)).resolves.toEqual(a.value);
    expect(storage.files.has(recordPath(a.identity))).toBe(true);
    expect(storage.files.has(`${recordPath(a.identity)}.tmp`)).toBe(false);
  });

  it('removes stale A finishing after B/C prune without evicting or recreating B/C', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(b.identity, b.raw, () => true);
    await cache.install(c.identity, c.raw, () => true);
    const aTmp = `${recordPath(a.identity)}.tmp`;
    storage.blockWriteTarget = aTmp;
    const blocked = storage.waitUntilWriteBlocked();
    let aStillCurrent = true;
    const staleInstall = cache.install(a.identity, a.raw, () => aStillCurrent);
    await blocked;
    aStillCurrent = false;
    storage.releaseWrite();

    await expect(staleInstall).resolves.toBe(false);
    expect(storage.files.has(recordPath(a.identity))).toBe(false);
    expect(storage.files.has(aTmp)).toBe(false);
    expect(storage.files.has(recordPath(b.identity))).toBe(true);
    expect(storage.files.has(recordPath(c.identity))).toBe(true);
    expect(indexEntries(storage).map((entry) => entry.core_sha256)).toEqual([CORE_C, CORE_B]);
  });

  it('preserves the prior indexed generation when cleanup becomes stale after deleting debris', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(b.identity, b.raw, () => true);
    await cache.install(c.identity, c.raw, () => true);
    const orphanPath = `${ROOT}/records/${'e'.repeat(64)}-${'f'.repeat(64)}.json`;
    storage.files.set(orphanPath, 'unindexed debris');
    let aStillCurrent = true;
    storage.afterRemove = (path) => {
      if (path === orphanPath) aStillCurrent = false;
    };

    await expect(cache.install(a.identity, a.raw, () => aStillCurrent)).resolves.toBe(false);

    const entries = indexEntries(storage);
    expect(entries.map((entry) => entry.core_sha256)).toEqual([CORE_C, CORE_B]);
    for (const entry of entries) {
      expect(storage.files.has(recordPath({
        coreSha: entry.core_sha256,
        spreadSha: entry.bank_spread_history_sha256,
        runDate: sampleCore.run_date,
      }))).toBe(true);
    }
    expect(storage.files.has(recordPath(a.identity))).toBe(false);
    expect(storage.files.has(recordPath(b.identity))).toBe(true);
    expect(storage.files.has(recordPath(c.identity))).toBe(true);
    expect(storage.files.has(orphanPath)).toBe(false);
    await expect(cache.load(b.identity, () => true)).resolves.toEqual(b.value);
  });

  it('rejects an authenticated spread whose raw run_date has a valid-date prefix only', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    const malformed = { ...a.value, run_date: `${a.value.run_date}garbage` };
    const raw = gzipSync(strToU8(JSON.stringify(malformed)));
    const identity = { ...a.identity, spreadSha: sha256Bytes(raw) };

    await expect(cache.install(identity, raw, () => true)).rejects.toThrow(
      /unverified or oversized raw bytes/,
    );
    expect(storage.files.has(recordPath(identity))).toBe(false);
  });

  it('cleans a crash orphan on the next verified C load and never deletes indexed B/C', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(b.identity, b.raw, () => true);
    await cache.install(c.identity, c.raw, () => true);
    storage.failWriteTarget = `${ROOT}/index.json.tmp`;

    await expect(cache.install(a.identity, a.raw, () => true)).rejects.toThrow(/write failed/);
    expect(storage.files.has(recordPath(a.identity))).toBe(true);
    storage.failWriteTarget = null;

    await expect(cache.load(c.identity, () => true)).resolves.toEqual(c.value);
    expect(storage.files.has(recordPath(a.identity))).toBe(false);
    expect(storage.files.has(recordPath(b.identity))).toBe(true);
    expect(storage.files.has(recordPath(c.identity))).toBe(true);
  });

  it('cleans SHA-pattern unindexed records during a cold startup miss', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(b.identity, b.raw, () => true);
    storage.files.set(recordPath(a.identity), storage.files.get(recordPath(b.identity))!);

    await expect(cache.load(c.identity, () => true)).resolves.toBeNull();
    expect(storage.files.has(recordPath(a.identity))).toBe(false);
    expect(storage.files.has(recordPath(b.identity))).toBe(true);
  });

  it('removes a redundant temporary copy after the primary record verifies', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(a.identity, a.raw, () => true);
    const path = recordPath(a.identity);
    storage.files.set(`${path}.tmp`, storage.files.get(path)!);

    await expect(cache.load(a.identity, () => true)).resolves.toEqual(a.value);
    expect(storage.files.has(path)).toBe(true);
    expect(storage.files.has(`${path}.tmp`)).toBe(false);
  });
});
