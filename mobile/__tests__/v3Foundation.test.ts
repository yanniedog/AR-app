import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  V3_CONTRACT_SCHEMA_FILES,
  V3_CONTRACT_SCHEMA_SET_SHA256,
  V3_CONTRACT_SCHEMA_SHA256,
} from '../src/contracts/v3/contractLock';
import type { AssetDescriptorV3, CanonicalFeeV3, CorePayloadV3, CoverageV2, GenerationManifestV3 } from '../src/contracts/v3/types';
import { compareRfc3339Instants, utf8Bytes } from '../src/contracts/v3/contractPrimitives';
import {
  V3_ASSET_LIMITS,
  V3_MANIFEST_LIMIT_BYTES,
  V3_POINTER_LIMIT_BYTES,
  adaptCoreV3ToLegacy,
  type LegacyProductAliasMap,
  canonicalFeeUid,
  canonicalJsonForContract,
  canonicalRateUid,
  canonicalSchemaSetSha256,
  sha256Utf8,
  validateCorePayloadTextV3,
  validateCorePayloadV3,
  validateCoverageV2,
  validateAssetDescriptorV3,
  validateGenerationHeadV3,
  validateGenerationManifestTextV3,
  validateGenerationPointerTextV3,
  validateGenerationPointerV3,
} from '../src/contracts/v3/validators';
import { assetStateForV3Coverage } from '../src/data/assetState';
import { sampleCore } from '../src/data/sample';
import { createV3GenerationCache, type GenerationCacheStorage } from '../src/data/v3GenerationCache';
import {
  V3_PAYLOAD_BRIDGE_ENABLED,
  loadCoreDualRead,
  loadValidatedV3Generation,
  type V3TextDownloader,
} from '../src/data/v3Payload';
import { makeSavedRateRef } from '../src/data/savedRates';
import {
  LEDGER_A,
  PROVIDER_UID,
  SECOND_PROVIDER_UID,
  buildGeneration,
  clone,
  coverageFor,
  makeProduct,
  pointerFor,
} from '../testUtils/v3TestData';

function schemaPath(name: string): string {
  return resolve(__dirname, `../src/contracts/v3/${name}`);
}

function memoryStorage(): GenerationCacheStorage {
  const values = new Map<string, string>();
  return {
    read: async (path) => values.get(path) ?? null,
    write: async (path, value) => { values.set(path, value); },
    remove: async (path) => { values.delete(path); },
    move: async (from, to) => {
      const value = values.get(from);
      if (value === undefined) throw new Error(`missing ${from}`);
      values.set(to, value);
      values.delete(from);
    },
  };
}

function adapt(core: CorePayloadV3) {
  return adaptCoreV3ToLegacy(core, { ...sampleCore, run_date: core.observation_date });
}

describe('authoritative AR-local v3 contract parity', () => {
  test('vendors the exact five schema bytes and proves the producer schema-set lock', () => {
    const lock = JSON.parse(readFileSync(schemaPath('contract-lock.json'), 'utf8')) as {
      schema_version: number;
      algorithm: string;
      schema_set_sha256: string;
      schemas: string[];
    };
    const schemas: Record<string, unknown> = {};
    for (const name of V3_CONTRACT_SCHEMA_FILES) {
      const bytes = readFileSync(schemaPath(name));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(V3_CONTRACT_SCHEMA_SHA256[name]);
      schemas[name] = JSON.parse(bytes.toString('utf8')) as unknown;
    }
    expect(lock).toEqual({
      schema_version: 1,
      algorithm: 'sha256-canonical-json-schema-set-v1',
      schema_set_sha256: V3_CONTRACT_SCHEMA_SET_SHA256,
      schemas: [...V3_CONTRACT_SCHEMA_FILES],
    });
    expect(canonicalSchemaSetSha256(schemas)).toBe(V3_CONTRACT_SCHEMA_SET_SHA256);
  });

  test('validates the exact producer pointer, manifest, and core goldens', () => {
    const pointerText = readFileSync(schemaPath('fixtures/valid-generation-pointer-v3.json'), 'utf8');
    const manifestFixtureText = readFileSync(schemaPath('fixtures/valid-generation-manifest-v3.json'), 'utf8');
    const coreText = readFileSync(schemaPath('fixtures/valid-canonical-core-v3.json'), 'utf8');
    const pointer = validateGenerationPointerTextV3(pointerText);
    // The producer golden test authenticates its canonical serializer output,
    // while retaining the readable pretty-printed manifest as the fixture.
    const manifestText = canonicalJsonForContract(JSON.parse(manifestFixtureText));
    const manifest = validateGenerationManifestTextV3(manifestText, pointer.latest_complete);
    const core = validateCorePayloadTextV3(coreText, manifest);
    expect(core.products).toEqual([]);
    expect(manifest.capabilities.core.uncompressed_bytes).toBe(115);
    expect(sha256Utf8(coreText)).toBe(manifest.capabilities.core.sha256);
  });
});

