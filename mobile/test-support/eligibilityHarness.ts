import { eligibilityBundleIdentity, loadEligibilitySelections } from '../src/data/eligibilityContracts/transport';
import { downloadInflate } from '../src/data/payload';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import { rateConditionFixture } from '../testUtils/rateConditions';
import original from '../__tests__/fixtures/executable-template-identity-v1.json';
import type { EligibilityAsset, EligibilitySubject } from '../src/data/eligibilityContracts/types';
import { eligibilityIdentity, eligibilityScopeId } from '../src/data/eligibilityContracts/validation';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
const sha = 'a'.repeat(64), clause = original.template.evidence[0].id;
/** Engineering protocol only: no bank/current approval or business acceptance. */
export function eligibilitySubject(change?: (subject: EligibilitySubject) => void): EligibilitySubject {
  const scope: EligibilitySubject['scope'] = { productKey: 'protocol-eligibility', family: 'Mortgage', cohortKey: 'protocol-cohort', tierKey: 'protocol-tier', packageKey: 'none_source_declared', effectiveFrom: '2028-01-01', effectiveToExclusive: '2029-01-01', effectiveScope: 'assessment_date', intervalBasis: 'reviewed_assessment_coverage', coverage: 'product', rateIndexes: [] };
  const subject: EligibilitySubject = { schemaVersion: 2, kind: 'scoped_eligibility_v1', capability: 'eligibility_only', adapterVersion: 'scoped-eligibility-v1', evaluatorVersion: 'product-terms-engine-v8', id: '', scopeId: '', scope,
    source: { observationId: sha, sourceSha256: sha, generationId: 'protocol-generation', exportContractSha256: sha, runDate: '2028-01-01', provenanceManifestSha256: sha, coreAssetSha256: sha, detailsAssetSha256: sha, productRecordSha256: hashText(canonical({ description: 'Engineering protocol only' })), rateRows: [], documentVersionIds: original.template.documentVersionIds, termRevisionIds: original.template.termRevisionIds },
    inputDefinitions: [{ key: 'assessment', label: 'Assessment date', type: 'date', unit: null, binding: 'assessment_date', clauseIds: [clause] }, { key: 'amount', label: 'Selected amount', type: 'decimal', unit: 'AUD', binding: 'scenario_amount', clauseIds: [clause] }],
    eligibility: { id: 'amount-minimum', op: 'compare', field: 'amount', comparison: 'gte', expected: { type: 'decimal', value: '1000', unit: 'AUD' }, evidenceIds: [clause] },
    fieldClauseIds: { product: [clause], family: [clause], cohort: [clause], tier: [clause], package: [clause], effectiveInterval: [clause], effectiveScope: [clause], coverage: [clause], eligibility: [clause] }, evidence: original.template.evidence,
  };
  change?.(subject); subject.scopeId = eligibilityScopeId(subject.scope); subject.id = eligibilityIdentity(subject, 'id'); return subject;
}
export function eligibilityAsset(subject = eligibilitySubject()): EligibilityAsset {
  const asset: EligibilityAsset = { schemaVersion: 2, productKey: subject.scope.productKey, sourceObservationId: subject.source.observationId, sourceGenerationId: subject.source.generationId, runDate: subject.source.runDate, coreAssetSha256: subject.source.coreAssetSha256, detailsAssetSha256: subject.source.detailsAssetSha256, approvalPolicy: 'as_of_adopted_edition', identitySha256: '', subjects: [{ subject, approval: { subjectId: subject.id, capability: 'eligibility_only', reviewId: sha, reviewEvidenceSha256: sha, benchmarkResultSha256: sha, sourceSnapshotSha256: sha, reviewedAt: '2028-01-01T00:00:00Z', checks: { source_alignment: 'verified', scope_coverage: 'verified', input_bindings: 'verified', rule_semantics: 'verified', variant_binding: 'verified' } } }] };
  asset.identitySha256 = eligibilityIdentity(asset, 'identitySha256'); return asset;
}

export async function eligibilityTransportHarness(change?: (subject: EligibilitySubject) => void) {
  const f = rateConditionFixture(), subject = eligibilitySubject(change);
  subject.source.runDate = f.core.run_date; subject.source.coreAssetSha256 = f.manifest.files.core.sha256; subject.source.detailsAssetSha256 = f.manifest.files.details.sha256;
  const detail = { description: 'Engineering protocol only', displayIdentity: { productCategory: subject.scope.family === 'Mortgage' ? 'RESIDENTIAL_MORTGAGES' : subject.scope.family === 'TD' ? 'TERM_DEPOSITS' : 'TRANS_AND_SAVINGS_ACCOUNTS' } };
  f.details.products[subject.scope.productKey] = detail; bindVerifiedDetails(f.details, f.manifest.files.details.sha256);
  subject.source.productRecordSha256 = hashText(canonical(detail)); subject.id = eligibilityIdentity(subject, 'id');
  const asset = eligibilityAsset(subject);
  const descriptor = (key: string, value: string) => ({ name: `${key}-${f.manifest.run_date}-${value.slice(0, 12)}.json.gz`, bytes: 1, sha256: value });
  const manifest = { ...f.manifest, tag: `app-payload-${f.manifest.run_date}-r000001`, source_observation: { generation_id: subject.source.generationId, contract_digest: subject.source.exportContractSha256 }, executable_v2: { schema_version: 2 as const, index: descriptor('executable_v2_index', 'b'.repeat(64)), shards: { executable_v2_shard_000: descriptor('executable_v2_shard_000', 'c'.repeat(64)) } } };
  const bundle = eligibilityBundleIdentity(manifest); manifest.payload_revision = { ...manifest.payload_revision!, bundle_sha256: bundle, generation_id: `sha256-${bundle}` };
  const context = { manifest, core: f.core, coreIntegrity: f.coreIntegrity, details: f.details }, target = { kind: 'product' as const, productKey: subject.scope.productKey, detail };
  const common = { schema_version: 2, run_date: manifest.run_date, core_asset_sha256: manifest.files.core.sha256, details_asset_sha256: manifest.files.details.sha256 };
  const index = { ...common, products: { [subject.scope.productKey]: 'executable_v2_shard_000' } }, shard = { ...common, products: { [subject.scope.productKey]: asset } };
  (downloadInflate as jest.Mock).mockImplementation(async (url: string) => JSON.stringify(url.includes('executable_v2_index-') ? index : shard));
  return { context, target, subject, asset, index, shard, load: () => loadEligibilitySelections(context, target) };
}
