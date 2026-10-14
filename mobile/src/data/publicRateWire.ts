import type { Manifest } from '../types';
import { isValidCalendarDate } from '../lib/calendarDate';
import { finiteDecimal } from './publicRateDecimal';
import type { PublicCondition, PublicEvidence, PublicFormula, PublicProduct, PublicProgramme, PublicRateAsset, PublicRateBinding, PublicRateCapability, PublicRateIndex, PublicRateShard } from './publicRateModel';

export const PUBLIC_RATE_INDEX_COMPRESSED = 256 * 1024;
export const PUBLIC_RATE_INDEX_DECODED = 2 * 1024 * 1024;
export const PUBLIC_RATE_SHARD_COMPRESSED = 1024 * 1024;
export const PUBLIC_RATE_SHARD_DECODED = 4 * 1024 * 1024;
export const PUBLIC_RATE_TOTAL_DECODED = 24 * 1024 * 1024;
const SHA = /^[a-f0-9]{64}$/;
const SECTIONS = ['Mortgage', 'Savings', 'TD'];
const FIELDS = ['purpose', 'repayment', 'amount', 'balance', 'lvr', 'termMonths', 'termDays', 'channel', 'package', 'customerCategory', 'qualification', 'effectiveDate', 'custom', 'monthlyDeposit', 'withdrawals', 'balanceGrowth', 'cardTransactions'];
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown, limit = 4096): value is string { return typeof value === 'string' && value.length > 0 && value.length <= limit; }
function strings(value: unknown, limit = 4096): value is string[] { return Array.isArray(value) && value.length <= limit && value.every(item => text(item)); }
function sha(value: unknown): value is string { return typeof value === 'string' && SHA.test(value); }
function time(value: unknown): boolean {
  return value === undefined || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) &&
    isValidCalendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}
function duplicates(values: string[]): boolean { return new Set(values).size !== values.length; }
function invalid(message: string): never { throw new Error(message); }
function keys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  return required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}

function validAsset(value: unknown, manifest: Manifest, compressedLimit: number, decodedLimit: number): value is PublicRateAsset {
  if (!object(value) || !keys(value, ['name', 'url', 'sha256', 'bytes', 'decodedBytes', 'encoding'])) return false;
  const prefix = `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/`;
  const kind = compressedLimit === PUBLIC_RATE_INDEX_COMPRESSED ? 'index' : 'shard-[0-9]{4}';
  const expectedName = new RegExp(`^public-rate-${kind}-${manifest.run_date}-${String(value.sha256).slice(0, 12)}\\.json\\.gz$`);
  return text(value.name, 256) && expectedName.test(value.name) &&
    value.url === prefix + value.name && sha(value.sha256) && Number.isSafeInteger(value.bytes) && Number(value.bytes) > 0 && Number(value.bytes) <= compressedLimit &&
    Number.isSafeInteger(value.decodedBytes) && Number(value.decodedBytes) > 0 && Number(value.decodedBytes) <= decodedLimit && value.encoding === 'gzip';
}

function binding(value: unknown, manifest: Manifest): value is PublicRateBinding {
  return object(value) && value.schemaVersion === 1 && text(value.generationId, 256) && value.generationId === manifest.source_observation?.generation_id &&
    value.runDate === manifest.run_date && isValidCalendarDate(String(value.runDate)) && value.coreSha256 === manifest.files.core.sha256 &&
    value.detailsSha256 === manifest.files.details.sha256 && sha(value.coreSha256) && sha(value.detailsSha256);
}

