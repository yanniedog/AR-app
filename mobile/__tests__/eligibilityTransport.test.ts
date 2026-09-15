import bundleFixture from './fixtures/executable-eligibility-bundle-v2.json';
import type { Manifest } from '../src/types';
import { eligibilityTransportHarness } from '../test-support/eligibilityHarness';
import { eligibilityBundleIdentity, loadEligibilitySelections } from '../src/data/eligibilityContracts/transport';
import { evaluateEligibilitySelection } from '../src/data/eligibilityContracts/adapter';
import { profile } from '../test-support/executableDepositHarness';
import { downloadInflate } from '../src/data/payload';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
import { eligibilityScopeId, eligibilityIdentity } from '../src/data/eligibilityContracts/validation';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
beforeEach(() => (downloadInflate as jest.Mock).mockReset());
const scenario = (value?: string) => ({ assessmentDate: '2028-01-02', values: value === undefined ? {} : { scenario_amount: { type: 'decimal' as const, value, unit: 'AUD' } } });
test('actual lazy transport binds details-only product and returns exact three-valued local receipts', async () => {
  const h = await eligibilityTransportHarness(); expect(downloadInflate).not.toHaveBeenCalled();
  const [selected] = await h.load(); expect(downloadInflate).toHaveBeenCalledTimes(2);
  for (const [amount, status] of [['1000', 'meets'], ['0', 'does_not_meet'], [undefined, 'needs_information']] as const) {
    const result = evaluateEligibilitySelection(selected, h.context, h.target, scenario(amount), profile);
    expect(result.eligibility.status).toBe(status); expect(hashText(canonical(result.evaluationInputs))).toBe(result.inputSha256);
    expect(result.evaluationKind).toBe('eligibility_only'); expect(result).not.toHaveProperty('totals'); expect(result).not.toHaveProperty('claimAvailable');
  }
  expect(Object.keys(h.context.manifest.files).some(key => key.startsWith('executable_v2'))).toBe(false);
});
test('missing optional namespace makes zero capability requests; invalid namespace cannot change core or downgrade', async () => {
  const h = await eligibilityTransportHarness(), core = h.context.core;
  const m = { ...h.context.manifest }; delete (m as any).executable_v2;
  expect(await loadEligibilitySelections({ ...h.context, manifest: m }, h.target)).toEqual([]); expect(downloadInflate).not.toHaveBeenCalled();
  h.context.manifest.executable_v2.schema_version = 3 as any;
  await expect(h.load()).rejects.toThrow(); expect(downloadInflate).not.toHaveBeenCalled(); expect(h.context.core).toBe(core);
});
test('forged handle, detached details, changed edition/removal, and out-of-coverage date refuse', async () => {
  const h = await eligibilityTransportHarness(), [selected] = await h.load();
  expect(() => evaluateEligibilitySelection({ ...selected }, h.context, h.target, scenario('1000'), profile)).toThrow();
  await expect(loadEligibilitySelections({ ...h.context, details: { ...h.context.details } }, h.target)).rejects.toThrow();
  expect(() => evaluateEligibilitySelection(selected, { ...h.context, manifest: { ...h.context.manifest } }, h.target, scenario('1000'), profile)).toThrow();
  expect(() => evaluateEligibilitySelection(selected, h.context, h.target, { ...scenario('1000'), assessmentDate: '2029-01-01' }, profile)).toThrow();
  delete (h.context.manifest as any).executable_v2;
  expect(() => evaluateEligibilitySelection(selected, h.context, h.target, scenario('1000'), profile)).toThrow();
});
test.each(['filename','unused shard','record','approval','shard date'])('rejects %s mismatch without fallback', async kind => {
  const h = await eligibilityTransportHarness();
  if (kind === 'filename') h.context.manifest.executable_v2.index.name = h.context.manifest.files.core.name;
  if (kind === 'unused shard') (h.context.manifest.executable_v2.shards as any).executable_v2_shard_001 = { ...h.context.manifest.executable_v2.shards.executable_v2_shard_000, name: `executable_v2_shard_001-${h.context.manifest.run_date}-${'c'.repeat(12)}.json.gz` };
  if (kind === 'record') { h.subject.source.productRecordSha256 = 'f'.repeat(64); h.subject.id = eligibilityIdentity(h.subject, 'id'); h.asset.subjects[0].approval.subjectId = h.subject.id; h.asset.identitySha256 = eligibilityIdentity(h.asset, 'identitySha256'); }
  if (kind === 'approval') { h.asset.subjects[0].approval.subjectId = 'f'.repeat(64); h.asset.identitySha256 = eligibilityIdentity(h.asset, 'identitySha256'); }
  if (kind === 'shard date') h.shard.run_date = '2026-09-14';
  await expect(h.load()).rejects.toThrow();
});

