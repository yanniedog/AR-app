import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
import { setup, inputs, profile } from '../test-support/executableDepositHarness';
import fixture from './fixtures/executable-template-identity-v1.json';
import { identity, validateTemplate } from '../src/data/executableContracts/validation';
import { calculateDeposit, instantiateDeposit, depositInputRequirements } from '../src/data/executableContracts/instantiate';
import type { CustomerProfile } from '../src/data/customerProfile';
import { downloadInflate } from '../src/data/payload';
import { calculateLedger } from '../src/lib/productTermsEngine/ledger';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
const download = downloadInflate as jest.MockedFunction<typeof downloadInflate>;
beforeEach(() => download.mockReset());
test('frozen Unicode and exact decimal identity agrees with producer', () => {
  expect(identity(fixture.template, 'id')).toBe(fixture.expectedId);
  expect(validateTemplate({ ...fixture.template, id: fixture.expectedId }).annualRate).toBe('0.0500');
});
test('verified wire reaches v7 maturity ledger: leap month earns2.90, no maturity accrual, closes with1002.90', async () => {
  const x = setup(), selected = await x.load(); const result = calculateDeposit(selected, x.context, x.row, inputs, profile).receipt;
  expect(result.issues).toEqual([]); expect(result.claimAvailable).toBe(true);
  expect(result.totals).toMatchObject({ interestPosted: '2.90', externalOutflows: '1002.90', closingBalance: '0.00', interestUnposted: '0.000000000000' });
  expect(result.ledger.filter(r => r.type === 'interest_accrual')).toHaveLength(29);
  expect(result.ledger.find(r => r.id === 'td:closure')?.date).toBe(inputs.maturityDate);
  expect(download.mock.calls.every(args => !JSON.stringify(args).includes('1000'))).toBe(true);
});
test('unknown approval, copied row, changed edition and template mutation cannot authorize calculations', async () => {
  const x = setup(), selected = await x.load();
  expect(() => calculateDeposit({ ...selected }, x.context, x.row, inputs, profile)).toThrow('approval');
  expect(() => calculateDeposit(selected, x.context, { ...x.row }, inputs, profile)).toThrow('publication');
  const changed = { ...x.context, manifest: { ...x.context.manifest!, files: { ...x.context.manifest!.files, executable_index: undefined } } };
  delete (changed.manifest.files as any).executable_index;
  expect(() => calculateDeposit(selected, changed, x.row, inputs, profile)).toThrow('approval');
  selected.template.annualRate = '0.9'; expect(() => calculateDeposit(selected, x.context, x.row, inputs, profile)).toThrow('approval');
});
test('scenario principal defeats stale profile value and missing confirmations remain unavailable', async () => {
  const x = setup(t => { if (t.eligibility.op !== 'compare') throw new Error(); t.eligibility.expected = { type: 'decimal', value: '5000', unit: 'AUD' }; t.eligibility.comparison = 'gte'; });
  const selected = await x.load(), stale = { ...profile, answers: { protocol_amount: { state: 'known', fact: { type: 'decimal', value: '10000', unit: 'AUD' }, provenance: { productKey: x.t.productKey, source: 'user_input', recordedAt: '2028-01-01T00:00:00Z', effectiveFrom: null, effectiveToExclusive: null } } } } as CustomerProfile;
  expect(calculateDeposit(selected, x.context, x.row, inputs, stale).receipt.eligibility?.status).toBe('does_not_meet');
  expect(() => calculateDeposit(selected, x.context, x.row, { ...inputs, confirmed: false }, profile)).toThrow('Confirm');
  expect(() => calculateDeposit(selected, x.context, x.row, { ...inputs, maturityDate: '2028-03-01' }, profile)).toThrow('maturity');
});
test.each([[2, 'half_up', '0.10'], [2, 'half_even', '0.00'], [null, 'half_up', '0.05']] as const)('source daily rounding %s/%s yields%s', async (scale, mode, expected) => {
  const x = setup(t => { t.term = { unit: 'days', count: 10, monthConvention: 'clamp' }; t.annualRate = '0.01825'; t.interest.dailyAccrualScale = scale; t.interest.accrualRounding = mode; });
  const selected = await x.load(), result = calculateDeposit(selected, x.context, x.row, { ...inputs, confirmedAnnualRate: '0.01825', principal: '100', fundedDate: '2028-02-01', maturityDate: '2028-02-11' }, profile).receipt;
  expect(result.totals?.interestPosted).toBe(expected); expect(result.totals?.closingBalance).toBe('0.00');
});
test('new mode rejects v6 and future versions while source policy/fee omissions fail closed', async () => {
  const x = setup(), selected = await x.load(), pair = instantiateDeposit(selected, x.context, x.row, inputs, profile);
  pair.contract.evaluatorVersion = 'product-terms-engine-v6'; expect(calculateLedger(pair.contract, pair.scenario).issues).toContain('td_confirmation_version_unsupported');
  delete pair.scenario.tdConfirmation; expect(calculateLedger(pair.contract, pair.scenario).issues).toContain('td_fixed_maturity_policy_unsupported');
  (pair.contract as any).evaluatorVersion = 'product-terms-engine-v99'; expect(calculateLedger(pair.contract, pair.scenario).issues).toContain('contract_version_unsupported');
  for (const field of ['posting', 'businessDayAdjustment', 'feeDisposition']) { const t = structuredClone(x.t); delete (t.policies as any)[field]; t.id = identity(t, 'id'); expect(() => validateTemplate(t)).toThrow(); }
});