/** Missing optional capability is compatible. Malformed metadata is never borrowed from aliases. */
export function validatePublicRateCapability(manifest: Manifest, expectedRepo = 'yanniedog/AR-local'): PublicRateCapability | null {
  const value = manifest.public_rate_catalogue;
  if (value === undefined) return null;
  if (!manifest.payload_revision || manifest.repo !== expectedRepo || !new RegExp(`^app-payload-${manifest.run_date}-r[0-9]{6}$`).test(manifest.tag) ||
      !binding(value, manifest) || !object(value) || !keys(value, ['schemaVersion', 'generationId', 'runDate', 'coreSha256', 'detailsSha256', 'index', 'shards']) ||
      Object.hasOwn(manifest.files, 'public_rate_catalogue') || manifest.files.core.bytes > 512 * 1024 ||
      !validAsset(value.index, manifest, PUBLIC_RATE_INDEX_COMPRESSED, PUBLIC_RATE_INDEX_DECODED) || !Array.isArray(value.shards) || value.shards.length > 128 ||
      !value.shards.every(item => validAsset(item, manifest, PUBLIC_RATE_SHARD_COMPRESSED, PUBLIC_RATE_SHARD_DECODED))) invalid('Invalid public rate capability binding or budget');
  const capability = value as PublicRateCapability;
  const assets = [capability.index, ...capability.shards];
  if (duplicates(assets.map(asset => asset.name)) || duplicates(assets.map(asset => asset.sha256)) ||
      assets.reduce((sum, asset) => sum + asset.decodedBytes, 0) > PUBLIC_RATE_TOTAL_DECODED ||
      Object.values(manifest.files).some(file => assets.some(asset => file.name === asset.name))) invalid('Public rate catalogue exceeds total budget or aliases an asset');
  return capability;
}

