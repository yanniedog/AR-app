import { readFileSync } from 'node:fs';
import path from 'node:path';
import { bytesToHex } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import fixture from './fixtures/public_rates/resolver-golden-v1.json';
import referenceFixture from './fixtures/public_rates/nab-reference-scopes-v1.json';
import type { PublicProgramme, PublicReferenceRate, RateScenario } from '../src/data/publicRateModel';
import { resolvePublicRate } from '../src/data/publicRateResolver';
import { estimateReferenceAdjustment } from '../src/data/publicRateLocal';

/** Exact public captures and an independently calculated expected rate shared with Python. */
for (const testCase of fixture.cases) {
  it(`reproduces the retained public source for ${testCase.name}`, () => {
    const capture = readFileSync(path.join(__dirname, 'fixtures/public_rates', testCase.publicSource.fixture));
    expect(bytesToHex(sha256(capture))).toBe(testCase.publicSource.sha256);
    expect(testCase.publicSource.url).toMatch(/^https:\/\/(openbank\.api\.nab\.com\.au|api\.anz)\//);
    const result = resolvePublicRate(testCase.programme as unknown as PublicProgramme, testCase.scenario as RateScenario, testCase.asOf);
    expect(result).toMatchObject(testCase.expected);
    expect(result.origin).toBe(testCase.name === 'ANZ Progress Saver' ? 'publicly_calculated' : 'published');
    expect(result.evidenceIds.length).toBeGreaterThan(0);
  });
}

it('keeps NAB open-ended source LVR tiers and 95 percent product maximum separate', () => {
  const testCase = fixture.cases.find(item => item.name === 'NAB Tailored Home Loan')!;
  const programme = testCase.programme as unknown as PublicProgramme;
  const scenario = testCase.scenario as RateScenario;
  for (const lvr of ['0.8001', '0.85', '0.90', '0.95']) expect(resolvePublicRate(programme, { ...scenario, lvr }, testCase.asOf).status).toBe('range');
  expect(resolvePublicRate(programme, { ...scenario, lvr: '0.95001' }, testCase.asOf).status).toBe('unresolved');
});

it('does not grant a savings bonus when public qualification assumptions are missing', () => {
  const testCase = fixture.cases.find(item => item.name === 'ANZ Progress Saver')!;
  const programme = testCase.programme as unknown as PublicProgramme;
  const scenario = { ...testCase.scenario, qualificationPeriodSatisfied: undefined } as RateScenario;
  expect(resolvePublicRate(programme, scenario, testCase.asOf).status).toBe('unresolved');
});

it('requires the published NAB owner-occupier, investment and same-name overseas reference scopes', () => {
  const capture = readFileSync(path.join(__dirname, 'fixtures/public_rates', referenceFixture.publicSource.fixture));
  expect(bytesToHex(sha256(capture))).toBe(referenceFixture.publicSource.sha256);
  expect(referenceFixture.publicSource.url).toBe('https://www.nab.com.au/content/dam/nabrwd/documents/rates-and-fees/loans/indicator-rates-for-home-lending.pdf');
  const references = referenceFixture.referenceRates as unknown as PublicReferenceRate[];
  const owner = references.find(reference => reference.conditions?.some(condition => condition.value === 'OWNER_OCCUPIED'))!;
  const investor = references.find(reference => reference.conditions?.some(condition => condition.value === 'INVESTMENT'))!;
  const overseas = references.find(reference => reference.conditions?.some(condition => condition.value === 'OVERSEAS_BORROWER'))!;
  expect(owner.name).toBe(overseas.name);
  expect(new Set(references.map(reference => reference.scopeId)).size).toBe(3);
  const ownerScenario = { purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' };
  const ownerResult = estimateReferenceAdjustment(owner, '-2', referenceFixture.asOf, false, ownerScenario);
  expect(ownerResult).toMatchObject({ status: 'exact', payableRate: '0.0689', origin: 'locally_calculated', verifiedCurrent: false });
  expect(ownerResult.conditions.met).toHaveLength(2);
  const mismatch = estimateReferenceAdjustment(investor, '-2', referenceFixture.asOf, false, ownerScenario);
  expect(mismatch).toMatchObject({ status: 'unresolved', reasonCodes: ['reference_conditions_unmet'] });
  expect(mismatch.payableRate).toBeUndefined();
  expect(mismatch.conditions.unmet).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'purpose', value: 'INVESTMENT' })]));
  expect(estimateReferenceAdjustment(investor, '-2', referenceFixture.asOf, false, { ...ownerScenario, purpose: 'INVESTMENT' }).payableRate).toBe('0.0741');
  expect(estimateReferenceAdjustment(overseas, '-2', referenceFixture.asOf, false, ownerScenario)).toMatchObject({ status: 'unresolved', reasonCodes: ['reference_conditions_unknown'] });
  expect(estimateReferenceAdjustment(overseas, '-2', referenceFixture.asOf, false, { ...ownerScenario, customerCategory: 'OVERSEAS_BORROWER' }).payableRate).toBe('0.0777');
  expect(estimateReferenceAdjustment(owner, '-2', referenceFixture.asOf).conditions.unknown).toHaveLength(2);
  expect(estimateReferenceAdjustment(owner, '-2', referenceFixture.asOf, false, { ...ownerScenario, repayment: 'INTEREST_ONLY' }).status).toBe('unresolved');
});
