import { utf8ToBytes } from '@noble/hashes/utils';
import { PAYLOAD_REPO } from '../../config';
import { isValidCalendarDate } from '../../lib/calendarDate';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { verifiedCatalogueDetails } from '../detailsCatalogue';
import { eligibilityBundleIdentity, type EligibilityContext, type EligibilityTarget } from '../eligibilityContracts/transport';
import { assertMonetaryWire } from '../monetaryContracts/schemaValidation';
import type { MonetaryDescriptor, MonetaryRouting } from '../monetaryContracts/types';
import { mortgageSnapshotBudget } from '../mortgageContracts/snapshotBudget';
import { downloadInflate } from '../payload';
import { revisionTag } from '../payloadRevision';
import { verifiedCoreContents } from '../sectionIntegrity';

export interface SelectionHandle<TSubject extends { routing: MonetaryRouting; authorityGraph: { identitySha256: string } }, TApproval> {
  readonly subject: TSubject;
  readonly approval: TApproval;
  readonly edition: string;
}

interface Binding<TContext, TTarget> {
  context: TContext;
  target: TTarget;
  manifestSha256: string;
  contentSha256: string;
  indexSha256: string;
  shardSha256: string;
  assetSha256: string;
}

export interface SelectionTransportConfig<
  TSubject extends { routing: MonetaryRouting; authorityGraph: { identitySha256: string } },
  TApproval,
  TAsset extends { productKey: string; identitySha256: string; routing: MonetaryRouting; subjects: { subject: TSubject; approval: TApproval }[] },
> {
  label: 'Savings' | 'Mortgage' | 'Activity';
  section: 'Savings' | 'Mortgage';
  namespaceVersion: 'v3' | 'v4';
  capability: 'savings_calculation' | 'mortgage_calculation' | 'savings_activity_calculation';
  useSnapshotBudget?: boolean;
  isValidCategory?: (target: EligibilityTarget) => boolean;
  extraCategoryCheck?: (target: EligibilityTarget) => void;
  assertNamespaceWire?: (value: unknown) => void;
  assertEnvelopeWire: (value: unknown, kind: 'index' | 'shard') => void;
  validateAsset: (raw: unknown) => TAsset;
  checkOperationsBudget: (subjects: TSubject[]) => void;
  targetMatches?: (subject: TSubject, c: EligibilityContext, target: EligibilityTarget) => boolean;
}

export function createSelectionTransport<
  TSubject extends { routing: MonetaryRouting; authorityGraph: { identitySha256: string } },
  TApproval,
  TAsset extends { productKey: string; identitySha256: string; routing: MonetaryRouting; subjects: { subject: TSubject; approval: TApproval }[] },