test.each(['rolling tag', 'unsafe revision', 'bad bundle', 'blank generation', 'combined budget', 'misplaced absent namespace'])('refuses %s before capability requests', async kind => {
  const h = await eligibilityTransportHarness(), m = h.context.manifest;
  if (kind === 'rolling tag') m.tag = 'app-payload-latest';
  if (kind === 'unsafe revision') m.payload_revision!.revision = Number.MAX_SAFE_INTEGER + 1;
  if (kind === 'bad bundle') m.payload_revision!.bundle_sha256 = 'bad';
  if (kind === 'blank generation') m.payload_revision!.generation_id = '';
  if (kind === 'combined budget') m.files.core = { ...m.files.core, bytes: 8 * 1024 * 1024 - 1 };
  if (kind === 'misplaced absent namespace') { (m.files as any).executable_v2_index = m.executable_v2.index; delete (m as any).executable_v2; }
  await expect(h.load()).rejects.toThrow(); expect(downloadInflate).not.toHaveBeenCalled();
});

test.each(['Mortgage','Savings'] as const)('binds exact %s variant without fabricating a rate-free row', async family => {
  const h = await eligibilityTransportHarness();
  const row = { ...h.context.core.sections.TD.rates[0], product_key: h.target.productKey, rate_index: 1 };
  h.context.core.sections[family].rates.push(row);
  h.subject.scope.family = family; h.subject.scope.coverage = 'rate_variants'; h.subject.scope.rateIndexes = [1];
  h.subject.source.rateRows = [{ coreRowIndex: 0, rateIndex: 1, rowSha256: hashText(canonical(row)) }];
  h.subject.scopeId = eligibilityScopeId(h.subject.scope); h.subject.id = eligibilityIdentity(h.subject, 'id');
  h.asset.subjects[0].approval.subjectId = h.subject.id; h.asset.identitySha256 = eligibilityIdentity(h.asset, 'identitySha256');
  const target = { kind: 'rate_variant' as const, productKey: h.target.productKey, detail: h.target.detail, section: family, row };
  const [selected] = await loadEligibilitySelections(h.context, target);
  expect(evaluateEligibilitySelection(selected, h.context, target, scenario('1000'), profile).evaluationInputs.target).toMatchObject({ kind: 'rate_variant', section: family, coreRowIndex: 0, rateIndex: 1 });
  expect(await h.load()).toEqual([]);
  expect(() => evaluateEligibilitySelection(selected, h.context, { ...target, row: { ...row } }, scenario('1000'), profile)).toThrow();
});


test('matches independent Python bundle vector while binding namespace and ignoring only transport envelope', () => {
  const m = bundleFixture.manifest as unknown as Manifest;
  expect(eligibilityBundleIdentity(m)).toBe(bundleFixture.expectedBundleSha256);
  expect(eligibilityBundleIdentity({ ...m, tag: 'not-authority-for-hash', generated_at: 'changed' })).toBe(bundleFixture.expectedBundleSha256);
  const changed = structuredClone(m); changed.executable_v2!.index.bytes += 1;
  expect(eligibilityBundleIdentity(changed)).not.toBe(bundleFixture.expectedBundleSha256);
});
