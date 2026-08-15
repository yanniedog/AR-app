import { createHash } from 'node:crypto';

import type {
  CapabilityV3,
  CorePayloadV3,
  GenerationHeadV3,
  GenerationManifestV3,
  ValidatedGenerationV3,
} from '../src/contracts/v3/types';
import {
  createV3GenerationCache,
  type GenerationCacheStorage,
} from '../src/data/v3GenerationCache';

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const DIGEST_C = 'c'.repeat(64);
const MANIFEST_SHA = 'c'.repeat(64);

function head(overrides: Partial<GenerationHeadV3> = {}): GenerationHeadV3 {
  return {
    generation_id: '2026-08-15T010000Z-a',
    generation_digest: DIGEST_A,
    run_date: '2026-08-15',
    observation_state: 'complete',
    manifest_url: 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-08-15/generation-manifest-v3.json',
    manifest_sha256: MANIFEST_SHA,
    manifest_bytes: 4096,
    ...overrides,
  };
}

function descriptor(
  capability: CapabilityV3,
  overrides: Partial<GenerationManifestV3['assets'][number]> = {},
): GenerationManifestV3['assets'][number] {
  return {
    capability,
    schema_id: capability === 'core'
      ? 'https://australianrates.app/schemas/core-v3.json'
      : `https://australianrates.app/schemas/${capability}-v3.json`,
    media_type: 'application/json',
    encoding: 'gzip',
    compressed_bytes: 1024,
    uncompressed_bytes: 4096,
    sha256: 'd'.repeat(64),
    url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-08-15/${capability}.json.gz`,
    required: capability === 'core',
    base_generation_digest: DIGEST_A,
    ...overrides,
  };
}

function manifest(overrides: Partial<GenerationManifestV3> = {}): GenerationManifestV3 {
  return {
    schema_id: 'https://australianrates.app/schemas/generation-manifest-v3.json',
    schema_version: 3,
    generation_id: '2026-08-15T010000Z-a',
    generation_digest: DIGEST_A,
    ledger_digest: overrides.generation_digest ?? DIGEST_A,
    run_date: '2026-08-15',
    ledger_state: 'finalized',
    observation_state: 'complete',
    normalization_version: 'canonical-v3.0.0',
    prior_ledger_digest: null,
    coverage: {
      reconciliation_status: 'reconciled',
      discovered_products: 1,
      priced_products: 1,
      consumer_eligible_products: 1,
      eligible_rate_tiers: 3,
      providers_registered: 1,
      providers_attempted: 1,
      providers_complete: 1,
      providers_partial: 0,
      providers_failed: 0,
      exclusions_by_reason: {},
    },
    assets: [descriptor('core')],
    ...overrides,
  };
}

function emptyRibbon() {
  return {
    counts: { rates: 0, products: 0, providers: 0 },
    range: { min: null, max: null, mean: null, median: null },
    providers: [],
  };
}

function core(
  sourceManifest: GenerationManifestV3 = manifest(),
  overrides: Partial<CorePayloadV3> = {},
): CorePayloadV3 {
  const mortgageRate: CorePayloadV3['sections']['Mortgage']['rates'][number] = {
    provider: 'Example Bank',
    provider_uid: 'holder/example-bank',
    product_uid: 'holder/example-bank/product/home-1',
    rate_uid: 'rate/home-1/variable-owner-occupier',
    legacy_product_key: 'Example Bank|home-1',
    product_name: 'Example Variable Home Loan',
    classification: {
      product_kind: 'mortgage',
      consumer_section: 'Mortgage',
      status: 'confirmed',
      basis: 'CDR product category and lending-rate facets',
      version: 'classifier-v3',
    },
    typed_rate: {
      value: 0.061,
      unit: 'fraction_per_annum',
      metric: 'advertised',
      evidence_status: 'published',
    },
    mortgage_rate_type: 'variable',
    comparison_rate: {
      value: 0.062,
      unit: 'fraction_per_annum',
      metric: 'comparison',
      evidence_status: 'published',
    },
    evidence: {
      availability: 'public',
      broadly_applicable: true,
      pricing_status: 'published',
      fee_disclosure_status: 'unknown',
      eligibility_disclosure_status: 'partial',
      source_url: 'https://api.example-bank.test/cds-au/v1/banking/products/home-1',
      observed_at: '2026-08-15T01:00:00Z',
      effective_date: null,
    },
  };
  return {
    schema_id: 'https://australianrates.app/schemas/core-v3.json',
    schema_version: 3,
    generation_id: sourceManifest.generation_id,
    generation_digest: sourceManifest.generation_digest,
    run_date: sourceManifest.run_date,
    sections: {
      Mortgage: {
        rates: [mortgageRate],
        ribbon: {
          counts: { rates: 1, products: 1, providers: 1 },
          range: { min: 0.061, max: 0.061, mean: 0.061, median: 0.061 },
          providers: [{
            provider: 'Example Bank',
            rates: 1,
            products: 1,
            min: 0.061,
            max: 0.061,
            mean: 0.061,
            median: 0.061,
          }],
        },
      },
      Savings: { rates: [], ribbon: emptyRibbon() },
      TD: { rates: [], ribbon: emptyRibbon() },
    },
    brands: { 'holder/example-bank': { short: 'Example', color: '#123456' } },
    rba: [{ date: '2026-08-01', rate: 3.6 }],
    ...overrides,
  };
}

function candidate(sourceManifest: GenerationManifestV3 = manifest()): ValidatedGenerationV3 {
  const sourceHead = head({
    generation_id: sourceManifest.generation_id,
    generation_digest: sourceManifest.generation_digest,
    run_date: sourceManifest.run_date,
    observation_state: sourceManifest.observation_state,
  });
  const sourceCore = core(sourceManifest);
  return {
    head: sourceHead,
    manifest: sourceManifest,
    core: sourceCore,
    coreText: JSON.stringify(sourceCore),
    optionalAssets: {},
    optionalErrors: {},
  };
}

const facetsValidator = (value: Readonly<Record<string, unknown>>) => {
  if (!Array.isArray(value.filters)) throw new Error('facets.filters must be an array');
};

function facetsText(filters: unknown[] = []): string {
  return JSON.stringify({
    schema_id: descriptor('facets').schema_id,
    schema_version: 3,
    generation_digest: DIGEST_A,
    filters,
  });
}

function candidateWithFacets(
  optionalAssets: ValidatedGenerationV3['optionalAssets'] = {},
  optionalErrors: ValidatedGenerationV3['optionalErrors'] = {},
): ValidatedGenerationV3 {
  const sourceManifest = manifest({ assets: [descriptor('core'), descriptor('facets')] });
  return { ...candidate(sourceManifest), optionalAssets, optionalErrors };
}

function cacheWithFacets(storage: GenerationCacheStorage) {
  return createV3GenerationCache(storage, 'payload/v3', { facets: facetsValidator });
}

class MemoryStorage implements GenerationCacheStorage {
  readonly files = new Map<string, string>();
  failWrites = false;
  failMoveTarget: string | null = null;

  async read(path: string) { return this.files.get(path) ?? null; }
  async write(path: string, value: string) {
    if (this.failWrites) throw new Error('disk full');
    this.files.set(path, value);
  }
  async remove(path: string) { this.files.delete(path); }
  async move(from: string, to: string) {
    if (this.failWrites) throw new Error('move failed');
    if (this.failMoveTarget === to) throw new Error('atomic replace failed');
    const value = this.files.get(from);
    if (value == null) throw new Error('source missing');
    this.files.set(to, value);
    this.files.delete(from);
  }
}

describe('content-addressed v3 cache', () => {
  it('survives restart with current and previous immutable generations', async () => {
    const storage = new MemoryStorage();
    const first = candidate();
    const secondManifest = manifest({
      generation_id: '2026-08-16T010000Z-b',
      generation_digest: DIGEST_B,
      run_date: '2026-08-16',
      prior_ledger_digest: DIGEST_A,
      assets: [descriptor('core', { base_generation_digest: DIGEST_B })],
    });
    await createV3GenerationCache(storage).install(first);
    await createV3GenerationCache(storage).install(candidate(secondManifest));

    const restarted = createV3GenerationCache(storage);
    expect((await restarted.readCurrent())?.manifest.generation_digest).toBe(DIGEST_B);
    expect((await restarted.readPrevious())?.manifest.generation_digest).toBe(DIGEST_A);
  });

  it('returns verified in-memory data on storage failure without replacing current', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    await cache.install(candidate());
    const secondManifest = manifest({
      generation_id: '2026-08-16T010000Z-b',
      generation_digest: DIGEST_B,
      run_date: '2026-08-16',
      prior_ledger_digest: DIGEST_A,
      assets: [descriptor('core', { base_generation_digest: DIGEST_B })],
    });
    storage.failWrites = true;
    const result = await cache.install(candidate(secondManifest));

    expect(result.persisted).toBe(false);
    expect(result.generation.core.run_date).toBe('2026-08-16');
    expect(result.persistenceError).toContain('disk full');
    expect((await cache.readCurrent())?.manifest.generation_digest).toBe(DIGEST_A);
  });

  it('falls back to previous when the current content-addressed record is corrupt', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    await cache.install(candidate());
    const secondManifest = manifest({
      generation_id: '2026-08-16T010000Z-b',
      generation_digest: DIGEST_B,
      run_date: '2026-08-16',
      prior_ledger_digest: DIGEST_A,
      assets: [descriptor('core', { base_generation_digest: DIGEST_B })],
    });
    await cache.install(candidate(secondManifest));
    storage.files.set(`payload/v3/generations/${DIGEST_B}.json`, '{bad-json');

    expect((await createV3GenerationCache(storage).readCurrent())?.manifest.generation_digest).toBe(DIGEST_A);
  });

  it('serializes concurrent installs in call order', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    const secondManifest = manifest({
      generation_id: '2026-08-16T010000Z-b',
      generation_digest: DIGEST_B,
      run_date: '2026-08-16',
      prior_ledger_digest: DIGEST_A,
      assets: [descriptor('core', { base_generation_digest: DIGEST_B })],
    });

    await Promise.all([cache.install(candidate()), cache.install(candidate(secondManifest))]);

    expect((await cache.readCurrent())?.manifest.generation_digest).toBe(DIGEST_B);
    expect((await cache.readPrevious())?.manifest.generation_digest).toBe(DIGEST_A);
  });

  it('fills a previously unavailable optional capability without changing the immutable generation', async () => {
    const storage = new MemoryStorage();
    const cache = cacheWithFacets(storage);
    const unavailable = candidateWithFacets({}, { facets: 'optional download failed' });
    const recovered = candidateWithFacets({ facets: facetsText() });

    expect((await cache.install(unavailable)).persisted).toBe(true);
    const result = await cache.install(recovered);

    expect(result.persisted).toBe(true);
    expect(result.generation.optionalAssets.facets).toBe(facetsText());
    expect(result.generation.optionalErrors.facets).toBeUndefined();
    const restarted = await cacheWithFacets(storage).readCurrent();
    expect(restarted?.optionalAssets.facets).toBe(facetsText());
    expect(restarted?.optionalErrors.facets).toBeUndefined();
  });

  it('fails closed on unhashed or altered persisted content and repairs an exact current retry', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    await cache.install(candidate());
    const recordPath = `payload/v3/generations/${DIGEST_A}.json`;
    const legacyRecord = JSON.parse(storage.files.get(recordPath)!) as Record<string, unknown>;
    legacyRecord.schema_version = 1;
    delete legacyRecord.content_hashes;
    const legacyBytes = JSON.stringify(legacyRecord);
    storage.files.set(recordPath, legacyBytes);

    expect(await createV3GenerationCache(storage).readCurrent()).toBeNull();
    expect(storage.files.get(recordPath)).toBe(legacyBytes);

    await cache.install(candidate());
    expect((await createV3GenerationCache(storage).readCurrent())?.manifest.generation_digest).toBe(DIGEST_A);

    const altered = JSON.parse(storage.files.get(recordPath)!) as {
      core_text: string;
    };
    const alteredCore = JSON.parse(altered.core_text) as CorePayloadV3;
    alteredCore.sections.Mortgage.rates[0].product_name = 'Altered after persistence';
    altered.core_text = JSON.stringify(alteredCore);
    storage.files.set(recordPath, JSON.stringify(altered));
    expect(await createV3GenerationCache(storage).readCurrent()).toBeNull();
  });

  it('checks persisted optional hashes and reruns capability validation on restart', async () => {
    const storage = new MemoryStorage();
    const cache = cacheWithFacets(storage);
    await cache.install(candidateWithFacets({ facets: facetsText() }));
    const recordPath = `payload/v3/generations/${DIGEST_A}.json`;
    const record = JSON.parse(storage.files.get(recordPath)!) as {
      optional_assets: Record<string, string>;
      content_hashes: { optional_assets: Record<string, string> };
    };

    record.optional_assets.facets = facetsText(['tampered']);
    storage.files.set(recordPath, JSON.stringify(record));
    expect(await cacheWithFacets(storage).readCurrent()).toBeNull();

    record.content_hashes.optional_assets.facets = createHash('sha256')
      .update(record.optional_assets.facets)
      .digest('hex');
    record.optional_assets.facets = JSON.stringify({
      schema_id: descriptor('facets').schema_id,
      schema_version: 3,
      generation_digest: DIGEST_A,
      filters: {},
    });
    record.content_hashes.optional_assets.facets = createHash('sha256')
      .update(record.optional_assets.facets)
      .digest('hex');
    storage.files.set(recordPath, JSON.stringify(record));
    expect(await cacheWithFacets(storage).readCurrent()).toBeNull();
  });

  it('rejects rollback and non-descendant generations without changing current', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    const secondManifest = manifest({
      generation_id: '2026-08-16T010000Z-b',
      generation_digest: DIGEST_B,
      run_date: '2026-08-16',
      prior_ledger_digest: DIGEST_A,
      assets: [descriptor('core', { base_generation_digest: DIGEST_B })],
    });
    await cache.install(candidate());
    await cache.install(candidate(secondManifest));

    await expect(cache.install(candidate())).rejects.toThrow(/rollback generation/);
    const unrelatedManifest = manifest({
      generation_id: '2026-08-17T010000Z-c',
      generation_digest: DIGEST_C,
      run_date: '2026-08-17',
      prior_ledger_digest: DIGEST_A,
      assets: [descriptor('core', { base_generation_digest: DIGEST_C })],
    });
    await expect(cache.install(candidate(unrelatedManifest))).rejects.toThrow(/not a direct descendant/);
    expect((await cache.readCurrent())?.manifest.generation_digest).toBe(DIGEST_B);
  });

  it('removes only the generation displaced from the current/previous window', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    const secondManifest = manifest({
      generation_id: '2026-08-16T010000Z-b',
      generation_digest: DIGEST_B,
      run_date: '2026-08-16',
      prior_ledger_digest: DIGEST_A,
      assets: [descriptor('core', { base_generation_digest: DIGEST_B })],
    });
    const thirdManifest = manifest({
      generation_id: '2026-08-17T010000Z-c',
      generation_digest: DIGEST_C,
      run_date: '2026-08-17',
      prior_ledger_digest: DIGEST_B,
      assets: [descriptor('core', { base_generation_digest: DIGEST_C })],
    });
    await cache.install(candidate());
    await cache.install(candidate(secondManifest));
    await cache.install(candidate(thirdManifest));

    expect(storage.files.has(`payload/v3/generations/${DIGEST_A}.json`)).toBe(false);
    expect(storage.files.has(`payload/v3/generations/${DIGEST_B}.json`)).toBe(true);
    expect(storage.files.has(`payload/v3/generations/${DIGEST_C}.json`)).toBe(true);
    expect((await cache.readCurrent())?.manifest.generation_digest).toBe(DIGEST_C);
    expect((await cache.readPrevious())?.manifest.generation_digest).toBe(DIGEST_B);
  });

  it('atomically preserves the current same-generation record when replacement fails', async () => {
    const storage = new MemoryStorage();
    const cache = cacheWithFacets(storage);
    await cache.install(candidateWithFacets({}, { facets: 'unavailable' }));
    const recordPath = `payload/v3/generations/${DIGEST_A}.json`;
    const original = storage.files.get(recordPath);
    storage.failMoveTarget = recordPath;

    const result = await cache.install({
      ...candidateWithFacets(),
      optionalAssets: { facets: facetsText() },
    });

    expect(result.persisted).toBe(false);
    expect(result.persistenceError).toContain('atomic replace failed');
    expect(storage.files.get(recordPath)).toBe(original);
    expect((await cache.readCurrent())?.optionalAssets.facets).toBeUndefined();
  });

  it('rejects finalized partial observations from the settled generation cache', async () => {
    const cache = createV3GenerationCache(new MemoryStorage());
    const partialManifest = manifest({ observation_state: 'partial' });
    await expect(cache.install(candidate(partialManifest))).rejects.toThrow(/only complete observations/);
  });
});
