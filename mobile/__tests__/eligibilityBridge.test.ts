import fs from 'fs';
import path from 'path';
import { gzipSync, gunzipSync } from 'zlib';
import { createHash } from 'crypto';
import { downloadInflate } from '../src/data/payload';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import { eligibilityIdentity } from '../src/data/eligibilityContracts/validation';
import { eligibilityBundleIdentity } from '../src/data/eligibilityContracts/transport';
import { eligibilityTransportHarness } from '../test-support/eligibilityHarness';
import { evaluateEligibilitySelection } from '../src/data/eligibilityContracts/adapter';
import { profile } from '../test-support/executableDepositHarness';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
test('actual scoped adapter bridge retains positive, false, missing, holdout and boundary refusals', async () => {
  const h = await eligibilityTransportHarness(), blobs: Record<string, Buffer> = {};
  function asset(kind: string, value: unknown) {
    const bytes = gzipSync(Buffer.from(JSON.stringify(value), 'utf8')), sha256 = createHash('sha256').update(bytes).digest('hex');
    const name = `${kind}-${h.context.manifest.run_date}-${sha256.slice(0, 12)}.json.gz`; blobs[name] = bytes;
    return { name, bytes: bytes.length, sha256 };
  }
  for (const kind of ['core', 'details'] as const) {
    const descriptor = asset(kind, h.context[kind]);
    h.context.manifest.files[kind] = { ...descriptor, url: `https://github.com/${h.context.manifest.repo}/releases/download/${h.context.manifest.tag}/${descriptor.name}` };
    h.subject.source[kind === 'core' ? 'coreAssetSha256' : 'detailsAssetSha256'] = descriptor.sha256;
    h.asset[kind === 'core' ? 'coreAssetSha256' : 'detailsAssetSha256'] = descriptor.sha256;
    h.index[kind === 'core' ? 'core_asset_sha256' : 'details_asset_sha256'] = descriptor.sha256;
    h.shard[kind === 'core' ? 'core_asset_sha256' : 'details_asset_sha256'] = descriptor.sha256;
  }
  const normalized = normalizeCoreWithIntegrity(h.context.core, { coreSha256: h.context.manifest.files.core.sha256 }); h.context.core = normalized.core; h.context.coreIntegrity = normalized.integrity;
  bindVerifiedDetails(h.context.details, h.context.manifest.files.details.sha256);
  h.subject.id = eligibilityIdentity(h.subject, 'id'); h.asset.subjects[0].approval.subjectId = h.subject.id; h.asset.identitySha256 = eligibilityIdentity(h.asset, 'identitySha256');
  h.context.manifest.executable_v2.index = asset('executable_v2_index', h.index);
  h.context.manifest.executable_v2.shards.executable_v2_shard_000 = asset('executable_v2_shard_000', h.shard);
  const bundle = eligibilityBundleIdentity(h.context.manifest); h.context.manifest.payload_revision!.bundle_sha256 = bundle; h.context.manifest.payload_revision!.generation_id = `sha256-${bundle}`;
  (downloadInflate as jest.Mock).mockImplementation(async (url: string, sha: string, options: any) => {
    const bytes = blobs[url.slice(url.lastIndexOf('/') + 1)]; expect(bytes.length).toBe(options.expectedBytes); expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha); return gunzipSync(bytes).toString('utf8');
  });
  const [selection] = await h.load();
  const scenarios = [
    { name: 'meets', amount: '1000', expected: 'meets' },
    { name: 'does-not-meet', amount: '0', expected: 'does_not_meet' },
    { name: 'needs-information', expected: 'needs_information' },
    { name: 'independent-holdout', amount: '999.99', expected: 'does_not_meet' },
    { name: 'coverage-refusal', amount: '1000', date: '2029-01-01' },
    { name: 'unit-refusal', amount: '1000', unit: 'USD' },
    { name: 'target-refusal', amount: '1000', wrongTarget: true },
  ];
  const records = scenarios.map(c => {
    const scenario = { assessmentDate: c.date ?? '2028-01-02', values: c.amount === undefined ? {} : { scenario_amount: { type: 'decimal' as const, value: c.amount, unit: c.unit ?? 'AUD' } } };
    const target = c.wrongTarget ? { ...h.target, productKey: 'wrong-product' } : h.target;
    const rawInput = { target: { kind: target.kind, productKey: target.productKey, productRecordSha256: h.subject.source.productRecordSha256 }, scenario, profile };
    try {
      const result = evaluateEligibilitySelection(selection, h.context, target, scenario, profile);
      expect(result.eligibility.status).toBe(c.expected);
      return { name: c.name, rawInput, rawInputSha256: hashText(canonical(rawInput)), result, resultSha256: hashText(canonical(result)) };
    } catch (error) {
      if (c.expected) throw error;
      return { name: c.name, rawInput, rawInputSha256: hashText(canonical(rawInput)), refusal: error instanceof Error ? error.message : String(error), resultReturned: false };
    }
  });
  expect(records.filter(r => r.resultReturned === false)).toHaveLength(3);
  if (process.env.ELIGIBILITY_BRIDGE_OUTPUT) {
    const codePaths = ['src/data/eligibilityContracts/adapter.ts','src/data/eligibilityContracts/facts.ts','src/data/eligibilityContracts/transport.ts','src/data/eligibilityContracts/validation.ts','src/data/eligibilityContracts/schemaValidation.ts','src/lib/productTermsEngine/eligibility.ts'];
    const code = codePaths.map(file => ({ path: `mobile/${file}`, sha256: hashText(fs.readFileSync(path.resolve(file), 'utf8')) }));
    const bridge = { schemaVersion: 1, purpose: 'Engineering adapter protocol only; no bank approval', recordedAt: new Date().toISOString(), sourceHead: process.env.ELIGIBILITY_BRIDGE_HEAD, sourceState: process.env.ELIGIBILITY_BRIDGE_HEAD ? 'committed head; see retained source closure' : 'test execution', entrypoint: 'mobile/src/data/eligibilityContracts/adapter.ts#evaluateEligibilitySelection', codeIdentityScope: 'listed entrypoint files; companion closure manifest binds full local source', code, assets: Object.entries(blobs).map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })), context: h.context, target: { kind: h.target.kind, productKey: h.target.productKey }, selection, index: h.index, shard: h.shard, records };
    for (const [name, bytes] of Object.entries(blobs)) fs.writeFileSync(path.join(path.dirname(process.env.ELIGIBILITY_BRIDGE_OUTPUT), name), bytes, { flag: 'wx' });
    fs.writeFileSync(process.env.ELIGIBILITY_BRIDGE_OUTPUT, JSON.stringify(bridge, null, 2), { encoding: 'utf8', flag: 'wx' });
  }
});