test('actual amount obeys reviewed selected-row bounds independently of a permissive eligibility rule', async () => {
  const x = setup(t => { t.principalBounds = { minimum: { value: '5000', inclusive: true }, maximum: { value: '10000', inclusive: false } }; });
  const selected = await x.load();
  expect(() => calculateDeposit(selected, x.context, x.row, inputs, profile)).toThrow('outside the reviewed rate tier');
  expect(calculateDeposit(selected, x.context, x.row, { ...inputs, principal: '5000' }, profile).receipt.claimAvailable).toBe(true);
  expect(() => calculateDeposit(selected, x.context, x.row, { ...inputs, principal: '10000' }, profile)).toThrow('outside the reviewed rate tier');
  const mismatch = setup(); mismatch.row.balance_min = '5000'; mismatch.t.selectedRate.rowSha256 = hashText(canonical(mismatch.row)); mismatch.t.id = identity(mismatch.t, 'id'); mismatch.asset.templates[0].approval.templateId = mismatch.t.id; mismatch.asset.identitySha256 = identity(mismatch.asset, 'identitySha256');
  await expect(mismatch.load()).rejects.toThrow('principal bounds');
});
test('source effective scope checks economic accrual and user confirmation is never bank clause evidence', async () => {
  const x = setup(t => { t.effectiveScope = 'funded_date'; t.effectiveToExclusive = '2028-02-01'; });
  const selected = await x.load(), r = calculateDeposit(selected, x.context, x.row, inputs, profile);
  expect(r.receipt.claimAvailable).toBe(true); expect(r.receipt.localTdConfirmation?.source).toBe('user_supplied_bank_confirmation');
  expect(r.calculationInputs.contract.tdLifecycle?.confirmationEvidenceIds).toEqual([]);
  const other = setup(t => { t.effectiveToExclusive = '2028-02-01'; }); const otherSelection = await other.load();
  expect(() => calculateDeposit(otherSelection, other.context, other.row, inputs, profile)).toThrow('source interval');
});
test('customer questions follow decisive branches and preserve explicit unavailable answers', async () => {
  const x = setup(t => {
    t.inputDefinitions.push({ key: 'resident', binding: 'customer_fact', label: 'Resident', type: 'boolean', unit: null, clauseIds: t.fieldClauseIds.eligibility });
    t.eligibility = { id: 'choice', op: 'or', rules: [t.eligibility, { id: 'resident_rule', op: 'compare', field: 'resident', comparison: 'eq', expected: { type: 'boolean', value: true }, evidenceIds: t.fieldClauseIds.eligibility }] };
  });
  const selected = await x.load(); expect(depositInputRequirements(selected, inputs, profile).needed).toEqual([]);
  const missing = { ...inputs, principal: '' }, key = `td_${x.t.id}_resident`;
  expect(depositInputRequirements(selected, missing, profile).needed.map(d => d.label)).toEqual(['Resident']);
  const saved: CustomerProfile = { ...profile, answers: { [key]: { state: 'unavailable', provenance: { source: 'user_input', recordedAt: null, productKey: x.t.productKey, effectiveFrom: null, effectiveToExclusive: null } } } };
  expect(depositInputRequirements(selected, missing, saved).needed).toEqual([]); expect(depositInputRequirements(selected, missing, saved).deferred).toHaveLength(1); expect(depositInputRequirements(selected, missing, saved).saved).toHaveLength(1);
});

