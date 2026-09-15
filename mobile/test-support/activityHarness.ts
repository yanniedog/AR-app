import original from '../__tests__/fixtures/activity-v4-technical.json';
import { eligibilityTransportHarness } from './eligibilityHarness';
import { monetaryIdentity } from '../src/data/monetaryContracts/authority';
import { hashText, canonical } from '../src/lib/productTermsEngine/validation';
import { eligibilityBundleIdentity } from '../src/data/eligibilityContracts/transport';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import { loadActivitySelections } from '../src/data/activityContracts/transport';
import { downloadInflate } from '../src/data/payload';
import type { ActivitySubject, ActivityAsset } from '../src/data/activityContracts/types';
import type { ActivityInputs } from '../src/data/activityContracts/types';
export function activitySubject() {
  const s = structuredClone(original.subject) as ActivitySubject;
  // Technical example predates balance-basis posting coverage; preserve imported bytes.
  for(const a of s.authorityGraph.authorities){const before=a.id;for(const f of a.fieldCoverage)if(f.field==='balanceBasis')f.postingEventDates=s.policy.postingInventory.dueDates.filter(d=>d>=f.from&&d<f.toExclusive);a.id=monetaryIdentity(a,'id');for(const p of s.policy.intervals)if(p.authorityId===before)p.authorityId=a.id;if(s.policy.bonus.assessment.authorityId===before)s.policy.bonus.assessment.authorityId=a.id;}
  s.authorityGraph.identitySha256=monetaryIdentity(s.authorityGraph,'identitySha256');
  s.scopeId = hashText(canonical(['monetary-scope-v4',s.capability,s.scope]));
  s.id = monetaryIdentity(s,'id'); return s;
}
export const activityInputs = original.privateInput as ActivityInputs;
export async function activityHarness(prepare?: (subject: ActivitySubject) => void) {
  const h = await eligibilityTransportHarness(), s = activitySubject(); prepare?.(s);
  delete (h.context.manifest as any).executable_v2;
  const detail = { displayIdentity:{productCategory:'TRANS_AND_SAVINGS_ACCOUNTS'},description: 'Technical activity only; not an approved bank product' }; h.context.details.products[s.scope.productKey] = detail; bindVerifiedDetails(h.context.details, h.context.manifest.files.details.sha256);
  s.routing = { ...s.routing, productKey: s.scope.productKey, runDate: h.context.manifest.run_date, sourceGenerationId: h.context.manifest.source_observation.generation_id, exportContractSha256: h.context.manifest.source_observation.contract_digest, coreAssetSha256: h.context.manifest.files.core.sha256, detailsAssetSha256: h.context.manifest.files.details.sha256, productRecordSha256: hashText(canonical(detail)) }; s.id = monetaryIdentity(s, 'id');
  const approval = { subjectId: s.id, capability: 'savings_activity_calculation' as const, reviewId: 'a'.repeat(64), reviewEvidenceSha256: 'a'.repeat(64), benchmarkResultSha256: 'a'.repeat(64), authorityGraphSha256: s.authorityGraph.identitySha256, reviewedAt: '2026-09-15T00:00:00Z', checks: Object.fromEntries(['source_alignment','historical_coverage','scope_coverage','input_bindings','rule_semantics','rate_schedule','material_terms','fee_coverage','posting_and_residue','benchmark'].map(k => [k, 'verified'])) };
  const asset = { schemaVersion: 4, capability: 'savings_activity_calculation', productKey: s.scope.productKey, routing: s.routing, approvalPolicy: 'as_of_adopted_edition', identitySha256: '', subjects: [{ subject: s, approval }] } as ActivityAsset; asset.identitySha256 = monetaryIdentity(asset, 'identitySha256');
  const descriptor = (key: string, sha: string) => ({ name: `${key}-${h.context.manifest.run_date}-${sha.slice(0,12)}.json.gz`, bytes: 1, sha256: sha });
  const manifest = { ...h.context.manifest, executable_v4: { schema_version: 4 as const, capabilities: { savings_activity_calculation: { index: descriptor('monetary_v4_savings_activity_calculation_index', 'b'.repeat(64)), shards: { monetary_v4_savings_activity_calculation_shard_000: descriptor('monetary_v4_savings_activity_calculation_shard_000', 'c'.repeat(64)) } } } } };
  const bundle = eligibilityBundleIdentity(manifest); manifest.payload_revision = { ...manifest.payload_revision!, bundle_sha256: bundle, generation_id: `sha256-${bundle}` };
  const context = { ...h.context, manifest }, target = { kind: 'product' as const, productKey: s.scope.productKey, detail };
  const common = { schema_version: 4, capability: 'savings_activity_calculation', run_date: manifest.run_date, core_asset_sha256: manifest.files.core.sha256, details_asset_sha256: manifest.files.details.sha256 };
  const index = { ...common, products: { [s.scope.productKey]: 'monetary_v4_savings_activity_calculation_shard_000' } }, shard = { ...common, products: { [s.scope.productKey]: asset } };
  (downloadInflate as jest.Mock).mockImplementation(async (url: string) => JSON.stringify(url.includes('_index-') ? index : shard));
  return { subject: s, asset, context, target, index, shard, load: () => loadActivitySelections(context, target) };
}
