import original from '../__tests__/fixtures/monetary-v3-technical-freeze.json';
import { eligibilityTransportHarness } from './eligibilityHarness';
import { monetaryIdentity } from '../src/data/monetaryContracts/authority';
import { hashText, canonical } from '../src/lib/productTermsEngine/validation';
import { eligibilityBundleIdentity } from '../src/data/eligibilityContracts/transport';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import { loadSavingsSelections } from '../src/data/monetaryContracts/transport';
import { downloadInflate } from '../src/data/payload';
import type { SavingsSubject, MonetaryAsset } from '../src/data/monetaryContracts/types';
import type { SavingsPeriodInputs } from '../src/data/monetaryContracts/facts';
export function savingsSubject() {
  const s = structuredClone(original.subject) as SavingsSubject;
  // Frozen shape example predates semantic balance-basis posting coverage. Keep its bytes unchanged.
  for (const a of s.authorityGraph.authorities) for (const f of a.fieldCoverage) if (f.field === 'balanceBasis') f.postingEventDates = [...s.policy.postingInventory.dueDates];
  const before = s.authorityGraph.authorities[0].id; s.authorityGraph.authorities[0].id = monetaryIdentity(s.authorityGraph.authorities[0], 'id');
  for (const p of s.policy.intervals) if (p.authorityId === before) p.authorityId = s.authorityGraph.authorities[0].id;
  s.authorityGraph.identitySha256 = monetaryIdentity(s.authorityGraph, 'identitySha256'); s.id = monetaryIdentity(s, 'id'); return s;
}
export const savingsInputs: SavingsPeriodInputs = { accountId: 'local-account-1', startDate: '2026-01-01', endDateExclusive: '2026-01-11', openingBalance: '1000', confirmedAnnualRates: [{ intervalId: 'period-1', tierId: 'tier-1', annualRate: '0.0365' }], confirmedAt: '2026-01-12T01:00:00Z', openingAccrualZero: true, openingFundsCleared: true, noMovements: true, noWithholding: true };
export async function savingsHarness(prepare?: (subject: SavingsSubject) => void) {
  const h = await eligibilityTransportHarness(), s = savingsSubject(); prepare?.(s);
  delete (h.context.manifest as any).executable_v2;
  const detail = { description: 'Technical savings only; not an approved bank product' }; h.context.details.products[s.scope.productKey] = detail; bindVerifiedDetails(h.context.details, h.context.manifest.files.details.sha256);
  s.routing = { ...s.routing, productKey: s.scope.productKey, runDate: h.context.manifest.run_date, sourceGenerationId: h.context.manifest.source_observation.generation_id, exportContractSha256: h.context.manifest.source_observation.contract_digest, coreAssetSha256: h.context.manifest.files.core.sha256, detailsAssetSha256: h.context.manifest.files.details.sha256, productRecordSha256: hashText(canonical(detail)) }; s.id = monetaryIdentity(s, 'id');
  const approval = { subjectId: s.id, capability: 'savings_calculation' as const, reviewId: 'a'.repeat(64), reviewEvidenceSha256: 'a'.repeat(64), benchmarkResultSha256: 'a'.repeat(64), authorityGraphSha256: s.authorityGraph.identitySha256, reviewedAt: '2026-09-15T00:00:00Z', checks: Object.fromEntries(['source_alignment','historical_coverage','scope_coverage','input_bindings','rule_semantics','rate_schedule','material_terms','fee_coverage','posting_and_residue','benchmark'].map(k => [k, 'verified'])) };
  const asset = { schemaVersion: 3, capability: 'savings_calculation', productKey: s.scope.productKey, routing: s.routing, approvalPolicy: 'as_of_adopted_edition', identitySha256: '', subjects: [{ subject: s, approval }] } as MonetaryAsset; asset.identitySha256 = monetaryIdentity(asset, 'identitySha256');
  const descriptor = (key: string, sha: string) => ({ name: `${key}-${h.context.manifest.run_date}-${sha.slice(0,12)}.json.gz`, bytes: 1, sha256: sha });
  const manifest = { ...h.context.manifest, executable_v3: { schema_version: 3 as const, capabilities: { savings_calculation: { index: descriptor('monetary_v3_savings_calculation_index', 'b'.repeat(64)), shards: { monetary_v3_savings_calculation_shard_000: descriptor('monetary_v3_savings_calculation_shard_000', 'c'.repeat(64)) } } } } };
  const bundle = eligibilityBundleIdentity(manifest); manifest.payload_revision = { ...manifest.payload_revision!, bundle_sha256: bundle, generation_id: `sha256-${bundle}` };
  const context = { ...h.context, manifest }, target = { kind: 'product' as const, productKey: s.scope.productKey, detail };
  const common = { schema_version: 3, capability: 'savings_calculation', run_date: manifest.run_date, core_asset_sha256: manifest.files.core.sha256, details_asset_sha256: manifest.files.details.sha256 };
  const index = { ...common, products: { [s.scope.productKey]: 'monetary_v3_savings_calculation_shard_000' } }, shard = { ...common, products: { [s.scope.productKey]: asset } };
  (downloadInflate as jest.Mock).mockImplementation(async (url: string) => JSON.stringify(url.includes('_index-') ? index : shard));
  return { subject: s, asset, context, target, index, shard, load: () => loadSavingsSelections(context, target) };
}
