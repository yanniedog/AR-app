import { gzipSync, strToU8 } from 'fflate';

import {
  BANK_SPREAD_CACHE_MAX_PHYSICAL_RECORD_FILES,
  BANK_SPREAD_CACHE_SLOT_COUNT,
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
const CORE_E = 'e'.repeat(64);

class MemoryStorage implements BankSpreadContentStorage {
  readonly files = new Map<string, string>();
  blockWriteTarget: string | null = null;
  failWriteTarget: string | null = null;
  failRemoveTargetOnce: string | null = null;
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
    if (this.failRemoveTargetOnce === path) {
      this.failRemoveTargetOnce = null;
      throw new Error(`remove failed: ${path}`);
    }
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
    return [...this.files.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length).split('/')[0]);
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
        mortgage_mean: [0.04 + gap], savings_mean: [0.04], gap: [gap],
        mortgage_count: [1], savings_count: [1],
        mortgage_hash: [`mortgage-${label}`], savings_hash: [`savings-${label}`],
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

interface IndexEntry {
  core_sha256: string;
  bank_spread_history_sha256: string;
  slot: number;
}

interface RetentionIndexFixture {
  schema_version: number;
  transaction_sequence: number;
  entries: IndexEntry[];
}

function slotPath(slot: number) {
  return `${ROOT}/records/slot-${slot}.json`;
}

function indexEntries(storage: MemoryStorage): IndexEntry[] {
  const raw = storage.files.get(`${ROOT}/index.json`)!;
  return (JSON.parse(raw) as RetentionIndexFixture).entries;
}

function retentionIndex(storage: MemoryStorage, temporary = false): RetentionIndexFixture {
  const suffix = temporary ? '.tmp' : '';
  return JSON.parse(storage.files.get(`${ROOT}/index.json${suffix}`)!) as RetentionIndexFixture;
}

function indexedPath(storage: MemoryStorage, identity: BankSpreadCacheIdentity) {
  const entry = indexEntries(storage).find((candidate) =>
    candidate.core_sha256 === identity.coreSha &&
    candidate.bank_spread_history_sha256 === identity.spreadSha);
  if (!entry) throw new Error(`identity is not indexed: ${identity.coreSha}`);
  return slotPath(entry.slot);
}

function primarySlotPaths(storage: MemoryStorage) {
  return [...storage.files.keys()].filter((path) =>
    new RegExp(`^${ROOT}/records/slot-[0-${BANK_SPREAD_CACHE_SLOT_COUNT - 1}]\\.json$`).test(path));
}

describe('fixed-slot bank spread content cache', () => {
  const a = fixture(CORE_A, 'a', 0.02);
  const b = fixture(CORE_B, 'b', 0.015);
  const c = fixture(CORE_C, 'c', 0.01);
  const d = fixture(CORE_D, 'd', 0.005);
  const e = fixture(CORE_E, 'e', 0.001);

  it('binds every indexed cold read to the live compressed SHA and exact run date', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(a.identity, a.raw, () => true);
    await cache.install(b.identity, b.raw, () => true);

    await expect(cache.load(b.identity, () => true)).resolves.toEqual(b.value);
    await expect(cache.load({ ...b.identity, spreadSha: a.identity.spreadSha }, () => true))
      .resolves.toBeNull();
    await expect(cache.load({ ...b.identity, runDate: '2026-01-01' }, () => true))
      .resolves.toBeNull();
  });

  it('rejects mutable slot bytes that no longer hash to the indexed manifest SHA', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(a.identity, a.raw, () => true);
    const path = indexedPath(storage, a.identity);
    const record = JSON.parse(storage.files.get(path)!) as {
      raw_base64: string; compressed_bytes: number; encoded_bytes: number;
    };
    record.raw_base64 = Buffer.from(b.raw).toString('base64');
    record.compressed_bytes = b.raw.byteLength;
    record.encoded_bytes = record.raw_base64.length;
    storage.files.set(path, JSON.stringify(record));

    await expect(cache.load(a.identity, () => true)).rejects.toThrow(/index is corrupt/);
  });

  it('enforces compressed and inflated ceilings before accepting a slot', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT, {
      maxCompressedBytes: 512,
      maxInflatedBytes: 1024,
      maxEncodedBytes: 1024,
      maxTotalCompressedBytes: 1024,
      maxTotalEncodedBytes: 2048,
    });
    const oversizedRaw = new Uint8Array(513);
    await expect(cache.install({
      coreSha: CORE_A,
      spreadSha: sha256Bytes(oversizedRaw),
      runDate: sampleCore.run_date,
    }, oversizedRaw, () => true)).rejects.toThrow(/oversized raw bytes/);

    const bombRaw = gzipSync(strToU8(JSON.stringify({ ...a.value, padding: 'x'.repeat(2048) })));
    expect(bombRaw.byteLength).toBeLessThan(512);
    await expect(cache.install({
      coreSha: CORE_A,
      spreadSha: sha256Bytes(bombRaw),
      runDate: sampleCore.run_date,
    }, bombRaw, () => true)).rejects.toThrow(/oversized raw bytes/);
  });

  it('indexes current plus one verified predecessor while using only three fixed slots', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    for (const item of [a, b, c, d]) await cache.install(item.identity, item.raw, () => true);

    expect(indexEntries(storage).map((entry) => entry.core_sha256)).toEqual([CORE_D, CORE_C]);
    expect(primarySlotPaths(storage)).toHaveLength(BANK_SPREAD_CACHE_SLOT_COUNT);
  });

  it('enforces the indexed compressed-byte budget', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT, {
      maxTotalCompressedBytes: b.raw.byteLength + c.raw.byteLength - 1,
    });
    await cache.install(b.identity, b.raw, () => true);
    await cache.install(c.identity, c.raw, () => true);
    expect(indexEntries(storage).map((entry) => entry.core_sha256)).toEqual([CORE_C]);
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

  it('recovers authenticated temporary bytes in the unreferenced scratch slot', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    storage.failMoveTargetAfterDestinationDelete = slotPath(0);

    await expect(cache.install(a.identity, a.raw, () => true))
      .rejects.toThrow(/move failed after destination delete/);
    expect(storage.files.has(slotPath(0))).toBe(false);
    expect(storage.files.has(`${slotPath(0)}.tmp`)).toBe(true);
    storage.failMoveTargetAfterDestinationDelete = null;

    // The failed transaction did not publish an index. The next exact install
    // reuses the same bounded scratch slot and commits it.
    await expect(cache.install(a.identity, a.raw, () => true)).resolves.toBe(true);
    await expect(cache.load(a.identity, () => true)).resolves.toEqual(a.value);
    expect(storage.files.has(`${slotPath(0)}.tmp`)).toBe(false);
  });

  it('never overwrites either indexed generation when a scratch write becomes stale', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(b.identity, b.raw, () => true);
    await cache.install(c.identity, c.raw, () => true);
    const scratchTmp = `${slotPath(2)}.tmp`;
    storage.blockWriteTarget = scratchTmp;
    const blocked = storage.waitUntilWriteBlocked();
    let current = true;
    const pending = cache.install(a.identity, a.raw, () => current);
    await blocked;
    current = false;
    storage.releaseWrite();

    await expect(pending).resolves.toBe(false);
    expect(indexEntries(storage).map((entry) => entry.core_sha256)).toEqual([CORE_C, CORE_B]);
    await expect(cache.load(b.identity, () => true)).resolves.toEqual(b.value);
    await expect(cache.load(c.identity, () => true)).resolves.toEqual(c.value);
  });

  it('restores the exact prior index when generation changes during index replacement', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(b.identity, b.raw, () => true);
    await cache.install(c.identity, c.raw, () => true);
    let current = true;
    storage.afterRemove = (path) => {
      if (path === `${ROOT}/index.json`) current = false;
    };

    await expect(cache.install(a.identity, a.raw, () => current)).resolves.toBe(false);
    expect(indexEntries(storage).map((entry) => entry.core_sha256)).toEqual([CORE_C, CORE_B]);
    await expect(cache.load(b.identity, () => true)).resolves.toEqual(b.value);
    await expect(cache.load(c.identity, () => true)).resolves.toEqual(c.value);
  });

  it('recovers the newer rollback index when a crash leaves the stale commit primary', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(b.identity, b.raw, () => true);
    await cache.install(c.identity, c.raw, () => true);
    let current = true;
    storage.afterRemove = (path) => {
      if (path === `${ROOT}/index.json` && current) {
        current = false;
        storage.failRemoveTargetOnce = `${ROOT}/index.json`;
      }
    };

    await expect(cache.install(a.identity, a.raw, () => current))
      .rejects.toThrow(/remove failed/);
    expect(retentionIndex(storage).entries.map((entry) => entry.core_sha256))
      .toEqual([CORE_A, CORE_C]);
    expect(retentionIndex(storage, true).entries.map((entry) => entry.core_sha256))
      .toEqual([CORE_C, CORE_B]);
    expect(retentionIndex(storage, true).transaction_sequence)
      .toBeGreaterThan(retentionIndex(storage).transaction_sequence);

    storage.afterRemove = null;
    const restarted = createBankSpreadContentCache(storage, ROOT);
    await expect(restarted.load(b.identity, () => true)).resolves.toEqual(b.value);
    expect(indexEntries(storage).map((entry) => entry.core_sha256)).toEqual([CORE_B, CORE_C]);
    expect(storage.files.has(`${ROOT}/index.json.tmp`)).toBe(false);
  });

  it('repairs a corrupt indexed slot from exact verified network bytes', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(a.identity, a.raw, () => true);
    await cache.install(b.identity, b.raw, () => true);
    storage.files.set(indexedPath(storage, b.identity), '{"corrupt":true}');

    await expect(cache.load(b.identity, () => true)).rejects.toThrow(/index is corrupt/);
    await expect(cache.install(b.identity, b.raw, () => true)).resolves.toBe(true);
    await expect(cache.load(b.identity, () => true)).resolves.toEqual(b.value);
    await expect(cache.load(a.identity, () => true)).resolves.toEqual(a.value);
  });

  it('rebuilds an unparseable index from a new verified generation', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(a.identity, a.raw, () => true);
    await cache.install(b.identity, b.raw, () => true);
    storage.files.set(`${ROOT}/index.json`, '{not-json');

    await expect(cache.load(b.identity, () => true)).rejects.toThrow(/index is corrupt/);
    await expect(cache.install(c.identity, c.raw, () => true)).resolves.toBe(true);
    await expect(cache.load(c.identity, () => true)).resolves.toEqual(c.value);
    expect(indexEntries(storage).map((entry) => entry.core_sha256)).toEqual([CORE_C]);
  });

  it('clears repaired authority if the verified generation becomes stale after commit', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    storage.files.set(`${ROOT}/index.json`, '{not-json');
    let current = true;
    storage.afterRemove = (path) => {
      if (path === `${ROOT}/index.json` && current) current = false;
    };

    await expect(cache.install(c.identity, c.raw, () => current)).resolves.toBe(false);
    expect(indexEntries(storage)).toEqual([]);
    await expect(cache.load(c.identity, () => true)).resolves.toBeNull();
  });

  it('bounds repeated failed index commits by reusing the one scratch slot', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(b.identity, b.raw, () => true);
    await cache.install(c.identity, c.raw, () => true);
    storage.failWriteTarget = `${ROOT}/index.json.tmp`;

    await expect(cache.install(d.identity, d.raw, () => true)).rejects.toThrow(/write failed/);
    await expect(cache.install(e.identity, e.raw, () => true)).rejects.toThrow(/write failed/);

    expect(indexEntries(storage).map((entry) => entry.core_sha256)).toEqual([CORE_C, CORE_B]);
    expect(primarySlotPaths(storage)).toHaveLength(BANK_SPREAD_CACHE_SLOT_COUNT);
    expect([...storage.files.keys()].filter((path) => path.startsWith(`${ROOT}/records/`)))
      .toHaveLength(BANK_SPREAD_CACHE_SLOT_COUNT);
    expect(BANK_SPREAD_CACHE_MAX_PHYSICAL_RECORD_FILES).toBe(BANK_SPREAD_CACHE_SLOT_COUNT * 2);
    storage.failWriteTarget = null;
    await expect(cache.load(b.identity, () => true)).resolves.toEqual(b.value);
    await expect(cache.load(c.identity, () => true)).resolves.toEqual(c.value);
  });

  it('rejects an authenticated spread whose raw run_date has a valid-date prefix only', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    const malformed = { ...a.value, run_date: `${a.value.run_date}garbage` };
    const raw = gzipSync(strToU8(JSON.stringify(malformed)));
    await expect(cache.install(
      { ...a.identity, spreadSha: sha256Bytes(raw) },
      raw,
      () => true,
    )).rejects.toThrow(/unverified or oversized raw bytes/);
    expect(primarySlotPaths(storage)).toHaveLength(0);
  });

  it('removes a redundant temporary copy after an indexed primary slot verifies', async () => {
    const storage = new MemoryStorage();
    const cache = createBankSpreadContentCache(storage, ROOT);
    await cache.install(a.identity, a.raw, () => true);
    const path = indexedPath(storage, a.identity);
    storage.files.set(`${path}.tmp`, storage.files.get(path)!);

    await expect(cache.load(a.identity, () => true)).resolves.toEqual(a.value);
    expect(storage.files.has(path)).toBe(true);
    expect(storage.files.has(`${path}.tmp`)).toBe(false);
  });
});
