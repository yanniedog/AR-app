import type { GenerationManifestV3 } from '../src/contracts/v3/types';
import {
  createV3GenerationCache,
  type GenerationCacheStorage,
} from '../src/data/v3GenerationCache';
import {
  LEDGER_A,
  LEDGER_B,
  buildGeneration,
  makeProduct,
} from '../testUtils/v3TestData';

const LEDGER_C = 'c'.repeat(64);

class MemoryStorage implements GenerationCacheStorage {
  readonly files = new Map<string, string>();
  readonly removed: string[] = [];
  failWrites = false;
  failMoveTarget: string | null = null;
  failRemoveTarget: string | null = null;

  async read(path: string) { return this.files.get(path) ?? null; }
  async write(path: string, value: string) {
    if (this.failWrites) throw new Error('disk full');
    this.files.set(path, value);
  }
  async remove(path: string) {
    if (this.failRemoveTarget === path) throw new Error('cleanup failed');
    this.removed.push(path);
    this.files.delete(path);
  }
  async move(from: string, to: string) {
    if (this.failWrites) throw new Error('move failed');
    if (this.failMoveTarget === to) throw new Error('atomic replace failed');
    const value = this.files.get(from);
    if (value === undefined) throw new Error('source missing');
    this.files.set(to, value);
    this.files.delete(from);
  }
}

function secondGeneration() {
  return buildGeneration({
    date: '2026-08-15',
    priorLedgerDigest: LEDGER_A,
    ledgerEventDigest: LEDGER_B,
  });
}

function thirdGeneration() {
  return buildGeneration({
    date: '2026-08-16',
    priorLedgerDigest: LEDGER_B,
    ledgerEventDigest: LEDGER_C,
  });
}

function generationRecordPath(digest: string): string {
  return `payload/v3/generations/${digest}.json`;
}

