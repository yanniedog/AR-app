import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { V3_CONTRACT_SCHEMA_SHA256 } from '../src/contracts/v3/contractLock';
import type {
  CapabilityV3,
  CorePayloadV3,
  GenerationHeadV3,
  GenerationManifestV3,
  GenerationPointerV3,
  ValidatedGenerationV3,
} from '../src/contracts/v3/types';
import {
  V3_ASSET_LIMITS,
  adaptCoreV3ToLegacy,
  validateCorePayloadV3,
  validateGenerationManifestV3,
  validateGenerationPointerV3,
} from '../src/contracts/v3/validators';
import {
  createV3GenerationCache,
  type GenerationCacheStorage,
} from '../src/data/v3GenerationCache';
import {
  V3_PAYLOAD_BRIDGE_ENABLED,
  loadCoreDualRead,
  loadValidatedV3Generation,
} from '../src/data/v3Payload';
import type { CorePayload } from '../src/types';

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
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

class MemoryStorage implements GenerationCacheStorage {
  readonly files = new Map<string, string>();
  failWrites = false;

  async read(path: string) { return this.files.get(path) ?? null; }
  async write(path: string, value: string) {
    if (this.failWrites) throw new Error('disk full');
    this.files.set(path, value);
  }
  async remove(path: string) { this.files.delete(path); }
  async move(from: string, to: string) {
    if (this.failWrites) throw new Error('move failed');
    const value = this.files.get(from);
    if (value == null) throw new Error('source missing');
    this.files.set(to, value);
    this.files.delete(from);
  }
}

describe('vendored v3 contract', () => {
  it('matches the byte-level schema lock', () => {
    for (const [name, expected] of Object.entries(V3_CONTRACT_SCHEMA_SHA256)) {
      const bytes = readFileSync(resolve(__dirname, `../src/contracts/v3/${name}`));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected);
    }
  });

  it('accepts a reconciled finalized generation and adapts typed units explicitly', () => {
    const sourceHead = head();
    const sourceManifest = validateGenerationManifestV3(manifest(), sourceHead);
    const sourceCore = validateCorePayloadV3(core(sourceManifest), sourceManifest);
    const legacy = adaptCoreV3ToLegacy(sourceCore);

    expect(validateGenerationPointerV3({
      schema_id: 'https://australianrates.app/schemas/manifest-v3.json',
      schema_version: 3,
      generated_at: '2026-08-15T01:05:00Z',
      latest_observation: sourceHead,
      latest_complete: sourceHead,
    })).toBeTruthy();
    expect(legacy.sections.Mortgage.rates[0].rate).toBe('0.061');
    expect(legacy.sections.Mortgage.rates[0].comparison_rate).toBe('0.062');
    expect(legacy.sections.Mortgage.rates[0].account_class).toBe('standard');
    expect(legacy.rba[0].rate).toBe(3.6);
  });

  it('rejects population mismatch, wrong units, section conflict, and oversize descriptors', () => {
    expect(() => validateGenerationManifestV3(manifest({
      coverage: { ...manifest().coverage, providers_complete: 0 },
    }), head())).toThrow(/do not reconcile/);

    const wrongUnit = core();
    (wrongUnit.sections.Mortgage.rates[0].typed_rate as { unit: string }).unit = 'percentage_points';
    expect(() => validateCorePayloadV3(wrongUnit, manifest())).toThrow(/unsupported unit/);

    const wrongSection = core();
    (wrongSection.sections.Mortgage.rates[0].classification as { consumer_section: string }).consumer_section = 'Savings';
    expect(() => validateCorePayloadV3(wrongSection, manifest())).toThrow(/conflicts with its section/);

    expect(() => validateGenerationManifestV3(manifest({
      assets: [descriptor('core', { compressed_bytes: V3_ASSET_LIMITS.core.compressed + 1 })],
    }), head())).toThrow(/exceeds core cap/);

    const badRibbon = core();
    badRibbon.sections.Mortgage.ribbon.range.mean = 0.5;
    expect(() => validateCorePayloadV3(badRibbon, manifest())).toThrow(/mean does not reconcile/);
  });

  it('rejects pointer/manifest identity mismatches and provisional installs', () => {
    expect(() => validateGenerationManifestV3(manifest(), head({ generation_digest: DIGEST_B }))).toThrow(/does not match pointer/);
    expect(() => validateGenerationManifestV3(manifest({ ledger_state: 'provisional' }), head())).toThrow(/only finalized/);
  });
});

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
    const cache = createV3GenerationCache(storage);
    const unavailable = {
      ...candidate(),
      optionalErrors: { facets: 'optional download failed' },
    };
    const recovered = {
      ...candidate(),
      optionalAssets: { facets: '{"schema_id":"facets-v3"}' },
    };

    expect((await cache.install(unavailable)).persisted).toBe(true);
    const result = await cache.install(recovered);

    expect(result.persisted).toBe(true);
    expect(result.generation.optionalAssets.facets).toBe('{"schema_id":"facets-v3"}');
    expect(result.generation.optionalErrors.facets).toBeUndefined();
    const restarted = await createV3GenerationCache(storage).readCurrent();
    expect(restarted?.optionalAssets.facets).toBe('{"schema_id":"facets-v3"}');
    expect(restarted?.optionalErrors.facets).toBeUndefined();
  });
});

