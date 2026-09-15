import fixture from '../__tests__/fixtures/executable-template-identity-v1.json';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
import { loadExecutableSelections, type ContractContext } from '../src/data/executableContracts/transport';
import type { ExecutableAsset, ExecutableTemplate } from '../src/data/executableContracts/types';
import type { CustomerProfile } from '../src/data/customerProfile';
import type { Manifest, RateRow, CorePayload } from '../src/types';
import { downloadInflate } from '../src/data/payload';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { identity } from '../src/data/executableContracts/validation';

const download = downloadInflate as jest.MockedFunction<typeof downloadInflate>;
const sha = 'a'.repeat(64);
export const profile: CustomerProfile = { version: 1, revision: 0, answers: {}, definitions: {}, negotiatedTerms: [], legacyScenario: null };
export function setup(change?: (t: ExecutableTemplate) => void) {
  const t = structuredClone({ ...fixture.template, id: fixture.expectedId }) as ExecutableTemplate;
  t.annualRate = '0.0365'; t.term = { unit: 'months', count: 1, monthConvention: 'clamp' }; t.effectiveFrom = '2028-01-01'; t.effectiveToExclusive = '2029-01-01';
  change?.(t);
  const row = { product_key: t.productKey, product_id: 'protocol', provider: 'Protocol mechanics only', product_name: 'Technical test', rate: t.annualRate, rate_type: 'FIXED', term: `P${t.term.count}${t.term.unit === 'days' ? 'D' : 'M'}`, rate_index: 1 } as RateRow;
  if ('value' in t.principalBounds.minimum) row.balance_min = t.principalBounds.minimum.value;
  if ('value' in t.principalBounds.maximum) row.balance_max = t.principalBounds.maximum.value;
  t.selectedRate.rowSha256 = hashText(canonical(row)); t.selectedRate.coreAssetSha256 = sha; t.id = identity(t, 'id');
  const asset: ExecutableAsset = { schemaVersion: 1, productKey: t.productKey, sourceGenerationId: t.sourceGenerationId, runDate: t.runDate, coreAssetSha256: sha, approvalPolicy: 'as_of_adopted_edition', identitySha256: '', templates: [{ template: t, approval: { templateId: t.id, reviewId: sha, reviewEvidenceSha256: sha, benchmarkResultSha256: sha, reviewedAt: '2028-01-01T00:00:00Z', review: { applicability: 'verified', materialTerms: 'verified', feeCoverage: 'verified', rateSchedule: 'verified' } } }] }; asset.identitySha256 = identity(asset, 'identitySha256');
  const descriptor = (name: string) => ({ name, bytes: 1, sha256: sha, url: `https://github.com/yanniedog/AR-local/releases/download/protocol/${name}` });
  const manifest = { repo: 'yanniedog/AR-local', tag: 'protocol', run_date: t.runDate, payload_revision: { generation_id: 'different-repackaging', bundle_sha256: sha }, source_observation: { generation_id: t.sourceGenerationId }, files: { core: descriptor('core.gz'), details: descriptor('details.gz'), executable_index: descriptor('index.gz'), executable_shard_000: descriptor('shard.gz') } } as unknown as Manifest;
  const { core, integrity } = normalizeCoreWithIntegrity({ schema_version: 1, run_date: t.runDate, sections: { TD: { rates: [row] }, Mortgage: { rates: [] }, Savings: { rates: [] } } } as unknown as CorePayload, { coreSha256: sha });
  const context: ContractContext = { manifest, core, coreIntegrity: integrity };
  const envelope = { schema_version: 1, run_date: t.runDate, core_asset_sha256: sha };
  const load = async () => { download.mockResolvedValueOnce(JSON.stringify({ ...envelope, products: { [t.productKey]: 'executable_shard_000' } })).mockResolvedValueOnce(JSON.stringify({ ...envelope, products: { [t.productKey]: asset } })); return (await loadExecutableSelections(context, row))[0]; };
  return { t, row, context, asset, load };
}
export const inputs = { principal: '1000', fundedDate: '2028-01-31', maturityDate: '2028-02-29', confirmed: true, confirmedAt: '2028-01-30T00:00:00Z', noWithholdingConfirmed: true };