test('cross-runtime bridge records actual adapter and evaluator positive/refusal receipts', async () => {
  const x = setup(), selected = await x.load(), positive = calculateDeposit(selected, x.context, x.row, inputs, profile);
  const changed = structuredClone(positive.calculationInputs); changed.scenario.tdConfirmation!.annualRate = '0.03';
  const refusal = calculateLedger(changed.contract, changed.scenario);
  expect(positive.receipt.claimAvailable).toBe(true); expect(refusal.claimAvailable).toBe(false); expect(refusal.totals).toBeNull();
  const directory = process.env.AR_EXECUTABLE_BRIDGE_DIR;
  if (directory) {
    const evaluatorVersion = 'product-terms-engine-v8';
    const records = [
      { name: 'positive', template: selected.template, approval: selected.approval, localInput: inputs, instantiatedInput: { evaluatorVersion, ...positive.calculationInputs }, output: positive.receipt },
      { name: 'refusal', template: selected.template, approval: selected.approval, localInput: { ...inputs, confirmedAnnualRate: '0.03' }, instantiatedInput: { evaluatorVersion, ...changed }, output: refusal },
    ].map(record => ({ ...record, inputCanonicalSha256: hashText(canonical(record.instantiatedInput)), outputCanonicalSha256: hashText(canonical(record.output)) }));
    const files = ['src/data/executableContracts/instantiate.ts', 'src/data/executableContracts/validation.ts', 'src/data/executableContracts/transport.ts', 'src/lib/productTermsEngine/types.ts', 'src/lib/productTermsEngine/tdValidation.ts', 'src/lib/productTermsEngine/tdLedger.ts', 'src/lib/productTermsEngine/ledger.ts', 'src/lib/productTermsEngine/decimal.ts', 'src/lib/productTermsEngine/calendar.ts', 'src/data/executableContracts/depositComparison.ts'];
    const code = files.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(process.cwd(), file))).digest('hex') }));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'actual-v8-bridge.json'), JSON.stringify({ purpose: 'Technical protocol bridge only. No real product or bank approval.', schemaVersion: 1, adapterVersion: 'fixed-aud-td-v1', evaluatorVersion, code, records }, null, 2) + '\n', 'utf8');
  }
});


test('v8 requires reported actual rate; equivalent fractions bind receipt, mismatch and precision refuse', async () => {
  const x = setup(), selected = await x.load();
  const r = calculateDeposit(selected, x.context, x.row, { ...inputs, confirmedAnnualRate: '0.036500' }, profile);
  expect(r.receipt.localTdConfirmation?.annualRate).toBe('0.036500');
  for (const rate of ['', '0.03', 'NaN', '3.65e-2', '0.0365000000000']) expect(() => calculateDeposit(selected, x.context, x.row, { ...inputs, confirmedAnnualRate: rate }, profile)).toThrow();
  const pair = r.calculationInputs; delete pair.scenario.tdConfirmation!.annualRate;
  expect(calculateLedger(pair.contract, pair.scenario).issues).toContain('td_confirmed_rate_mismatch');
  pair.contract.evaluatorVersion = 'product-terms-engine-v7';
  expect(calculateLedger(pair.contract, pair.scenario).totals?.externalOutflows).toBe('1002.90');
  const old = setup(t => { t.evaluatorVersion = 'product-terms-engine-v7'; });
  const legacy = await old.load();
  expect(() => calculateDeposit(legacy, old.context, old.row, inputs, profile)).toThrow('rate-confirmation');
});


test('frozen actual v7 bridge replays unchanged financial results under the v8 runner identity', () => {
  const bridge = require('./fixtures/executable-deposit-v7-bridge.json');
  expect(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'fixtures/executable-deposit-v7-bridge.json'))).digest('hex')).toBe('6907314df8f7e6ca443143c55aedce3127aa9bd69e636b085da9c30af635d777');
  for (const record of bridge.records) {
    const result = calculateLedger(record.instantiatedInput.contract, record.instantiatedInput.scenario);
    const { evaluatorVersion: oldVersion, inputSha256: oldHash, ...financial } = record.output;
    const { evaluatorVersion, inputSha256, ...replayed } = result;
    expect(oldVersion).toBe('product-terms-engine-v7'); expect(evaluatorVersion).toBe('product-terms-engine-v8');
    expect(inputSha256).not.toBe(oldHash); expect(replayed).toEqual(financial);
  }
});
