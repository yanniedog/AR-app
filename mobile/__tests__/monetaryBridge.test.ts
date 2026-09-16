import fs from 'fs';
import path from 'path';
import { gzipSync, gunzipSync } from 'zlib';
import { createHash } from 'crypto';
import { downloadInflate } from '../src/data/payload';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import { eligibilityBundleIdentity } from '../src/data/eligibilityContracts/transport';
import { calculateSavingsPeriod } from '../src/data/monetaryContracts/adapter';
import { savingsHarness, savingsInputs } from '../test-support/savingsMonetaryHarness';
import { monetaryIdentity } from '../src/data/monetaryContracts/authority';
import { profile } from '../test-support/executableDepositHarness';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));

test('actual savings bridge retains source-bound gzip assets and local account refusals', async () => {
  const h = await savingsHarness(), blobs: Record<string, Buffer> = {}, g = h.subject.authorityGraph;
  const proof = { schemaVersion: 1, kind: 'monetary_completed_period_v1', productKey: h.target.productKey, asOf: g.completedPeriod.asOf, timezone: g.completedPeriod.timezone, completedThroughExclusive: g.completedPeriod.completedThroughExclusive, authorityIds: g.authorities.map(a => a.id).sort(), evidenceIds: [...g.completedPeriod.evidenceIds].sort() };
  const proofBytes = Buffer.from(canonical(proof), 'utf8'), proofSha = createHash('sha256').update(proofBytes).digest('hex');
  g.members.push({ sha256: proofSha, bytes: proofBytes.length, decodedBytes: proofBytes.length, encoding: 'identity', kind: 'source_document' });
  g.completedPeriod.sourceSnapshotSha256 = proofSha; g.identitySha256 = monetaryIdentity(g, 'identitySha256');
  function asset(kind: string, value: unknown) {
    const bytes = gzipSync(Buffer.from(JSON.stringify(value), 'utf8')), sha256 = createHash('sha256').update(bytes).digest('hex');
    const name = `${kind}-${h.context.manifest.run_date}-${sha256.slice(0,12)}.json.gz`; blobs[name] = bytes; return { name, bytes: bytes.length, sha256 };
  }
  for (const kind of ['core', 'details'] as const) {
    const descriptor = asset(kind, h.context[kind]); h.context.manifest.files[kind] = { ...descriptor, url: `https://github.com/${h.context.manifest.repo}/releases/download/${h.context.manifest.tag}/${descriptor.name}` };
    h.subject.routing[kind === 'core' ? 'coreAssetSha256' : 'detailsAssetSha256'] = descriptor.sha256;
    h.index[kind === 'core' ? 'core_asset_sha256' : 'details_asset_sha256'] = descriptor.sha256; h.shard[kind === 'core' ? 'core_asset_sha256' : 'details_asset_sha256'] = descriptor.sha256;
  }
  const normalized = normalizeCoreWithIntegrity(h.context.core, { coreSha256: h.context.manifest.files.core.sha256 }); h.context.core = normalized.core; h.context.coreIntegrity = normalized.integrity;
  bindVerifiedDetails(h.context.details, h.context.manifest.files.details.sha256);
  h.subject.id = monetaryIdentity(h.subject, 'id'); h.asset.subjects[0].approval.subjectId = h.subject.id; h.asset.subjects[0].approval.authorityGraphSha256 = g.identitySha256; h.asset.identitySha256 = monetaryIdentity(h.asset, 'identitySha256');
  const route = h.context.manifest.executable_v3.capabilities.savings_calculation;
  route.index = asset('monetary_v3_savings_calculation_index', h.index); route.shards.monetary_v3_savings_calculation_shard_000 = asset('monetary_v3_savings_calculation_shard_000', h.shard);
  const bundle = eligibilityBundleIdentity(h.context.manifest); h.context.manifest.payload_revision!.bundle_sha256 = bundle; h.context.manifest.payload_revision!.generation_id = `sha256-${bundle}`;
  (downloadInflate as jest.Mock).mockImplementation(async (url: string, sha: string, options: any) => { const bytes = blobs[url.slice(url.lastIndexOf('/')+1)]; expect(bytes.length).toBe(options.expectedBytes); expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha); return gunzipSync(bytes).toString('utf8'); });
  const [selection] = await h.load();
  const cases = [ { name: 'positive', changes: {} }, { name: 'holdout', changes: { openingBalance: '2345.67' } }, { name: 'rate-refusal', changes: { confirmedAnnualRates: [{ intervalId: 'period-1', tierId: 'tier-1', annualRate: '0.03' }] } }, { name: 'cleared-refusal', changes: { openingFundsCleared: null } }, { name: 'period-refusal', changes: { endDateExclusive: '2026-01-12' } }, { name: 'target-refusal', changes: {} } ];
  const records = cases.map(c => {
    const target = c.name === 'target-refusal' ? { ...h.target, productKey: 'wrong-product' } : h.target;
    const inputs = { ...savingsInputs, ...c.changes }, rawInput = { target: { kind: target.kind, productKey: target.productKey, productRecordSha256: h.subject.routing.productRecordSha256 }, inputs, profile };
    try { const result = calculateSavingsPeriod(selection, h.context, target, inputs, profile); expect(c.name.endsWith('refusal')).toBe(false); return { name: c.name, rawInput, rawInputSha256: hashText(canonical(rawInput)), result, resultSha256: hashText(canonical(result)) }; }
    catch (e) { if (!c.name.endsWith('refusal')) throw e; return { name: c.name, rawInput, rawInputSha256: hashText(canonical(rawInput)), refusal: e instanceof Error ? e.message : String(e), resultReturned: false }; }
  });
  expect(records.filter(r => r.resultReturned === false)).toHaveLength(4);
  if (process.env.MONETARY_BRIDGE_OUTPUT) {
    const code = ['src/data/monetaryContracts/adapter.ts','src/data/monetaryContracts/transport.ts','src/data/monetaryContracts/validation.ts','src/data/monetaryContracts/authority.ts','src/lib/productTermsEngine/ledger.ts'].map(file => ({ path: `mobile/${file}`, sha256: hashText(fs.readFileSync(path.resolve(file), 'utf8')) }));
    const bridge = { schemaVersion: 1, purpose: 'Engineering only; no bank approval or raw historical verification by app', recordedAt: new Date().toISOString(), sourceHead: process.env.MONETARY_BRIDGE_HEAD ?? null, sourceState: process.env.MONETARY_BRIDGE_HEAD ? 'committed' : 'uncommitted implementation; exact listed source hashes', entrypoint: 'mobile/src/data/monetaryContracts/adapter.ts#calculateSavingsPeriod', code, context: h.context, target: { kind: h.target.kind, productKey: h.target.productKey }, selection, index: h.index, shard: h.shard, assets: Object.entries(blobs).map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })), records };
    for (const [name, bytes] of Object.entries(blobs)) fs.writeFileSync(path.join(path.dirname(process.env.MONETARY_BRIDGE_OUTPUT), name), bytes, { flag: 'wx' });
    fs.writeFileSync(path.join(path.dirname(process.env.MONETARY_BRIDGE_OUTPUT), 'private-completion-proof.json'), proofBytes, { flag: 'wx' });
    fs.writeFileSync(process.env.MONETARY_BRIDGE_OUTPUT, JSON.stringify(bridge, null, 2), { flag: 'wx', encoding: 'utf8' });
  }
});
