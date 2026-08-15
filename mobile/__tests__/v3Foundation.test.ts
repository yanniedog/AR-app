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
  V3_OPTIONAL_EAGER_MAX_COUNT,
  V3_PAYLOAD_BRIDGE_ENABLED,
  loadCoreDualRead,
  loadValidatedV3Generation,
} from '../src/data/v3Payload';
import { liveAssetStateForProviderCoverage } from '../src/data/assetState';
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

function ribbonFor(rates: CorePayloadV3['sections']['Mortgage']['rates']) {
  const values = rates.map((row) => row.typed_rate.value).sort((left, right) => left - right);
  const providers = [...new Set(rates.map((row) => row.provider))];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const median = values.length % 2 === 1
    ? values[Math.floor(values.length / 2)]
    : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
  return {
    counts: {
      rates: rates.length,
      products: new Set(rates.map((row) => row.product_uid)).size,
      providers: providers.length,
    },
    range: { min: values[0], max: values[values.length - 1], mean, median },
    providers: providers.map((provider) => {
      const providerRates = rates.filter((row) => row.provider === provider);
      const providerValues = providerRates.map((row) => row.typed_rate.value).sort((left, right) => left - right);
      const providerMean = providerValues.reduce((sum, value) => sum + value, 0) / providerValues.length;
      const providerMedian = providerValues.length % 2 === 1
        ? providerValues[Math.floor(providerValues.length / 2)]
        : (providerValues[providerValues.length / 2 - 1] + providerValues[providerValues.length / 2]) / 2;
      return {
        provider,
        rates: providerRates.length,
        products: new Set(providerRates.map((row) => row.product_uid)).size,
        min: providerValues[0],
        max: providerValues[providerValues.length - 1],
        mean: providerMean,
        median: providerMedian,
      };
    }),
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

  it('preserves mortgage structure and stable rate-tier identity in the legacy adapter', () => {
    const fixedCore = core();
    fixedCore.sections.Mortgage.rates[0].mortgage_rate_type = 'fixed';
    fixedCore.sections.Mortgage.rates[0].fixed_term_months = 24;
    const sibling = {
      ...fixedCore.sections.Mortgage.rates[0],
      rate_uid: 'rate/home-1/fixed-owner-occupier-lvr-80',
      typed_rate: { ...fixedCore.sections.Mortgage.rates[0].typed_rate, value: 0.062 },
    };
    fixedCore.sections.Mortgage.rates.push(sibling);
    const first = adaptCoreV3ToLegacy(fixedCore).sections.Mortgage.rates;
    fixedCore.sections.Mortgage.rates.reverse();
    const reordered = adaptCoreV3ToLegacy(fixedCore).sections.Mortgage.rates;

    expect(first[0].rate_type).toBe('FIXED');
    expect(first[0].ribbon_fixed_term).toBe(2);
    expect(first[0].term_months).toBe(24);
    expect(first[0].rate_index).not.toBe(first[1].rate_index);
    for (const row of first) {
      expect(reordered.find((candidateRow) => candidateRow.rate === row.rate)?.rate_index).toBe(row.rate_index);
    }

    const missingStructure = core();
    delete missingStructure.sections.Mortgage.rates[0].mortgage_rate_type;
    expect(() => validateCorePayloadV3(missingStructure, manifest())).toThrow(/mortgage_rate_type/);
  });

  it('rejects duplicate details-shard cohorts even when URLs differ', () => {
    expect(() => validateGenerationManifestV3(manifest({
      assets: [
        descriptor('core'),
        descriptor('details-shard', { cohort: 'provider-a', sha256: 'e'.repeat(64) }),
        descriptor('details-shard', {
          cohort: 'provider-a',
          sha256: 'f'.repeat(64),
          url: 'https://github.com/yanniedog/AR-local/releases/download/example/other.json.gz',
        }),
      ],
    }), head())).toThrow(/duplicate asset descriptor/);

    expect(() => validateGenerationManifestV3(manifest({
      assets: [descriptor('core'), descriptor('facets', { cohort: 'not-a-shard' })],
    }), head())).toThrow(/cohort is valid only for details-shard/);
  });

  it('requires one consistent legacy product key across every product tier', () => {
    const inconsistent = core();
    const original = inconsistent.sections.Mortgage.rates[0];
    const sibling = {
      ...original,
      rate_uid: 'rate/home-1/variable-owner-occupier-lvr-80',
      typed_rate: { ...original.typed_rate, value: 0.062 },
    };
    delete sibling.legacy_product_key;
    inconsistent.sections.Mortgage.rates.push(sibling);
    inconsistent.sections.Mortgage.ribbon = {
      counts: { rates: 2, products: 1, providers: 1 },
      range: { min: 0.061, max: 0.062, mean: 0.0615, median: 0.0615 },
      providers: [{
        provider: 'Example Bank',
        rates: 2,
        products: 1,
        min: 0.061,
        max: 0.062,
        mean: 0.0615,
        median: 0.0615,
      }],
    };

    expect(() => validateCorePayloadV3(inconsistent, manifest())).toThrow(/inconsistent legacy_product_key/);
  });

  it('rejects effective product-key collisions and cross-section product reuse', () => {
    const effectiveCollision = core();
    const original = effectiveCollision.sections.Mortgage.rates[0];
    const colliding = {
      ...original,
      product_uid: original.legacy_product_key!,
      rate_uid: 'rate/home-2/variable-owner-occupier',
      product_name: 'Second Home Loan',
      typed_rate: { ...original.typed_rate, value: 0.062 },
    };
    delete colliding.legacy_product_key;
    effectiveCollision.sections.Mortgage.rates.push(colliding);
    effectiveCollision.sections.Mortgage.ribbon = ribbonFor(effectiveCollision.sections.Mortgage.rates);
    expect(() => validateCorePayloadV3(effectiveCollision, manifest())).toThrow(/adapted product_key.*ambiguous/);

    const crossSection = core();
    const reused = {
      ...crossSection.sections.Mortgage.rates[0],
      rate_uid: 'rate/home-1/reused-as-savings',
      classification: {
        ...crossSection.sections.Mortgage.rates[0].classification,
        product_kind: 'savings' as const,
        consumer_section: 'Savings' as const,
      },
      typed_rate: {
        ...crossSection.sections.Mortgage.rates[0].typed_rate,
        metric: 'base' as const,
        value: 0.05,
      },
    };
    delete reused.comparison_rate;
    delete reused.mortgage_rate_type;
    crossSection.sections.Savings.rates.push(reused);
    crossSection.sections.Savings.ribbon = ribbonFor(crossSection.sections.Savings.rates);
    expect(() => validateCorePayloadV3(crossSection, manifest())).toThrow(/reused across consumer sections/);

    const renamedTier = core();
    const renamedSibling = {
      ...renamedTier.sections.Mortgage.rates[0],
      rate_uid: 'rate/home-1/second-tier-renamed',
      product_name: 'Conflicting product name',
      typed_rate: { ...renamedTier.sections.Mortgage.rates[0].typed_rate, value: 0.062 },
    };
    renamedTier.sections.Mortgage.rates.push(renamedSibling);
    renamedTier.sections.Mortgage.ribbon = ribbonFor(renamedTier.sections.Mortgage.rates);
    expect(() => validateCorePayloadV3(renamedTier, manifest())).toThrow(/conflicting product-level facts/);

    const reclassifiedTier = core();
    const reclassifiedSibling = {
      ...reclassifiedTier.sections.Mortgage.rates[0],
      rate_uid: 'rate/home-1/second-tier-reclassified',
      classification: {
        ...reclassifiedTier.sections.Mortgage.rates[0].classification,
        basis: 'Conflicting classifier evidence',
      },
      typed_rate: { ...reclassifiedTier.sections.Mortgage.rates[0].typed_rate, value: 0.062 },
    };
    reclassifiedTier.sections.Mortgage.rates.push(reclassifiedSibling);
    reclassifiedTier.sections.Mortgage.ribbon = ribbonFor(reclassifiedTier.sections.Mortgage.rates);
    expect(() => validateCorePayloadV3(reclassifiedTier, manifest())).toThrow(/conflicting product-level facts/);
  });

  it('rejects unordered RBA steps and adapted brand-key collisions', () => {
    const unordered = core();
    unordered.rba = [
      { date: '2026-08-01', rate: 3.6 },
      { date: '2026-07-01', rate: 3.85 },
    ];
    expect(() => validateCorePayloadV3(unordered, manifest())).toThrow(/unique dates in ascending order/);

    const brandCollision = core();
    brandCollision.brands['Example Bank'] = { short: 'Wrong', color: '#abcdef' };
    expect(() => validateCorePayloadV3(brandCollision, manifest())).toThrow(/adapted brand key.*ambiguous/);
  });

  it('maps term-deposit conditionality into the legacy field used by consumers', () => {
    const termDeposit = core();
    const mortgage = termDeposit.sections.Mortgage.rates[0];
    const td = {
      ...mortgage,
      product_uid: 'holder/example-bank/product/td-1',
      rate_uid: 'rate/td-1/conditional-12m',
      legacy_product_key: 'Example Bank|td-1',
      product_name: 'Conditional 12 month term deposit',
      classification: {
        ...mortgage.classification,
        product_kind: 'term_deposit' as const,
        consumer_section: 'TD' as const,
      },
      typed_rate: { ...mortgage.typed_rate, metric: 'conditional' as const, value: 0.047 },
    };
    delete td.comparison_rate;
    delete td.mortgage_rate_type;
    termDeposit.sections.TD.rates.push(td);
    termDeposit.sections.TD.ribbon = ribbonFor(termDeposit.sections.TD.rates);

    const validated = validateCorePayloadV3(termDeposit, manifest());
    const legacyTd = adaptCoreV3ToLegacy(validated).sections.TD.rates[0];
    expect(legacyTd.ribbon_rate_structure).toBe('bonus');
    expect(legacyTd.ribbon_deposit_kind).toBeUndefined();
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

  it('treats a content-addressed collision as a v3 failure and retains cached bytes', async () => {
    const storage = new MemoryStorage();
    const cache = cacheWithFacets(storage);
    const knownGood = facetsText();
    const conflicting = facetsText(['conflicting']);
    await cache.install(candidateWithFacets({ facets: knownGood }));
    const result = await loadCoreDualRead({
      bridgeEnabled: true,
      loadV3: async () => candidateWithFacets({ facets: conflicting }),
      loadV1: async () => adaptCoreV3ToLegacy(core()),
      v3Cache: cache,
    });

    expect(result.contract).toBe('v3');
    expect(result.source).toBe('cache');
    expect(result.warning).toContain('optional asset collision');
    if (result.contract === 'v3') expect(result.generation.optionalAssets.facets).toBe(knownGood);
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

  it('does not promote a partial observation into the settled app core', async () => {
    const storage = new MemoryStorage();
    const partialManifest = manifest({ observation_state: 'partial' });
    const legacy = adaptCoreV3ToLegacy(core());
    const result = await loadCoreDualRead({
      bridgeEnabled: true,
      loadV3: async () => candidate(partialManifest),
      loadV1: async () => legacy,
      v3Cache: createV3GenerationCache(storage),
    });

    expect(result.contract).toBe('v1');
    expect(storage.files.size).toBe(0);
  });

  it('ignores a legacy cached partial generation during fallback', async () => {
    const storage = new MemoryStorage();
    const partialManifest = manifest({ observation_state: 'partial' });
    const partial = candidate(partialManifest);
    storage.files.set(`payload/v3/generations/${DIGEST_A}.json`, JSON.stringify({
      schema_version: 1,
      saved_at: '2026-08-15T02:00:00Z',
      head: partial.head,
      manifest: partial.manifest,
      core_text: partial.coreText,
      optional_assets: {},
      optional_errors: {},
    }));
    storage.files.set('payload/v3/head.json', JSON.stringify({
      schema_version: 1,
      current: DIGEST_A,
      previous: null,
    }));
    const result = await loadCoreDualRead({
      bridgeEnabled: true,
      loadV3: async () => { throw new Error('network unavailable'); },
      loadV1: async () => adaptCoreV3ToLegacy(core()),
      v3Cache: createV3GenerationCache(storage),
    });

    expect(result.contract).toBe('v1');
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
      [shardA.url, JSON.stringify({ schema_id: shardA.schema_id, schema_version: 3, generation_digest: DIGEST_A, products: {} })],
      [shardB.url, JSON.stringify({ schema_id: shardB.schema_id, schema_version: 3, generation_digest: DIGEST_A, products: {} })],
    ]);
    const downloaded: string[] = [];
    const result = await loadValidatedV3Generation('https://bridge.test/manifest-v3.json', {
      optionalValidators: {
        'details-shard': (value) => {
          if (!value.products || typeof value.products !== 'object') throw new Error('details shard products are invalid');
        },
        facets: () => undefined,
        search: () => undefined,
      },
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

  it('requires the locked envelope and capability validator for every optional asset', async () => {
    const facets = descriptor('facets');
    const sourceManifest = manifest({ assets: [descriptor('core'), facets] });
    const sourceHead = head();
    const pointer: GenerationPointerV3 = {
      schema_id: 'https://australianrates.app/schemas/manifest-v3.json',
      schema_version: 3,
      generated_at: '2026-08-15T01:05:00Z',
      latest_observation: sourceHead,
      latest_complete: sourceHead,
    };
    const baseResponses = new Map<string, string>([
      ['https://bridge.test/manifest-v3.json', JSON.stringify(pointer)],
      [sourceHead.manifest_url, JSON.stringify(sourceManifest)],
      [descriptor('core').url, JSON.stringify(core(sourceManifest))],
    ]);
    const run = (optionalText: string, withValidator = true) => loadValidatedV3Generation(
      'https://bridge.test/manifest-v3.json',
      {
        ...(withValidator ? {
          optionalValidators: {
            facets: (value: Readonly<Record<string, unknown>>) => {
              if (!Array.isArray(value.filters)) throw new Error('facets.filters must be an array');
            },
          },
        } : {}),
        download: async (url) => {
          if (url === facets.url) return optionalText;
          const value = baseResponses.get(url);
          if (value == null) throw new Error(`unexpected download ${url}`);
          return value;
        },
      },
    );

    const missingEnvelope = await run(JSON.stringify({ filters: [] }));
    expect(missingEnvelope.optionalErrors.facets).toContain('schema_id');
    const invalidShape = await run(JSON.stringify({
      schema_id: facets.schema_id,
      schema_version: 3,
      generation_digest: DIGEST_A,
      filters: {},
    }));
    expect(invalidShape.optionalErrors.facets).toContain('facets.filters');
    const unregistered = await run(JSON.stringify({
      schema_id: facets.schema_id,
      schema_version: 3,
      generation_digest: DIGEST_A,
      filters: [],
    }), false);
    expect(unregistered.optionalErrors.facets).toContain('no registered capability validator');

    const requiredManifest = manifest({ assets: [descriptor('core'), descriptor('facets', { required: true })] });
    baseResponses.set(sourceHead.manifest_url, JSON.stringify(requiredManifest));
    await expect(run(JSON.stringify({
      schema_id: facets.schema_id,
      schema_version: 3,
      generation_digest: DIGEST_A,
      filters: [],
    }), false)).rejects.toThrow(/no registered capability validator/);
    await expect(run(JSON.stringify({ filters: [] }))).rejects.toThrow(/facets validation failed.*schema_id/);
  });

  it('bounds the aggregate number of eagerly retained optional assets', async () => {
    const shards = Array.from({ length: V3_OPTIONAL_EAGER_MAX_COUNT + 1 }, (_, index) => descriptor('details-shard', {
      cohort: `provider-${index}`,
      sha256: index.toString(16).padStart(64, '0'),
      url: `https://github.com/yanniedog/AR-local/releases/download/example/details-${index}.json.gz`,
    }));
    const sourceManifest = manifest({ assets: [descriptor('core'), ...shards] });
    const sourceHead = head();
    const pointer: GenerationPointerV3 = {
      schema_id: 'https://australianrates.app/schemas/manifest-v3.json',
      schema_version: 3,
      generated_at: '2026-08-15T01:05:00Z',
      latest_observation: sourceHead,
      latest_complete: sourceHead,
    };
    const optionalDownloads: string[] = [];
    const result = await loadValidatedV3Generation('https://bridge.test/manifest-v3.json', {
      optionalValidators: { 'details-shard': () => undefined },
      download: async (url) => {
        if (url === 'https://bridge.test/manifest-v3.json') return JSON.stringify(pointer);
        if (url === sourceHead.manifest_url) return JSON.stringify(sourceManifest);
        if (url === descriptor('core').url) return JSON.stringify(core(sourceManifest));
        const shard = shards.find((candidateShard) => candidateShard.url === url);
        if (!shard) throw new Error(`unexpected download ${url}`);
        optionalDownloads.push(url);
        return JSON.stringify({
          schema_id: shard.schema_id,
          schema_version: 3,
          generation_digest: DIGEST_A,
          products: {},
        });
      },
    });

    expect(Object.keys(result.optionalAssets)).toHaveLength(V3_OPTIONAL_EAGER_MAX_COUNT);
    expect(optionalDownloads).toHaveLength(V3_OPTIONAL_EAGER_MAX_COUNT);
    expect(result.optionalErrors[`details-shard:provider-${V3_OPTIONAL_EAGER_MAX_COUNT}`]).toContain('aggregate budget');
  });

  it('charges failed optional downloads to the aggregate byte budget before each request', async () => {
    const shards = Array.from({ length: 9 }, (_, index) => descriptor('details-shard', {
      cohort: `provider-${index}`,
      sha256: index.toString(16).padStart(64, '0'),
      uncompressed_bytes: 32 * 1024 * 1024,
      url: `https://github.com/yanniedog/AR-local/releases/download/example/large-details-${index}.json.gz`,
    }));
    const sourceManifest = manifest({ assets: [descriptor('core'), ...shards] });
    const sourceHead = head();
    const pointer: GenerationPointerV3 = {
      schema_id: 'https://australianrates.app/schemas/manifest-v3.json',
      schema_version: 3,
      generated_at: '2026-08-15T01:05:00Z',
      latest_observation: sourceHead,
      latest_complete: sourceHead,
    };
    const attempted: string[] = [];
    const load = (assets: GenerationManifestV3['assets']) => loadValidatedV3Generation(
      'https://bridge.test/manifest-v3.json',
      {
        optionalValidators: { 'details-shard': () => undefined },
        download: async (url) => {
          if (url === 'https://bridge.test/manifest-v3.json') return JSON.stringify(pointer);
          if (url === sourceHead.manifest_url) return JSON.stringify({ ...sourceManifest, assets });
          if (url === descriptor('core').url) return JSON.stringify(core({ ...sourceManifest, assets }));
          attempted.push(url);
          throw new Error('invalid shard');
        },
      },
    );

    const result = await load([descriptor('core'), ...shards]);
    expect(attempted).toHaveLength(2);
    expect(result.optionalErrors['details-shard:provider-2']).toContain('aggregate budget');

    attempted.length = 0;
    const requiredThird = { ...shards[2], required: true };
    await expect(load([descriptor('core'), shards[0], shards[1], requiredThird])).rejects.toThrow(/aggregate budget/);
    expect(attempted).toHaveLength(2);
  });
});

describe('provider coverage asset truth state', () => {
  it('marks failed-only and mixed provider outcomes as partial', () => {
    const integrity = { marker: 'verified' };
    expect(liveAssetStateForProviderCoverage(integrity, {
      counts: { providers_partial: 0, providers_failed: 2 },
    })).toEqual({
      status: 'partial',
      data: integrity,
      reason: '2 provider observation(s) failed.',
    });
    expect(liveAssetStateForProviderCoverage(integrity, {
      counts: { providers_partial: 1, providers_failed: 2 },
    })).toEqual({
      status: 'partial',
      data: integrity,
      reason: '1 provider observation(s) are partial; 2 provider observation(s) failed.',
    });
    expect(liveAssetStateForProviderCoverage(integrity, {
      counts: { providers_partial: 0, providers_failed: 0 },
    })).toEqual({ status: 'live', data: integrity });
  });
});