describe('content-addressed v3 generation cache', () => {
  test('survives restart with a verified current and previous window', async () => {
    const storage = new MemoryStorage();
    const first = buildGeneration();
    const second = secondGeneration();
    await createV3GenerationCache(storage).install(first);
    await createV3GenerationCache(storage).install(second);

    const restarted = createV3GenerationCache(storage);
    expect((await restarted.readCurrent())?.manifest.generation_digest).toBe(second.manifest.generation_digest);
    expect((await restarted.readPrevious())?.manifest.generation_digest).toBe(first.manifest.generation_digest);
  });

  test('returns verified in-memory data on storage failure without replacing current', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    const first = buildGeneration();
    const second = secondGeneration();
    await cache.install(first);
    storage.failWrites = true;

    const result = await cache.install(second);

    expect(result.persisted).toBe(false);
    expect(result.generation.manifest.generation_digest).toBe(second.manifest.generation_digest);
    expect(result.persistenceError).toContain('disk full');
    expect((await cache.readCurrent())?.manifest.generation_digest).toBe(first.manifest.generation_digest);
  });

  test('falls back to the previous verified generation when current is corrupt', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    const first = buildGeneration();
    const second = secondGeneration();
    await cache.install(first);
    await cache.install(second);
    storage.files.set(generationRecordPath(second.manifest.generation_digest), '{bad-json');

    expect((await createV3GenerationCache(storage).readCurrent())?.manifest.generation_digest)
      .toBe(first.manifest.generation_digest);
  });

  test('serializes concurrent installs in call order', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    const first = buildGeneration();
    const second = secondGeneration();

    await Promise.all([cache.install(first), cache.install(second)]);

    expect((await cache.readCurrent())?.manifest.generation_digest).toBe(second.manifest.generation_digest);
    expect((await cache.readPrevious())?.manifest.generation_digest).toBe(first.manifest.generation_digest);
  });

  test.each([1, 2, 3, 4])('treats legacy envelope v%i as unavailable without deleting it and permits exact repair', async (version) => {
    const storage = new MemoryStorage();
    const generation = buildGeneration();
    const cache = createV3GenerationCache(storage);
    await cache.install(generation);
    const path = generationRecordPath(generation.manifest.generation_digest);
    const legacy = JSON.parse(storage.files.get(path)!) as Record<string, unknown>;
    legacy.schema_version = version;
    const legacyText = JSON.stringify(legacy);
    storage.files.set(path, legacyText);

    expect(await createV3GenerationCache(storage).readCurrent()).toBeNull();
    expect(storage.files.get(path)).toBe(legacyText);

    expect((await cache.install(generation)).persisted).toBe(true);
    expect((await createV3GenerationCache(storage).readCurrent())?.manifest.generation_digest)
      .toBe(generation.manifest.generation_digest);
  });

  test('re-verifies persisted gzip bytes against the authenticated descriptor on restart', async () => {
    const storage = new MemoryStorage();
    const generation = buildGeneration({ coreEncoding: 'gzip' });
    const cache = createV3GenerationCache(storage);
    await cache.install(generation);
    expect((await createV3GenerationCache(storage).readCurrent())?.core).toEqual(generation.core);

    const path = generationRecordPath(generation.manifest.generation_digest);
    const record = JSON.parse(storage.files.get(path)!) as { core_asset_bytes_hex: string };
    record.core_asset_bytes_hex = `${record.core_asset_bytes_hex[0] === '0' ? '1' : '0'}${record.core_asset_bytes_hex.slice(1)}`;
    storage.files.set(path, JSON.stringify(record));

    expect(await createV3GenerationCache(storage).readCurrent()).toBeNull();
  });

  test('rejects a locally rehashed expanded core because it must equal the authenticated asset bytes', async () => {
    const storage = new MemoryStorage();
    const generation = buildGeneration({ coreEncoding: 'gzip' });
    const cache = createV3GenerationCache(storage);
    await cache.install(generation);
    const path = generationRecordPath(generation.manifest.generation_digest);
    const record = JSON.parse(storage.files.get(path)!) as { core_text: string };
    record.core_text = record.core_text.replace('Example variable', 'Changed variable');
    storage.files.set(path, JSON.stringify(record));

    expect(await createV3GenerationCache(storage).readCurrent()).toBeNull();
  });

  test('binds persisted and candidate manifest objects to authenticated raw manifest bytes', async () => {
    const storage = new MemoryStorage();
    const generation = buildGeneration();
    const cache = createV3GenerationCache(storage);
    await cache.install(generation);
    const path = generationRecordPath(generation.manifest.generation_digest);
    const record = JSON.parse(storage.files.get(path)!) as { manifest: GenerationManifestV3 };
    record.manifest.normalization_version = 'locally-mutated-v3';
    storage.files.set(path, JSON.stringify(record));
    expect(await createV3GenerationCache(storage).readCurrent()).toBeNull();

    await expect(cache.install({
      ...generation,
      manifest: { ...generation.manifest, normalization_version: 'network-mismatch-v3' },
    })).rejects.toThrow(/does not match its authenticated manifest bytes/);
  });

  test('rejects rollback, equal-coordinate replacement, and disconnected lineage', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    const first = buildGeneration();
    const second = secondGeneration();
    await cache.install(first);
    await cache.install(second);

    await expect(cache.install(first)).rejects.toThrow(/rollback generation/);
    const sameCoordinate = buildGeneration({
      date: '2026-08-15',
      products: [makeProduct({ productId: 'different-product' })],
      priorLedgerDigest: LEDGER_A,
      ledgerEventDigest: LEDGER_C,
    });
    await expect(cache.install(sameCoordinate)).rejects.toThrow(/coordinate is immutable/);
    const disconnected = buildGeneration({
      date: '2026-08-16',
      priorLedgerDigest: LEDGER_A,
      ledgerEventDigest: LEDGER_C,
    });
    await expect(cache.install(disconnected)).rejects.toThrow(/not a direct ledger descendant/);
    expect((await cache.readCurrent())?.manifest.generation_digest).toBe(second.manifest.generation_digest);
  });

  test('removes only the generation displaced from the current/previous window', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    const first = buildGeneration();
    const second = secondGeneration();
    const third = thirdGeneration();
    await cache.install(first);
    await cache.install(second);
    await cache.install(third);

    expect(storage.files.has(generationRecordPath(first.manifest.generation_digest))).toBe(false);
    expect(storage.files.has(generationRecordPath(second.manifest.generation_digest))).toBe(true);
    expect(storage.files.has(generationRecordPath(third.manifest.generation_digest))).toBe(true);
  });

  test('reports cleanup failure without rolling back the committed new head', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    const first = buildGeneration();
    const second = secondGeneration();
    const third = thirdGeneration();
    await cache.install(first);
    await cache.install(second);
    storage.failRemoveTarget = generationRecordPath(first.manifest.generation_digest);

    const result = await cache.install(third);

    expect(result.persisted).toBe(true);
    expect(result.persistenceError).toContain('cache cleanup failed');
    expect((await cache.readCurrent())?.manifest.generation_digest).toBe(third.manifest.generation_digest);
  });

  test('preserves the old head when atomic head replacement fails', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    const first = buildGeneration();
    const second = secondGeneration();
    await cache.install(first);
    storage.failMoveTarget = 'payload/v3/head.json';

    const result = await cache.install(second);

    expect(result.persisted).toBe(false);
    expect(result.persistenceError).toContain('atomic replace failed');
    expect((await cache.readCurrent())?.manifest.generation_digest).toBe(first.manifest.generation_digest);
  });

  test('preserves an existing same-generation record when its atomic rewrite fails', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    const generation = buildGeneration();
    await cache.install(generation);
    const path = generationRecordPath(generation.manifest.generation_digest);
    const original = storage.files.get(path);
    storage.failMoveTarget = path;

    const result = await cache.install(generation);

    expect(result.persisted).toBe(false);
    expect(storage.files.get(path)).toBe(original);
    expect((await cache.readCurrent())?.manifest.generation_digest).toBe(generation.manifest.generation_digest);
  });

  test('rejects an invalid pre-existing non-current record as a content-address collision', async () => {
    const storage = new MemoryStorage();
    const generation = buildGeneration();
    storage.files.set(generationRecordPath(generation.manifest.generation_digest), '{not-valid');

    await expect(createV3GenerationCache(storage).install(generation)).rejects.toThrow(/content-addressed cache collision/);
  });

  test('rejects finalized partial observations from the settled generation cache', async () => {
    const cache = createV3GenerationCache(new MemoryStorage());
    const product = makeProduct();
    const partial = buildGeneration({
      products: [product],
      observationState: 'partial',
      coverage: {
        ...buildGeneration({ products: [product] }).manifest.coverage,
        providers_complete: 0,
        providers_partial: 1,
      },
    });
    await expect(cache.install(partial)).rejects.toThrow(/only complete observations/);
  });
});