describe('dormant dual read', () => {
  it('is feature-disabled and does not call the v3 loader by default', async () => {
    const storage = new MemoryStorage();
    const loadV3 = jest.fn(async () => candidate());
    const legacy = adaptCoreV3ToLegacy(core());
    const result = await loadCoreDualRead({
      bridgeEnabled: V3_PAYLOAD_BRIDGE_ENABLED,
      loadV3,
      loadV1: async () => legacy,
      v3Cache: createV3GenerationCache(storage),
    });
    expect(result.contract).toBe('v1');
    expect(loadV3).not.toHaveBeenCalled();
    expect(storage.files.size).toBe(0);
  });

  it('retains last-known-good v3 on a corrupt newer candidate without invoking v1', async () => {
    const storage = new MemoryStorage();
    const cache = createV3GenerationCache(storage);
    await cache.install(candidate());
    const loadV1 = jest.fn<Promise<CorePayload>, []>(async () => adaptCoreV3ToLegacy(core()));
    const result = await loadCoreDualRead({
      bridgeEnabled: true,
      loadV3: async () => { throw new Error('core hash mismatch'); },
      loadV1,
      v3Cache: cache,
    });
    expect(result.contract).toBe('v3');
    expect(result.source).toBe('cache');
    expect(result.warning).toContain('hash mismatch');
    expect(loadV1).not.toHaveBeenCalled();
  });

  it('falls back to v1 without replacing cache when no valid v3 exists', async () => {
    const storage = new MemoryStorage();
    const legacy = adaptCoreV3ToLegacy(core());
    const result = await loadCoreDualRead({
      bridgeEnabled: true,
      loadV3: async () => { throw new Error('manifest rejected'); },
      loadV1: async () => legacy,
      v3Cache: createV3GenerationCache(storage),
    });
    expect(result.contract).toBe('v1');
    expect(result.core).toBe(legacy);
    expect(storage.files.size).toBe(0);
  });

  it('quarantines corrupt and base-mismatched optional capabilities while installing core', async () => {
    const facets = descriptor('facets');
    const search = descriptor('search', { base_generation_digest: DIGEST_B });
    const shardA = descriptor('details-shard', {
      cohort: 'provider-a',
      url: 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-08-15/details-provider-a.json.gz',
      sha256: 'e'.repeat(64),
    });
    const shardB = descriptor('details-shard', {
      cohort: 'provider-b',
      url: 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-08-15/details-provider-b.json.gz',
      sha256: 'f'.repeat(64),
    });
    const sourceManifest = manifest({ assets: [descriptor('core'), facets, search, shardA, shardB] });
    const sourceCore = core(sourceManifest);
    const sourceHead = head();
    const pointer: GenerationPointerV3 = {
      schema_id: 'https://australianrates.app/schemas/manifest-v3.json',
      schema_version: 3,
      generated_at: '2026-08-15T01:05:00Z',
      latest_observation: sourceHead,
      latest_complete: sourceHead,
    };
    const byUrl = new Map<string, string>([
      ['https://bridge.test/manifest-v3.json', JSON.stringify(pointer)],
      [sourceHead.manifest_url, JSON.stringify(sourceManifest)],
      [descriptor('core').url, JSON.stringify(sourceCore)],
      [shardA.url, JSON.stringify({ schema_id: shardA.schema_id, products: {} })],
      [shardB.url, JSON.stringify({ schema_id: shardB.schema_id, products: {} })],
    ]);
    const downloaded: string[] = [];
    const result = await loadValidatedV3Generation('https://bridge.test/manifest-v3.json', {
      download: async (url) => {
        downloaded.push(url);
        if (url === facets.url) throw new Error('optional hash mismatch');
        const value = byUrl.get(url);
        if (value == null) throw new Error(`unexpected download ${url}`);
        return value;
      },
    });

    expect(result.core.run_date).toBe('2026-08-15');
    expect(result.optionalErrors.facets).toContain('hash mismatch');
    expect(result.optionalErrors.search).toContain('base generation');
    expect(Object.keys(result.optionalAssets)).toEqual([
      'details-shard:provider-a',
      'details-shard:provider-b',
    ]);
    expect(downloaded).not.toContain(search.url);
  });
});