function freshness(value: unknown): boolean {
  return object(value) && keys(value, ['state', 'reasonCodes'], ['checkedAt', 'lastSuccessAt']) && ['current', 'failed', 'stale', 'deferred', 'unknown'].includes(String(value.state)) &&
    strings(value.reasonCodes) && time(value.checkedAt) && time(value.lastSuccessAt);
}
function condition(value: unknown): value is PublicCondition {
  return object(value) && keys(value, ['conditionId', 'field', 'operator', 'evidenceIds'], ['value', 'values', 'minimum', 'maximum', 'minimumInclusive', 'maximumInclusive', 'description']) &&
    text(value.conditionId, 256) && FIELDS.includes(String(value.field)) && ['eq', 'in', 'bounds', 'known'].includes(String(value.operator)) && strings(value.evidenceIds) &&
    (value.value === undefined || typeof value.value === 'string' || typeof value.value === 'boolean') &&
    (value.values === undefined || Array.isArray(value.values) && value.values.length <= 64 && value.values.every(item => typeof item === 'string' || typeof item === 'boolean')) &&
    (value.minimum === undefined || finiteDecimal(value.minimum)) && (value.maximum === undefined || finiteDecimal(value.maximum)) &&
    (value.minimumInclusive === undefined || typeof value.minimumInclusive === 'boolean') && (value.maximumInclusive === undefined || typeof value.maximumInclusive === 'boolean') &&
    (value.description === undefined || text(value.description, 16384));
}
function conditions(value: unknown): value is PublicCondition[] { return Array.isArray(value) && value.length <= 256 && value.every(condition); }
function formula(value: unknown, count = { nodes: 0 }, depth = 0): value is PublicFormula {
  if (!object(value) || depth > 16 || ++count.nodes > 256) return false;
  const next = (child: unknown) => formula(child, count, depth + 1);
  if (value.op === 'component') return keys(value, ['op', 'componentId']) && text(value.componentId, 256);
  if (value.op === 'add' || value.op === 'subtract') return keys(value, ['op', 'operands']) && Array.isArray(value.operands) && value.operands.length >= 2 && value.operands.length <= 64 && value.operands.every(next);
  if (value.op === 'alternatives') return keys(value, ['op', 'choices']) && Array.isArray(value.choices) && value.choices.length > 0 && value.choices.length <= 64 &&
    value.choices.every(choice => object(choice) && keys(choice, ['conditions', 'formula']) && conditions(choice.conditions) && next(choice.formula));
  if (value.op === 'tiered') return keys(value, ['op', 'field', 'method', 'tiers']) && ['amount', 'balance', 'lvr'].includes(String(value.field)) &&
    ['whole_balance', 'per_tier'].includes(String(value.method)) && Array.isArray(value.tiers) && value.tiers.length > 0 && value.tiers.length <= 128 && value.tiers.every(tier =>
      object(tier) && keys(tier, ['formula'], ['minimum', 'maximum', 'minimumInclusive', 'maximumInclusive']) &&
      (tier.minimum === undefined || finiteDecimal(tier.minimum)) && (tier.maximum === undefined || finiteDecimal(tier.maximum)) &&
      (tier.minimumInclusive === undefined || typeof tier.minimumInclusive === 'boolean') && (tier.maximumInclusive === undefined || typeof tier.maximumInclusive === 'boolean') && next(tier.formula));
  if (value.op === 'cap') return keys(value, ['op', 'value', 'formula']) && finiteDecimal(value.value) && next(value.formula);
  if (value.op === 'from') return keys(value, ['op', 'formula']) && next(value.formula);
  if (value.op === 'range') return keys(value, ['op', 'minimum', 'maximum']) && next(value.minimum) && next(value.maximum);
  return false;
}
function formulaEvidence(value: PublicFormula): string[] {
  if (value.op === 'alternatives') return value.choices.flatMap(choice => [...choice.conditions.flatMap(condition => condition.evidenceIds), ...formulaEvidence(choice.formula)]);
  if (value.op === 'add' || value.op === 'subtract') return value.operands.flatMap(formulaEvidence);
  if (value.op === 'tiered') return value.tiers.flatMap(tier => formulaEvidence(tier.formula));
  if (value.op === 'cap' || value.op === 'from') return formulaEvidence(value.formula);
  if (value.op === 'range') return [...formulaEvidence(value.minimum), ...formulaEvidence(value.maximum)];
  return [];
}
function programme(value: unknown): value is PublicProgramme {
  if (!object(value) || !keys(value, ['schemaVersion', 'programmeId', 'productId', 'section', 'offerId', 'conditions', 'components', 'evidenceIds', 'freshness', 'reasonCodes', 'sourceBindings'], ['formula', 'phases', 'effectiveFrom', 'effectiveTo', 'fees', 'feeCoverage', 'feeSetId', 'metadata', 'materialFootnotes']) ||
      value.schemaVersion !== 1 || !text(value.programmeId, 256) || !text(value.productId, 256) || !text(value.offerId, 256) || !SECTIONS.includes(String(value.section)) ||
      !conditions(value.conditions) || !strings(value.evidenceIds) || !strings(value.reasonCodes) || !freshness(value.freshness) || !time(value.effectiveFrom) || !time(value.effectiveTo) ||
      !Array.isArray(value.sourceBindings) || value.sourceBindings.length > 256 || !value.sourceBindings.every(item => object(item) && keys(item, ['pointer', 'rateIndex']) && text(item.pointer) && Number.isSafeInteger(item.rateIndex) && Number(item.rateIndex) > 0) ||
      !Array.isArray(value.components) || value.components.length > 256 || value.components.some(component => !object(component) ||
        !keys(component, ['componentId', 'role', 'unit', 'scopeId', 'conditions', 'evidenceIds', 'source'], ['value', 'includedInPayable', 'referenceId']) ||
        !text(component.componentId, 256) || !text(component.scopeId, 256) || !['payable', 'reference', 'discount', 'margin', 'bonus', 'comparison', 'reversion'].includes(String(component.role)) ||
        !['fraction_per_annum', 'percentage_points', 'basis_points'].includes(String(component.unit)) || (component.value !== undefined && !finiteDecimal(component.value)) ||
        !conditions(component.conditions) || !strings(component.evidenceIds) || !object(component.source) || !keys(component.source, ['rawType', 'pointer'], ['rawValue']) ||
        !text(component.source.rawType) || typeof component.source.pointer !== 'string' || component.source.pointer.length > 4096 ||
        (component.source.rawValue !== undefined && typeof component.source.rawValue !== 'string') ||
        (component.includedInPayable !== undefined && typeof component.includedInPayable !== 'boolean') || (component.referenceId !== undefined && !text(component.referenceId, 256))) ||
      value.formula !== undefined && !formula(value.formula)) return false;
  if (value.materialFootnotes !== undefined && (!Array.isArray(value.materialFootnotes)
      || value.materialFootnotes.length > 64 || !value.materialFootnotes.every(note => text(note, 16384)))) return false;
  if (duplicates(value.components.map(item => String(item.componentId)))) return false;
  if (value.feeSetId !== undefined && (!text(value.feeSetId, 256) || value.fees !== undefined || value.feeCoverage !== undefined)) return false;
  if (value.metadata !== undefined) {
    const metadata = value.metadata;
    if (!object(metadata) || !keys(metadata, [], ['rateStructure', 'quotedTerm', 'interestPayment', 'tierApplication']) ||
        metadata.rateStructure !== undefined && !['fixed', 'variable', 'conditional', 'introductory'].includes(String(metadata.rateStructure)) ||
        metadata.tierApplication !== undefined && !['whole_balance', 'per_tier'].includes(String(metadata.tierApplication)) ||
        metadata.quotedTerm !== undefined && (!object(metadata.quotedTerm) || !keys(metadata.quotedTerm, ['value', 'unit']) || !finiteDecimal(metadata.quotedTerm.value) || !['month', 'day'].includes(String(metadata.quotedTerm.unit))) ||
        metadata.interestPayment !== undefined && (!object(metadata.interestPayment) || !keys(metadata.interestPayment, ['type'], ['frequency']) ||
          !['maturity', 'periodic'].includes(String(metadata.interestPayment.type)) || metadata.interestPayment.frequency !== undefined && !/^P[1-9][0-9]*(?:D|W|M|Y)$/.test(String(metadata.interestPayment.frequency)))) return false;
  }
  if (value.feeCoverage !== undefined && (!object(value.feeCoverage) || !keys(value.feeCoverage, ['status', 'reasonCodes', 'evidenceIds']) || !['complete', 'partial', 'unknown'].includes(String(value.feeCoverage.status)) || !strings(value.feeCoverage.reasonCodes) || !strings(value.feeCoverage.evidenceIds))) return false;
  if (value.fees !== undefined && (!Array.isArray(value.fees) || value.fees.length > 256 || value.fees.some(fee => !object(fee) ||
      !keys(fee, ['feeId', 'scopeId', 'name', 'role', 'conditions', 'evidenceIds', 'source'], ['currency', 'amount', 'minimumAmount', 'maximumAmount', 'frequencyMonths', 'event']) || !text(fee.feeId, 256) ||
      !text(fee.name, 1024) || ![value.productId, value.offerId].includes(fee.scopeId) ||
      !['upfront', 'recurring', 'package', 'switching', 'cashback', 'event'].includes(String(fee.role)) || fee.currency !== undefined && !/^[A-Z]{3}$/.test(String(fee.currency)) ||
      fee.amount !== undefined && !finiteDecimal(fee.amount) || fee.minimumAmount !== undefined && !finiteDecimal(fee.minimumAmount) || fee.maximumAmount !== undefined && !finiteDecimal(fee.maximumAmount) ||
      fee.frequencyMonths !== undefined && (!Number.isSafeInteger(fee.frequencyMonths) || Number(fee.frequencyMonths) < 1) || fee.event !== undefined && !text(fee.event) ||
      !conditions(fee.conditions) || !strings(fee.evidenceIds) || !object(fee.source) || !keys(fee.source, ['rawType', 'pointer'], ['rawValue']) || !text(fee.source.rawType) || typeof fee.source.pointer !== 'string'))) return false;
  return value.phases === undefined || Array.isArray(value.phases) && value.phases.length <= 128 && value.phases.every(phase => object(phase) &&
    keys(phase, ['phaseId', 'startMonth', 'formula', 'conditions', 'evidenceIds'], ['endMonth']) && text(phase.phaseId, 256) && Number.isSafeInteger(phase.startMonth) && Number(phase.startMonth) >= 0 &&
    (phase.endMonth === undefined || Number.isSafeInteger(phase.endMonth) && Number(phase.endMonth) > Number(phase.startMonth)) && conditions(phase.conditions) && strings(phase.evidenceIds) && formula(phase.formula));
}