>(config: SelectionTransportConfig<TSubject, TApproval, TAsset>) {
  type TSelection = SelectionHandle<TSubject, TApproval>;
  const bindings = new WeakMap<TSelection, Binding<EligibilityContext, EligibilityTarget>>();

  function contextCheck(c: EligibilityContext, target: EligibilityTarget) {
    const { manifest: m, core, details } = c;
    const sectionRates = config.section === 'Savings' ? core?.sections.Savings.rates : core?.sections.Mortgage.rates;
    if (
      !m ||
      !core ||
      !details ||
      m.repo !== PAYLOAD_REPO ||
      !m.payload_revision ||
      !verifiedCoreContents(c.coreIntegrity) ||
      verifiedCatalogueDetails(core, c.coreIntegrity, m, details) !== details ||
      !Object.hasOwn(details.products, target.productKey) ||
      details.products[target.productKey] !== target.detail ||
      target.kind === 'rate_variant' && (target.section !== config.section || !sectionRates?.includes(target.row) || target.row.product_key !== target.productKey) ||
      config.isValidCategory && !config.isValidCategory(target)
    ) {
      throw new Error(`${config.label} product publication is not verified`);
    }
    config.extraCategoryCheck?.(target);
    return { m, core, details };
  }

  function route(c: EligibilityContext, target: EligibilityTarget) {
    const { m } = contextCheck(c, target);
    const misplacedPattern = config.namespaceVersion === 'v4' ? /^(monetary|executable)_v[34]_/ : /^(monetary|executable)_v3_/;
    if (Object.entries(m.files).some(([key, value]) => misplacedPattern.test(key) || misplacedPattern.test(value.name))) {
      throw new Error('Misplaced monetary descriptors');
    }
    const namespaceKey = config.namespaceVersion === 'v4' ? 'executable_v4' : 'executable_v3';
    if (!Object.hasOwn(m, namespaceKey)) return null;
    if (utf8ToBytes(JSON.stringify(m)).length > 64 * 1024) throw new Error('Monetary manifest size limit');
    if (config.assertNamespaceWire) config.assertNamespaceWire(m[namespaceKey]);
    else assertMonetaryWire(m.executable_v3, 'namespace');

    const r = m.payload_revision!;
    const bundle = eligibilityBundleIdentity(m);
    if (
      !isValidCalendarDate(m.run_date) ||
      r.schema_version !== 1 ||
      !Number.isSafeInteger(r.revision) ||
      r.revision < 1 ||
      r.revision > 999999 ||
      m.tag !== revisionTag(m.run_date, r.revision) ||
      r.bundle_sha256 !== bundle ||
      r.generation_id !== `sha256-${bundle}` ||
      !(r.parent_revision === null || Number.isSafeInteger(r.parent_revision) && r.parent_revision > 0 && r.parent_revision < r.revision)
    ) {
      throw new Error('Monetary immutable revision mismatch');
    }

    const names = new Set<string>();
    let bytes = 0;
    function descriptor(d: MonetaryDescriptor, expected?: string) {
      if (
        !d ||
        typeof d.name !== 'string' ||
        names.has(d.name) ||
        !Number.isSafeInteger(d.bytes) ||
        d.bytes <= 0 ||
        !/^[a-f0-9]{64}$/.test(d.sha256) ||
        expected && d.name !== `${expected}-${m.run_date}-${d.sha256.slice(0, 12)}.json.gz`
      ) {
        throw new Error('Monetary descriptor mismatch');
      }
      names.add(d.name);
      bytes += d.bytes;
    }

    Object.values(m.files).forEach(d => descriptor(d));
    if (m.executable_v2) {
      descriptor(m.executable_v2.index, 'executable_v2_index');
      Object.entries(m.executable_v2.shards).forEach(([key, d]) => descriptor(d, key));
    }
    const v3Capabilities = config.namespaceVersion === 'v4' ? (m.executable_v3?.capabilities ?? {}) : m.executable_v3!.capabilities;
    for (const [capability, inventory] of Object.entries(v3Capabilities)) {
      descriptor(inventory!.index, `monetary_v3_${capability}_index`);
      Object.entries(inventory!.shards).forEach(([key, d]) => descriptor(d, key));
    }
    if (config.namespaceVersion === 'v4') {
      for (const [capability, inventory] of Object.entries(m.executable_v4!.capabilities)) {
        descriptor(inventory!.index, `monetary_v4_${capability}_index`);
        Object.entries(inventory!.shards).forEach(([key, d]) => descriptor(d, key));
      }
    }
    if (bytes > 8 * 1024 * 1024) throw new Error('Shared publication transfer budget exceeded');
    const capabilities = config.namespaceVersion === 'v4' ? m.executable_v4!.capabilities : m.executable_v3!.capabilities;
    return (capabilities as Record<string, { index: MonetaryDescriptor; shards: Record<string, MonetaryDescriptor> } | undefined>)[config.capability] ?? null;
  }

  function routingCheck(r: MonetaryRouting, c: EligibilityContext, target: EligibilityTarget) {
    // Called synchronously only after the boundary has verified the adopted context.
    const m = c.manifest!;
    if (
      r.productKey !== target.productKey ||
      r.runDate !== m.run_date ||
      r.coreAssetSha256 !== m.files.core.sha256 ||
      r.detailsAssetSha256 !== m.files.details.sha256 ||
      r.sourceGenerationId !== m.source_observation?.generation_id ||
      r.exportContractSha256 !== m.source_observation?.contract_digest ||
      r.productRecordSha256 !== hashText(canonical(target.detail))
    ) {
      throw new Error(`${config.label} routing source association mismatch`);
    }
  }

  async function acquire(c: EligibilityContext, d: MonetaryDescriptor, budget: ReturnType<typeof mortgageSnapshotBudget> | null) {
    const text = await downloadInflate(
      `https://github.com/${PAYLOAD_REPO}/releases/download/${c.manifest!.tag}/${d.name}`,
      d.sha256,
      {
        fileName: d.name,
        expectedBytes: d.bytes,
        requireExactBytes: true,
        maxCompressedBytes: 512 * 1024,
        maxInflatedBytes: budget ? Math.min(512 * 1024, budget.remaining) : 512 * 1024,
        allowEncrypted: false,
      },
    );
    budget?.consume(text);
    return JSON.parse(text);
  }

  function envelope(v: any, c: EligibilityContext, kind: 'index' | 'shard') {
    config.assertEnvelopeWire(v, kind);
    if (v.run_date !== c.manifest!.run_date || v.core_asset_sha256 !== c.manifest!.files.core.sha256 || v.details_asset_sha256 !== c.manifest!.files.details.sha256) {
      throw new Error('Monetary envelope edition mismatch');
    }
  }

  async function loadSelections(c: EligibilityContext, target: EligibilityTarget): Promise<TSelection[]> {
    const inventory = route(c, target);
    if (!inventory) return [];
    const budget = config.useSnapshotBudget ? mortgageSnapshotBudget(c.core, c.details) : null;
    const adoptedCore = c.core;
    const manifestSha256 = hashText(canonical(c.manifest));
    const index = await acquire(c, inventory.index, budget);
    envelope(index, c, 'index');
    contextCheck(c, target);
    const referenced = new Set(Object.values(index.products));
    if (
      referenced.size !== Object.keys(inventory.shards).length ||
      [...referenced].some(key => typeof key !== 'string' || !Object.hasOwn(inventory.shards, key)) ||
      Object.keys(index.products).some(key => !Object.hasOwn(c.details!.products, key))
    ) {
      throw new Error('Monetary index inventory mismatch');
    }
    if (!Object.hasOwn(index.products, target.productKey)) return [];
    const shardKey = index.products[target.productKey];
    const d = inventory.shards[shardKey];
    const shard = await acquire(c, d, budget);
    envelope(shard, c, 'shard');
    contextCheck(c, target);
    if (!Object.hasOwn(shard.products, target.productKey)) throw new Error(`${config.label} product absent from its shard`);
    const assets = Object.entries(shard.products).map(([key, raw]) => {
      const asset = config.validateAsset(raw);
      if (key !== asset.productKey || index.products[key] !== shardKey || !Object.hasOwn(c.details!.products, key)) {
        throw new Error('Monetary product map mismatch');
      }
      routingCheck(asset.routing, c, { kind: 'product', productKey: key, detail: c.details!.products[key] });
      return asset;
    });
    config.checkOperationsBudget(assets.flatMap(a => a.subjects.map(e => e.subject)));
    if (hashText(canonical(c.manifest)) !== manifestSha256 || c.core !== adoptedCore) {
      throw new Error(`${config.label} publication changed`);
    }
    const asset = assets.find(a => a.productKey === target.productKey)!;
    const subjects = config.targetMatches ? asset.subjects.filter(({ subject }) => config.targetMatches!(subject, c, target)) : asset.subjects;
    return subjects.map(({ subject, approval }) => {
      const handle: TSelection = { subject, approval, edition: c.manifest!.payload_revision!.bundle_sha256 };
      bindings.set(handle, {
        context: { ...c },
        target: { ...target },
        manifestSha256,
        contentSha256: hashText(canonical(handle)),
        indexSha256: inventory.index.sha256,
        shardSha256: d.sha256,
        assetSha256: asset.identitySha256,
      });
      return handle;
    });
  }

  function assertSelection(selection: TSelection, c: EligibilityContext, target: EligibilityTarget) {
    const b = bindings.get(selection);
    contextCheck(c, target);
    if (config.targetMatches && !config.targetMatches(selection.subject, c, target)) {
      throw new Error(`${config.label} selected target mismatch`);
    }
    if (
      !b ||
      b.context.manifest !== c.manifest ||
      b.context.core !== c.core ||
      b.context.coreIntegrity !== c.coreIntegrity ||
      b.context.details !== c.details ||
      b.target.kind !== target.kind ||
      b.target.productKey !== target.productKey ||
      b.target.detail !== target.detail ||
      target.kind === 'rate_variant' && (b.target.kind !== 'rate_variant' || b.target.row !== target.row || b.target.section !== target.section) ||
      hashText(canonical(c.manifest)) !== b.manifestSha256 ||
      hashText(canonical(selection)) !== b.contentSha256
    ) {
      throw new Error(`${config.label} selection is stale or unverified`);
    }
    routingCheck(selection.subject.routing, c, target);
    return {
      manifestSha256: b.manifestSha256,
      edition: selection.edition,
      indexSha256: b.indexSha256,
      shardSha256: b.shardSha256,
      assetSha256: b.assetSha256,
      coreSha256: c.manifest!.files.core.sha256,
      detailsSha256: c.manifest!.files.details.sha256,
      authorityGraphSha256: selection.subject.authorityGraph.identitySha256,
    };
  }

  return { loadSelections, assertSelection };
}