describe('producer pointer, manifest, and coverage semantics', () => {
  test('rejects contract drift, partial complete-heads, and equal-coordinate replacement', () => {
    const generation = buildGeneration();
    const pointer = pointerFor(generation.head);
    expect(validateGenerationPointerV3(pointer)).toEqual(pointer);
    expect(() => validateGenerationPointerV3({ ...pointer, contract_sha256: '0'.repeat(64) }))
      .toThrow(/contract_sha256/);
    expect(() => validateGenerationPointerV3({
      ...pointer,
      latest_complete: { ...generation.head, observation_state: 'partial' },
    })).toThrow(/latest_complete/);
    expect(() => validateGenerationPointerV3({
      ...pointer,
      latest_observation: {
        ...generation.head,
        manifest_sha256: 'f'.repeat(64),
        manifest_url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-gen/${'f'.repeat(64)}.json`,
      },
    })).toThrow(/latest_complete must equal|equal-coordinate/);
  });

  test('requires a complete latest observation to be the exact latest-complete head', () => {
    const older = buildGeneration();
    const newer = buildGeneration({ date: '2026-08-15', ledgerEventDigest: 'b'.repeat(64) });
    expect(() => validateGenerationPointerV3(pointerFor(newer.head, older.head)))
      .toThrow(/latest_complete must equal/);
  });

  test('accepts only the exact rolling or candidate manifest URL forms', () => {
    const rolling = buildGeneration();
    const candidate = buildGeneration({ manifestTag: 'candidate' });
    expect(validateGenerationHeadV3(rolling.head)).toEqual(rolling.head);
    expect(validateGenerationHeadV3(candidate.head)).toEqual(candidate.head);
    for (const forged of [
      `${rolling.head.manifest_url}?cache=1`,
      `${rolling.head.manifest_url}#fragment`,
      rolling.head.manifest_url.replace('.json', '.json.bak'),
      rolling.head.manifest_url.replace('app-payload-gen', 'app-payload-other'),
      candidate.head.manifest_url.replace(candidate.head.generation_id, 'gen-2026-08-14-r0001-000000000000'),
    ]) {
      expect(() => validateGenerationHeadV3({ ...rolling.head, manifest_url: forged })).toThrow(/canonical AR-local/);
    }
  });

  test('accepts only exact shared content-addressed core URL forms', () => {
    const generation = buildGeneration();
    const descriptor = generation.manifest.capabilities.core;
    const candidateDescriptor: AssetDescriptorV3 = {
      ...descriptor,
      url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-v3-candidate-${generation.head.generation_id}/${descriptor.sha256}.json`,
    };
    expect(() => validateAssetDescriptorV3(candidateDescriptor, generation.head.generation_id))
      .toThrow(/canonical AR-local/);
    expect(validateAssetDescriptorV3(descriptor, generation.head.generation_id)).toEqual(descriptor);

    const gzipSha = 'f'.repeat(64);
    const gzipDescriptor: AssetDescriptorV3 = {
      ...descriptor,
      encoding: 'gzip',
      compressed_bytes: 64,
      sha256: gzipSha,
      url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-gen/${gzipSha}.json.gz`,
    };
    expect(validateAssetDescriptorV3(gzipDescriptor, generation.head.generation_id)).toEqual(gzipDescriptor);
    for (const forged of [
      `${gzipDescriptor.url}?cache=1`,
      `${gzipDescriptor.url}#fragment`,
      gzipDescriptor.url.replace('.json.gz', '.json.gz.bak'),
      gzipDescriptor.url.replace('app-payload-gen', 'app-payload-other'),
    ]) {
      expect(() => validateAssetDescriptorV3({ ...gzipDescriptor, url: forged }, generation.head.generation_id))
        .toThrow(/canonical AR-local/);
    }
  });

  test('enforces every CoverageV2 population and provenance equation', () => {
    const valid = coverageFor([makeProduct()]);
    expect(validateCoverageV2(valid)).toEqual(valid);
    const cases: [Partial<CoverageV2>, RegExp][] = [
      [{ providers_responded: 0 }, /provider populations/],
      [{ providers_attempted: 0 }, /provider populations/],
      [{ providers_registered: 0 }, /provider populations/],
      [{ products_priced: 2 }, /consumer-eligible <= priced <= discovered/],
      [{ exclusions_by_reason: { restricted: 1 } }, /eligible products plus exclusions/],
      [{ providers_responded: 0, providers_complete: 0, providers_failed: 1, failure_records: 0 }, /attributable evidence/],
      [{ register_sources_complete: 0 }, /complete register provenance/],
      [{ failure_provenance_complete: false }, /un.*failure provenance/],
      [{ corrupt_failure_records: 1 }, /un.*failure provenance/],
    ];
    for (const [mutation, message] of cases) {
      expect(() => validateCoverageV2({ ...valid, ...mutation })).toThrow(message);
    }
    const failed = {
      ...valid,
      providers_responded: 0,
      providers_complete: 0,
      providers_failed: 1,
      failure_records: 2,
      failure_records_by_provider: { [PROVIDER_UID]: 2 },
    };
    expect(validateCoverageV2(failed).failure_records).toBe(2);
  });

  test('binds observation, revision, ledger, producer, and canonical manifest digest', () => {
    const generation = buildGeneration();
    expect(generation.manifest.producer_commit).toHaveLength(40);
    expect(generation.manifest.ledger_event_digest).toBe(LEDGER_A);
    const changed = JSON.parse(generation.manifestText) as GenerationManifestV3;
    changed.ledger_event_digest = 'f'.repeat(64);
    const changedText = JSON.stringify(changed);
    const changedHead = { ...generation.head, manifest_sha256: sha256Utf8(changedText) };
    expect(() => validateGenerationManifestTextV3(changedText, changedHead)).toThrow(/canonical content/);
  });

  test('keeps a reconciled partial observation but blocks it from latest-complete promotion', () => {
    const product = makeProduct();
    const coverage = coverageFor([product], {
      providers_complete: 0,
      providers_partial: 1,
    });
    const partial = buildGeneration({ products: [product], observationState: 'partial', coverage });
    expect(partial.manifest.observation_state).toBe('partial');
    expect(assetStateForV3Coverage({}, coverage, 'partial', 'live').status).toBe('partial');
    expect(() => validateGenerationPointerV3(pointerFor(partial.head, partial.head))).toThrow(/latest_complete/);
  });
});

describe('canonical core validation and legacy adaptation', () => {
  test('enforces producer public-eligibility and RFC3339 invariants', () => {
    expect(() => buildGeneration({
      products: [makeProduct({ eligibility: 'partial' })],
    })).toThrow(/public availability requires complete eligibility evidence/);
    expect(() => buildGeneration({
      products: [makeProduct({ observedAt: '2026-08-14T09:30:00.1234567890+10:00' })],
    })).toThrow(/RFC3339/);
    expect(buildGeneration({
      products: [makeProduct({ observedAt: '2026-08-14T09:29:00.123456789+10:00' })],
    }).core.products[0].evidence.observed_at).toBe('2026-08-14T09:29:00.123456789+10:00');
    expect(compareRfc3339Instants(
      '2026-08-14T09:30:00.1+10:00',
      '2026-08-13T23:30:00.100000000Z',
    )).toBe(0);

    const futureEffective = makeProduct({ observedAt: '2026-08-14T09:29:00.000000001+10:00' });
    futureEffective.evidence.effective_date = '2026-08-14T09:29:00.000000002+10:00';
    futureEffective.evidence_refs[0].effective_date = futureEffective.evidence.effective_date;
    expect(() => buildGeneration({ products: [futureEffective] })).toThrow(/cannot precede effective_date/);

    const active = makeProduct({ observedAt: '2026-08-14T09:29:00.000000001+10:00' });
    active.evidence.effective_to = '2026-08-14T09:29:00.000000002+10:00';
    active.evidence_refs[0].effective_to = active.evidence.effective_to;
    expect(buildGeneration({ products: [active] }).core.products[0].evidence.effective_to)
      .toBe('2026-08-14T09:29:00.000000002+10:00');

    expect(() => buildGeneration({
      products: [makeProduct({ observedAt: '2026-08-14T09:30:00.000000001+10:00' })],
    })).toThrow(/cannot post-date the generation observation/);

    const futureSourceUpdate = makeProduct();
    futureSourceUpdate.evidence.source_updated_at = '2026-08-14T09:30:00.000000001+10:00';
    futureSourceUpdate.evidence_refs[0].source_updated_at = futureSourceUpdate.evidence.source_updated_at;
    expect(() => buildGeneration({ products: [futureSourceUpdate] }))
      .toThrow(/source_updated_at cannot post-date/);
  });

  test('rejects zero rates and comparison rates outside mortgage products', () => {
    const zeroAdvertised = makeProduct();
    zeroAdvertised.rates[0].advertised.value = '0';
    expect(() => buildGeneration({ products: [zeroAdvertised] })).toThrow(/greater than zero/);

    const zeroComparison = makeProduct();
    zeroComparison.rates[0].comparison!.value = '0.000';
    expect(() => buildGeneration({ products: [zeroComparison] })).toThrow(/greater than zero/);

    const savings = makeProduct({ kind: 'savings_account', productId: 'deposit-comparison' });
    savings.rates[0].comparison = {
      value: '0.041',
      unit: 'fraction_per_annum',
      metric: 'comparison_interest',
      basis: 'comparison',
      evidence_status: 'published',
      evidence_ids: savings.evidence.evidence_ids,
    };
    expect(() => buildGeneration({ products: [savings] })).toThrow(/only valid for mortgage/);
  });

  test('compares tier and fee decimal bounds without IEEE-754 rounding', () => {
    expect(() => buildGeneration({
      products: [makeProduct({
        tiers: [{
          unit: 'DOLLAR',
          method: 'PER_TIER',
          minimum: '9007199254740993',
          maximum: '9007199254740992',
          additional_info: null,
          conditions: [],
        }],
      })],
    })).toThrow(/minimum cannot exceed maximum/);

    const product = makeProduct();
    const semanticFee: CanonicalFeeV3['semantic_fee'] = {
      name: 'Balance fee',
      fee_type: 'PERIODIC',
      method: 'VARIABLE',
      cadence: 'P1M',
      additional_info: null,
    };
    product.fees = [{
      fee_uid: canonicalFeeUid(product.identity.product_uid, semanticFee),
      fee_identity_status: 'confirmed',
      semantic_fee: semanticFee,
      disclosure_status: 'complete',
      currency: 'AUD',
      fixed_amount: null,
      minimum_amount: '9007199254740993',
      maximum_amount: '9007199254740992',
      rate: null,
      condition: null,
      evidence_ids: product.evidence.evidence_ids,
    }];
    expect(() => buildGeneration({ products: [product] })).toThrow(/minimum_amount cannot exceed maximum_amount/);
  });

  test('uses authenticated fee semantics as the sole app applicability authority', () => {
    const product = makeProduct();
    const semanticFee: CanonicalFeeV3['semantic_fee'] = {
      name: 'Package fee',
      fee_type: 'PERIODIC',
      method: 'FIXED',
      cadence: 'P1M',
      additional_info: 'canonical package condition',
    };
    product.fees = [{
      fee_uid: canonicalFeeUid(product.identity.product_uid, semanticFee),
      fee_identity_status: 'confirmed',
      semantic_fee: semanticFee,
      disclosure_status: 'complete',
      currency: 'AUD',
      fixed_amount: '10',
      minimum_amount: null,
      maximum_amount: null,
      rate: null,
      condition: '\u13a0\u0345 raw producer condition',
      evidence_ids: product.evidence.evidence_ids,
    }];
    const validated = buildGeneration({ products: [product] }).core.products[0].fees[0];
    expect(validated.condition).toBe('canonical package condition');
    expect(validated.fee_uid).toBe(product.fees[0].fee_uid);

    const detached = clone(product);
    detached.fees[0].condition = 'A different condition';
    const revalidated = buildGeneration({ products: [detached] }).core.products[0].fees[0];
    expect(revalidated.condition).toBe('canonical package condition');
    expect(revalidated.fee_uid).toBe(validated.fee_uid);
  });

  test('preserves alert eligibility and withholds integer exact identities for ambiguous duplicate tiers', () => {
    const product = makeProduct();
    const duplicate = clone(product.rates[0]);
    product.rates[0].identity.rate_identity_status = 'ambiguous';
    product.rates[0].exact_alert_eligible = false;
    duplicate.identity.rate_identity_status = 'ambiguous';
    duplicate.exact_alert_eligible = false;
    duplicate.source_index = 1;
    duplicate.advertised.value = '0.061';
    product.rates.push(duplicate);

    const rows = adapt(buildGeneration({ products: [product] }).core).sections.Mortgage.rates;
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.exact_alert_eligible)).toEqual([false, false]);
    expect(rows.map((row) => row.rate_index)).toEqual([undefined, undefined]);
    expect(() => makeSavedRateRef(rows[0], 'rate')).toThrow(/integer rate_index/);
  });

  test('preserves stable identities and known semantic TD duration without inventing unknown terms', () => {
    const known = makeProduct({
      kind: 'term_deposit',
      productId: 'td-known',
      productName: 'Twelve month term deposit',
      duration: 'P1Y',
    });
    const unknown = makeProduct({
      kind: 'term_deposit',
      productId: 'td-unknown',
      productName: 'Term deposit with unpublished maturity',
      duration: null,
    });
    const generation = buildGeneration({ products: [known, unknown] });
    const rows = adapt(generation.core).sections.TD.rates;
    expect(rows[0]).toMatchObject({
      product_key: known.identity.product_uid,
      product_id: 'td-known',
      term_months: 12,
      term: 'P12M',
      last_updated: known.evidence.observed_at,
    });
    expect(rows[1].term_months).toBeUndefined();
    expect(rows[1].term).toBeUndefined();
  });

  test('does not collapse multi-range or conditional applicability into one balance range', () => {
    const tiers = [
      { unit: 'DOLLAR', method: 'PER_TIER', minimum: '0', maximum: '9999', additional_info: null, conditions: [] },
      { unit: 'DOLLAR', method: 'PER_TIER', minimum: '10000', maximum: null, additional_info: null, conditions: [] },
    ];
    const product = makeProduct({ kind: 'savings_account', productId: 'tiered', tiers });
    product.rates[0].exact_alert_eligible = false;
    const row = adapt(buildGeneration({ products: [product] }).core).sections.Savings.rates[0];
    expect(row.balance_min).toBeUndefined();
    expect(row.balance_max).toBeUndefined();
    expect(row.account_class).toBe('non_standard');

    const percent = makeProduct({
      kind: 'savings_account',
      productId: 'percentage-tier',
      tiers: [{
        unit: 'PERCENT',
        method: 'PER_TIER',
        minimum: '0',
        maximum: '0.5',
        additional_info: null,
        conditions: [],
      }],
    });
    const percentRow = adapt(buildGeneration({ products: [percent] }).core).sections.Savings.rates[0];
    expect(percentRow.balance_min).toBeUndefined();
    expect(percentRow.balance_max).toBeUndefined();
  });

  test('requires settled identity evidence for standard rows and exact alerts', () => {
    const partial = makeProduct();
    partial.rates[0].advertised.evidence_status = 'partial';
    expect(() => buildGeneration({ products: [partial] })).toThrow(/exact alerts require settled evidence/);

    partial.rates[0].exact_alert_eligible = false;
    const partialRow = adapt(buildGeneration({ products: [partial] }).core).sections.Mortgage.rates[0];
    expect(partialRow).toMatchObject({ exact_alert_eligible: false, account_class: 'non_standard' });
    expect(partialRow.rate_index).toBeUndefined();

    const observed = makeProduct({ productId: 'observed-rate' });
    observed.rates[0].advertised.evidence_status = 'observed';
    expect(() => buildGeneration({ products: [observed] })).toThrow(/exact alerts require settled evidence/);
    observed.rates[0].exact_alert_eligible = false;
    expect(adapt(buildGeneration({ products: [observed] }).core).sections.Mortgage.rates[0])
      .toMatchObject({ exact_alert_eligible: false, account_class: 'non_standard' });

    const conditional = makeProduct({
      kind: 'savings_account',
      productId: 'conditional-alert',
      metric: 'conditional_interest',
      conditions: [{ type: 'MONTHLY_DEPOSIT', value: '1000', additional_info: null }],
    });
    expect(() => buildGeneration({ products: [conditional] })).toThrow(/unambiguous applicability/);
  });

  test('maps Savings semantics, base rows, and an exact trusted ongoing-base sibling', () => {
    const savings = makeProduct({
      kind: 'savings_account',
      productId: 'bonus-with-base',
      metric: 'conditional_interest',
      conditions: [{ type: 'MONTHLY_DEPOSIT', value: '1000', additional_info: null }],
    });
    savings.rates[0].exact_alert_eligible = false;
    const base = clone(savings.rates[0]);
    base.advertised = { ...base.advertised, value: '0.01', metric: 'base_interest', basis: 'base' };
    base.semantic_tier = { ...base.semantic_tier, conditions: [] };
    base.identity.rate_uid = canonicalRateUid(savings.identity.product_uid, base.semantic_tier);
    base.exact_alert_eligible = true;
    base.source_index = 1;
    savings.rates.push(base);

    const rows = adapt(buildGeneration({ products: [savings] }).core).sections.Savings.rates;
    expect(rows[0]).toMatchObject({
      product_id: 'bonus-with-base',
      taxonomy_path: 'SAVINGS',
      ribbon_deposit_kind: 'bonus',
      ongoing_rate: '0.01',
    });
    expect(rows[1]).toMatchObject({
      taxonomy_path: 'SAVINGS',
      ribbon_deposit_kind: 'base',
    });
  });

  test('rejects product/rate identity drift and product-count disagreement', () => {
    const generation = buildGeneration();
    const wrongProduct = clone(generation.core) as CorePayloadV3;
    wrongProduct.products[0].identity.product_uid = `product:v1:${'f'.repeat(64)}`;
    expect(() => validateCorePayloadV3(wrongProduct, generation.manifest)).toThrow(/canonical derivation/);

    const wrongRate = clone(generation.core) as CorePayloadV3;
    wrongRate.products[0].rates[0].semantic_tier.duration = 'P1Y';
    expect(() => validateCorePayloadV3(wrongRate, generation.manifest)).toThrow(/rate_uid.*canonical derivation/);

    const wrongCount = { ...generation.manifest, coverage: { ...generation.manifest.coverage, products_consumer_eligible: 2 } };
    expect(() => validateCorePayloadV3(generation.core, wrongCount)).toThrow(/product count/);

    const secondProvider = makeProduct({
      providerUid: SECOND_PROVIDER_UID,
      providerName: 'Second Bank',
      productId: 'second-provider-product',
    });
    const products = [makeProduct(), secondProvider];
    const undercounted = coverageFor(products, { providers_complete: 1, providers_empty: 1 });
    expect(() => buildGeneration({ products, coverage: undercounted }))
      .toThrow(/provider population exceeds complete-or-partial provider coverage/);
  });

  test('rejects legacy aliases that collide with canonical or other product identities', () => {
    const first = makeProduct({ productId: 'alias-first' });
    const second = makeProduct({ productId: 'alias-second' });
    first.identity.legacy_aliases = [second.identity.product_uid];
    first.rates[0].identity.legacy_aliases = [...first.identity.legacy_aliases];
    expect(() => buildGeneration({ products: [first, second] })).toThrow(/legacy product key.*ambiguous/);

    const selfAliased = makeProduct({ productId: 'self-alias' });
    selfAliased.identity.legacy_aliases = [selfAliased.identity.product_uid];
    selfAliased.rates[0].identity.legacy_aliases = [...selfAliased.identity.legacy_aliases];
    expect(() => buildGeneration({ products: [selfAliased] })).toThrow(/canonical UID as a legacy alias/);
  });

  test('preserves the trusted legacy RBA ledger and fails closed when it is absent', () => {
    const generation = buildGeneration();
    const trusted = {
      run_date: generation.core.observation_date,
      rba: [{ date: '2026-08-12', rate: 3.85 }],
      rba_holds: ['2026-07-08'],
    };
    const legacy = adaptCoreV3ToLegacy(generation.core, trusted);
    expect(legacy.rba).toEqual(trusted.rba);
    expect(legacy.rba_holds).toEqual(trusted.rba_holds);
    expect(legacy.rba).not.toBe(trusted.rba);
    expect(() => adaptCoreV3ToLegacy(generation.core, { ...trusted, rba: [] }))
      .toThrow(/trusted legacy RBA ledger/);
    expect(() => adaptCoreV3ToLegacy(generation.core, { ...trusted, run_date: '2026-08-13' }))
      .toThrow(/same-observation/);
  });

  test('rejects mixed units and taxonomy leakage before adaptation', () => {
    const generation = buildGeneration();
    const wrongUnit = clone(generation.core) as unknown as Record<string, any>;
    wrongUnit.products[0].rates[0].advertised.unit = 'percentage_points';
    expect(() => validateCorePayloadV3(wrongUnit, generation.manifest)).toThrow(/fraction_per_annum/);

    const transaction = clone(generation.core) as unknown as Record<string, any>;
    transaction.products[0].classification.product_kind = 'transaction_account';
    transaction.products[0].classification.consumer_section = null;
    expect(() => validateCorePayloadV3(transaction, generation.manifest)).toThrow(/product_kind|confirmed consumer cohort/);
  });

  test('derives prototype-safe legacy brands and rejects ambiguous provider names', () => {
    const constructorBank = makeProduct({ providerName: 'constructor', productId: 'constructor-product' });
    const protoBank = makeProduct({
      providerUid: SECOND_PROVIDER_UID,
      providerName: '__proto__',
      productId: 'proto-product',
    });
    const generation = buildGeneration({ products: [constructorBank, protoBank] });
    const brands = adapt(generation.core).brands;
    expect(Object.getPrototypeOf(brands)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(brands, 'constructor')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(brands, '__proto__')).toBe(true);

    const duplicateName = makeProduct({
      providerUid: SECOND_PROVIDER_UID,
      providerName: 'constructor',
      productId: 'other-provider-product',
    });
    const invalid = { ...generation.core, products: [constructorBank, duplicateName] };
    expect(() => validateCorePayloadV3(invalid, generation.manifest)).toThrow(/legacy brand key.*ambiguous/);
  });

  test('keeps rate-index identity stable when products reorder', () => {
    const first = makeProduct({ productId: 'first' });
    const second = makeProduct({ productId: 'second' });
    const normal = buildGeneration({ products: [first, second] }).core;
    const reversed = buildGeneration({ products: [second, first] }).core;
    const indexes = (core: CorePayloadV3) => Object.fromEntries(
      adapt(core).sections.Mortgage.rates.map((row) => [row.product_key, row.rate_index]),
    );
    expect(indexes(normal)).toEqual(indexes(reversed));
    expect(canonicalRateUid(first.identity.product_uid, first.rates[0].semantic_tier)).toBe(first.rates[0].identity.rate_uid);
  });

  test('binds inflated cache bytes to the descriptor size', () => {
    const generation = buildGeneration();
    expect(() => validateCorePayloadTextV3(`${generation.coreText} `, generation.manifest))
      .toThrow(/inflated byte count/);
  });
});