function publicEvidence(value: unknown): value is PublicEvidence {
  if (!object(value) || !keys(value, ['evidenceId', 'url', 'sha256', 'locator'], ['checkedAt', 'effectiveFrom', 'effectiveTo', 'extractionVersion']) ||
    !text(value.evidenceId, 256) || !sha(value.sha256) || !text(value.locator) || !time(value.checkedAt) || !time(value.effectiveFrom) || !time(value.effectiveTo) || !text(value.url, 8192) ||
    value.extractionVersion !== undefined && !text(value.extractionVersion, 256)) return false;
  try { const url = new URL(value.url); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}

function product(value: unknown): value is PublicProduct {
  return object(value) && keys(value, ['productId', 'productKey', 'providerId', 'providerName', 'name', 'section', 'aliases', 'status', 'programmeIds', 'referenceIds', 'reasonCodes'], ['suppressedProgrammeCount', 'freshness', 'sourceEvidence']) &&
    text(value.productId, 256) && text(value.productKey) && text(value.providerId, 256) && text(value.providerName) && text(value.name) && SECTIONS.includes(String(value.section)) &&
    ['current', 'legacy', 'unknown'].includes(String(value.status)) && strings(value.programmeIds) && !duplicates(value.programmeIds) && strings(value.referenceIds) && strings(value.reasonCodes) &&
    (value.suppressedProgrammeCount === undefined || Number.isSafeInteger(value.suppressedProgrammeCount) && Number(value.suppressedProgrammeCount) >= 0 && Number(value.suppressedProgrammeCount) <= 100000) &&
    (value.freshness === undefined || freshness(value.freshness)) && (value.sourceEvidence === undefined || publicEvidence(value.sourceEvidence)) &&
    Array.isArray(value.aliases) && value.aliases.length <= 64 && value.aliases.every(alias => object(alias) && keys(alias, ['name'], ['effectiveFrom', 'effectiveTo']) && text(alias.name) && time(alias.effectiveFrom) && time(alias.effectiveTo));
}

/** Called only after all discovery shards are verified; routes cannot silently omit identities. */
export function validatePublicRateDiscovery(index: PublicRateIndex, products: readonly PublicProduct[]): void {
  if (products.length > 20000 || !products.every(product) || duplicates(products.map(item => item.productId)) || duplicates(products.map(item => item.productKey)) ||
      duplicates(products.flatMap(item => item.programmeIds))) invalid('Ambiguous public product identity');
  const known = new Map(products.map(item => [item.productId, item]));
  for (const shard of index.shards) {
    const route = index.routes?.find(item => item.name === shard.name);
    for (const id of shard.productIds) {
      const item = known.get(id);
      if (!item || route && (!route.providerIds.includes(item.providerId) || !route.sections.includes(item.section))) invalid('Public pricing route refers to undiscovered product');
    }
  }
}

export function validatePublicRateIndex(value: unknown, manifest: Manifest): PublicRateIndex {
  const capability = validatePublicRateCapability(manifest);
  if (!capability || !binding(value, manifest) || !object(value) || !keys(value, ['schemaVersion', 'generationId', 'runDate', 'coreSha256', 'detailsSha256', 'products', 'coverage', 'shards'], ['routes']) ||
      !Array.isArray(value.products) || value.products.length > 20000 || !value.products.every(product) || !Array.isArray(value.coverage) || value.coverage.length > 4096 || !Array.isArray(value.shards) || value.shards.length !== capability.shards.length) invalid('Invalid public rate index');
  const index = value as unknown as PublicRateIndex;
  if (duplicates(index.products.map(product => product.productId)) || duplicates(index.products.map(product => product.productKey))) invalid('Ambiguous public product identity');
  for (const entry of index.coverage) if (!object(entry) || !text(entry.providerId, 240) || !text(entry.providerName, 1024) || !SECTIONS.includes(entry.section) ||
    !text(entry.sourceStatus, 128) || !text(entry.resolutionStatus, 128) || !text(entry.publicationStatus, 128) || !strings(entry.reasonCodes, 128)) invalid('Invalid public pricing coverage');
  const productIds = new Set(index.products.map(product => product.productId));
  if (index.routes !== undefined) {
    if (!Array.isArray(index.routes) || index.routes.length !== index.shards.length || duplicates(index.routes.map(route => route.name)) || index.routes.some(route =>
      !object(route) || !keys(route, ['name', 'kind', 'providerIds', 'sections']) || !text(route.name, 256) || !['discovery', 'pricing'].includes(route.kind) ||
      !strings(route.providerIds, 4096) || !route.providerIds.length || duplicates(route.providerIds) || !Array.isArray(route.sections) || !route.sections.length || route.sections.length > 3 ||
      route.sections.some(section => !SECTIONS.includes(section)) || duplicates(route.sections) || !index.shards.some(shard => shard.name === route.name))) invalid('Invalid public discovery routing');
  }
  for (const entry of index.shards) {
    if (!object(entry) || !keys(entry, ['name', 'sha256', 'bytes', 'decodedBytes', 'encoding', 'productIds']) || !strings(entry.productIds, 20000) ||
        !index.routes && entry.productIds.some(id => !productIds.has(id)) || duplicates(entry.productIds) ||
        index.routes?.find(route => route.name === entry.name)?.kind === 'discovery' && entry.productIds.length !== 0) invalid('Invalid public rate shard routing');
    const asset = capability.shards.find(file => file.name === entry.name);
    if (!asset || entry.sha256 !== asset.sha256 || entry.bytes !== asset.bytes || entry.decodedBytes !== asset.decodedBytes || entry.encoding !== asset.encoding) invalid('Public rate shard descriptor mismatch');
  }
  if (duplicates(index.shards.map(shard => shard.name))) invalid('Duplicate public rate shard');
  return index;
}

export function validatePublicRateShard(value: unknown, manifest: Manifest, index: PublicRateIndex, asset: PublicRateAsset, products: readonly PublicProduct[] = index.products): PublicRateShard {
  const route = index.shards.find(shard => shard.name === asset.name && shard.sha256 === asset.sha256);
  if (!route || !binding(value, manifest) || !object(value) || !keys(value, ['schemaVersion', 'generationId', 'runDate', 'coreSha256', 'detailsSha256', 'programmes', 'referenceRates', 'evidence'], ['feeSets', 'products']) ||
      !Array.isArray(value.programmes) || value.programmes.length > 20000 || !value.programmes.every(programme) || !Array.isArray(value.referenceRates) || value.referenceRates.length > 10000 ||
      !Array.isArray(value.evidence) || value.evidence.length > 20000) invalid('Invalid public rate shard');
  const shard = value as unknown as PublicRateShard;
  const kind = index.routes?.find(item => item.name === asset.name);
  if (kind?.kind === 'discovery') {
    if (!Array.isArray(shard.products) || !shard.products.length || shard.products.length > 20000 || !shard.products.every(product) ||
        duplicates(shard.products.map(item => item.productId)) || duplicates(shard.products.map(item => item.productKey)) ||
        shard.products.some(item => !kind.providerIds.includes(item.providerId) || !kind.sections.includes(item.section)) ||
        shard.programmes.length || shard.referenceRates.length || shard.evidence.length || shard.feeSets?.length) invalid('Invalid public discovery shard');
  } else if (shard.products !== undefined) invalid('Products require a declared discovery shard');
  if (duplicates(shard.programmes.map(item => item.programmeId)) || duplicates(shard.evidence.map(item => item.evidenceId))) invalid('Duplicate public pricing identity');
  for (const item of shard.programmes) {
    const product = products.find(product => product.productId === item.productId);
    if (!route.productIds.includes(item.productId) || !product?.programmeIds.includes(item.programmeId) || product.section !== item.section) invalid('Programme is not bound to the declared product');
  }
  for (const item of shard.referenceRates) if (!object(item) || !keys(item, ['referenceId', 'providerId', 'name', 'unit', 'freshness', 'evidenceIds'], ['value', 'effectiveFrom', 'effectiveTo', 'scopeId', 'conditions']) ||
    !text(item.referenceId, 256) || !text(item.providerId, 256) || !text(item.name) || item.value !== undefined && !finiteDecimal(item.value) || !['fraction_per_annum', 'percentage_points', 'basis_points'].includes(item.unit) ||
    !freshness(item.freshness) || !strings(item.evidenceIds) || !time(item.effectiveFrom) || !time(item.effectiveTo) ||
    item.scopeId !== undefined && !text(item.scopeId, 256) || item.conditions !== undefined && !conditions(item.conditions)) invalid('Invalid public reference observation');
  if (kind && shard.referenceRates.some(item => !kind.providerIds.includes(item.providerId))) invalid('Reference provider is outside the declared pricing route');
  if (!shard.evidence.every(publicEvidence)) invalid('Invalid public rate evidence');
  const evidence = new Set(shard.evidence.map(item => item.evidenceId));
  const refs = shard.programmes.flatMap(item => [...item.evidenceIds, ...item.conditions.flatMap(condition => condition.evidenceIds), ...item.components.flatMap(component => [...component.evidenceIds, ...component.conditions.flatMap(condition => condition.evidenceIds)])]);
  refs.push(...shard.referenceRates.flatMap(item => [...item.evidenceIds, ...(item.conditions ?? []).flatMap(condition => condition.evidenceIds)]));
  refs.push(...shard.programmes.flatMap(item => [...(item.formula ? formulaEvidence(item.formula) : []), ...(item.phases ?? []).flatMap(phase =>
    [...phase.evidenceIds, ...phase.conditions.flatMap(condition => condition.evidenceIds), ...formulaEvidence(phase.formula)])]));
  refs.push(...shard.programmes.flatMap(item => [...(item.feeCoverage?.evidenceIds ?? []), ...(item.fees ?? []).flatMap(fee => [...fee.evidenceIds, ...fee.conditions.flatMap(condition => condition.evidenceIds)])]));
  if (shard.feeSets !== undefined) {
    if (!Array.isArray(shard.feeSets) || shard.feeSets.length > 20000 || duplicates(shard.feeSets.map(set => set.feeSetId))) invalid('Invalid public fee sets');
    for (const set of shard.feeSets) {
      if (!object(set) || !keys(set, ['feeSetId', 'productId', 'fees', 'feeCoverage']) || !text(set.feeSetId, 256) || !route.productIds.includes(set.productId) ||
          !programme({ schemaVersion: 1, programmeId: 'fee-validation', productId: set.productId, section: 'Mortgage', offerId: 'fee-validation', conditions: [], components: [], evidenceIds: [],
            freshness: { state: 'unknown', reasonCodes: [] }, reasonCodes: [], sourceBindings: [], fees: set.fees, feeCoverage: set.feeCoverage })) invalid('Invalid public fee set');
      if (set.fees.some(fee => fee.scopeId !== set.productId)) invalid('Fee set is not scoped to the declared product');
      refs.push(...set.feeCoverage.evidenceIds, ...set.fees.flatMap(fee => [...fee.evidenceIds, ...fee.conditions.flatMap(condition => condition.evidenceIds)]));
    }
  }
  if (refs.some(id => !evidence.has(id))) invalid('Public pricing has an unbound evidence reference');
  return shard;
}