describe('dormant loader and dual-read behavior', () => {
  test('downloads only the authoritative core capability under declared caps', async () => {
    const generation = buildGeneration();
    const pointerText = JSON.stringify(pointerFor(generation.head));
    const responses = new Map([
      ['pointer', pointerText],
      [generation.head.manifest_url, generation.manifestText],
      [generation.manifest.capabilities.core.url, generation.coreText],
    ]);
    const calls: { url: string; sha?: string; max?: number; inflated?: number }[] = [];
    const download: V3TextDownloader = async (url, sha, opts) => {
      calls.push({ url, sha, max: opts.maxCompressedBytes, inflated: opts.maxInflatedBytes });
      const value = responses.get(url);
      if (value === undefined) throw new Error(`unexpected ${url}`);
      opts.onVerifiedBytes?.(utf8Bytes(value));
      return value;
    };
    const loaded = await loadValidatedV3Generation('pointer', { download });
    expect(loaded.manifest.generation_id).toBe(generation.manifest.generation_id);
    expect(loaded.coreAssetBytesHex).toBe(generation.coreAssetBytesHex);
    expect(calls).toEqual([
      { url: 'pointer', sha: undefined, max: V3_POINTER_LIMIT_BYTES, inflated: V3_POINTER_LIMIT_BYTES },
      {
        url: generation.head.manifest_url,
        sha: generation.head.manifest_sha256,
        max: V3_MANIFEST_LIMIT_BYTES,
        inflated: V3_MANIFEST_LIMIT_BYTES,
      },
      {
        url: generation.manifest.capabilities.core.url,
        sha: generation.manifest.capabilities.core.sha256,
        max: V3_ASSET_LIMITS.core.compressed,
        inflated: V3_ASSET_LIMITS.core.inflated,
      },
    ]);
  });

  test('rejects duplicate JSON keys before object validation', () => {
    const generation = buildGeneration();
    const pointer = JSON.stringify(pointerFor(generation.head)).replace('{', '{"schema_version":3,');
    expect(() => validateGenerationPointerTextV3(pointer)).toThrow(/duplicate JSON object key/);
  });

  test('keeps v3 compile-time disabled and uses v1 when the bridge is off', async () => {
    expect(V3_PAYLOAD_BRIDGE_ENABLED).toBe(false);
    const legacy = adapt(buildGeneration().core);
    const loadV3 = jest.fn(async () => buildGeneration());
    const result = await loadCoreDualRead({
      bridgeEnabled: false,
      loadV3,
      loadV1: async () => legacy,
      v3Cache: createV3GenerationCache(memoryStorage()),
    });
    expect(result.contract).toBe('v1');
    expect(result.assetState.status).toBe('live');
    expect(loadV3).not.toHaveBeenCalled();
  });

  test('does not promote a partial v3 generation and falls back to v1', async () => {
    const product = makeProduct();
    const partial = buildGeneration({
      products: [product],
      observationState: 'partial',
      coverage: coverageFor([product], { providers_complete: 0, providers_partial: 1 }),
    });
    const legacy = adapt(buildGeneration().core);
    const result = await loadCoreDualRead({
      bridgeEnabled: true,
      loadV3: async () => partial,
      loadV1: async () => legacy,
      v3Cache: createV3GenerationCache(memoryStorage()),
    });
    expect(result.contract).toBe('v1');
  });

  test('gates v3 surfacing on alias migration and preserves the trusted v1 RBA ledger', async () => {
    const generation = buildGeneration();
    const legacy = adapt(generation.core);
    const seenAliases: LegacyProductAliasMap[] = [];
    const migrateAliases = jest.fn(async (aliases: LegacyProductAliasMap) => {
      seenAliases.push(aliases);
    });
    const result = await loadCoreDualRead({
      bridgeEnabled: true,
      loadV3: async () => generation,
      loadV1: async () => legacy,
      migrateLegacyProductAliases: migrateAliases,
      v3Cache: createV3GenerationCache(memoryStorage()),
    });
    expect(result.contract).toBe('v3');
    expect(result.core.rba).toEqual(legacy.rba);
    expect(migrateAliases).toHaveBeenCalledTimes(1);
    const aliases = seenAliases[0];
    const legacyAlias = generation.core.products[0].identity.legacy_aliases[0];
    expect(aliases?.get(legacyAlias)).toEqual({
      productKey: generation.core.products[0].identity.product_uid,
    });

    const noMigration = await loadCoreDualRead({
      bridgeEnabled: true,
      loadV3: async () => generation,
      loadV1: async () => legacy,
      v3Cache: createV3GenerationCache(memoryStorage()),
    });
    expect(noMigration.contract).toBe('v1');

    const noLedger = { ...legacy, rba: [] };
    const missingLedger = await loadCoreDualRead({
      bridgeEnabled: true,
      loadV3: async () => generation,
      loadV1: async () => noLedger,
      migrateLegacyProductAliases: async () => undefined,
      v3Cache: createV3GenerationCache(memoryStorage()),
    });
    expect(missingLedger.contract).toBe('v1');
  });

  test('returns verified in-memory v3 data when persistence fails', async () => {
    const generation = buildGeneration();
    const storage = memoryStorage();
    storage.write = async () => { throw new Error('disk full'); };
    const result = await loadCoreDualRead({
      bridgeEnabled: true,
      loadV3: async () => generation,
      loadV1: async () => adapt(generation.core),
      migrateLegacyProductAliases: async () => undefined,
      v3Cache: createV3GenerationCache(storage),
    });
    expect(result.contract).toBe('v3');
    if (result.contract === 'v3') {
      expect(result.source).toBe('live');
      expect(result.warning).toMatch(/disk full/);
      expect(result.assetState.status).toBe('live');
    }
  });
});
