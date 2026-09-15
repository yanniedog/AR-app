import { rateConditionFixture } from '../testUtils/rateConditions';
import { rateConditionId, scopedRateConditions, validRateConditions } from '../src/data/rateConditions';
import { bindCachedDetails, detailsCacheIdentity, verifiedDetailsSha } from '../src/data/detailsIdentity';
import { buildRateReceipt, rateConditionReceiptLines } from '../src/data/rateReceipt';
import * as Crypto from 'expo-crypto';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: jest.fn(async (_algorithm: string, text: string) => jest.requireActual('crypto').createHash('sha256').update(text).digest('hex')) }));

test('all8 real Macquarie rows select their original wording, never the same-term alternative', () => {
  const f = rateConditionFixture();
  const raw = readFileSync(path.join(__dirname, 'fixtures/rateConditions/macquarie-digital-2026-09-15.json'));
  expect(createHash('sha256').update(raw).digest('hex')).toBe(f.details.products[f.productKey].rateConditions!.sourceSha256);
  expect(f.rows).toHaveLength(8);
  f.rows.forEach((row, i) => {
    const result = scopedRateConditions(row, 'TD', f);
    expect(result.status).toBe('available'); expect(result.entries).toHaveLength(1);
    expect(result.entries[0].text).toBe(i < 4 ? 'For balances of 1 million dollars and under' : 'For balances of over 1 million dollars');
    expect(result.entries[0].sourcePointer).toContain(`/depositRates/${i}/`);
  });
  const receipt = buildRateReceipt({ row: f.rows[4], section: 'TD', evidenceDate: f.core.run_date, detail: f.details.products[f.productKey], rateConditionContext: f });
  expect(receipt.rateConditions.entries[0].rateIndex).toBe(5);
  expect(receipt.rateConditions.detailsSha256).toBe(f.manifest.files.details.sha256);
  expect(rateConditionReceiptLines(receipt).join('\n')).toContain('For balances of over 1 million dollars');
});
test.each(['root', 'mixed_root', 'nested_tier', 'ordinal', 'pointer_ordinal', 'leading_zero'] as const)('rejects adversarial %s provenance', kind => {
  const f = rateConditionFixture(), e = f.details.products[f.productKey].rateConditions!, row = e.entries[0];
  if (kind === 'root') { row.rateSourcePointer = '/other/depositRates/0'; row.tierSourcePointer = '/other/depositRates/0/tiers/0'; row.sourcePointer = `${row.tierSourcePointer}/additionalInfo`; }
  if (kind === 'mixed_root') { row.rateSourcePointer = '/depositRates/0'; row.tierSourcePointer = '/depositRates/0/tiers/0'; row.sourcePointer = `${row.tierSourcePointer}/additionalInfo`; }
  if (kind === 'nested_tier') { row.tierSourcePointer += '/tiers/0'; row.sourcePointer = `${row.tierSourcePointer}/additionalInfo`; }
  if (kind === 'ordinal') row.rateIndex = 2;
  if (kind === 'pointer_ordinal') { e.entries.push({ ...row, rateIndex: 99, sourcePointer: `${row.tierSourcePointer}/additionalInfo`, id: rateConditionId(e.sourceSha256, `${row.tierSourcePointer}/additionalInfo`) }); }
  if (kind === 'leading_zero') row.sourcePointer = `${row.tierSourcePointer}/applicabilityConditions/01/additionalInfo`;
  row.id = rateConditionId(e.sourceSha256, row.sourcePointer);
  expect(validRateConditions(e)).toBe(false);
});
test('stale details, changed generation hash, cloned rows and missing indices cannot fallback', () => {
  const f = rateConditionFixture(); const row = f.rows[0];
  expect(scopedRateConditions({ ...row }, 'TD', f).status).toBe('unavailable');
  expect(scopedRateConditions({ ...row, rate_index: 0 }, 'TD', f).status).toBe('unavailable');
  expect(scopedRateConditions({ ...row, rate_index: undefined }, 'TD', f).status).toBe('unavailable');
  expect(scopedRateConditions(row, 'Mortgage', f).status).toBe('unavailable');
  expect(scopedRateConditions(row, 'TD', { ...f, details: JSON.parse(JSON.stringify(f.details)) }).status).toBe('unavailable');
  f.details.run_date = '2026-09-14'; expect(scopedRateConditions(row, 'TD', f).status).toBe('unavailable'); f.details.run_date = f.core.run_date;
  f.manifest.files.details.sha256 = '0'.repeat(64);
  expect(scopedRateConditions(row, 'TD', f).status).toBe('unavailable');
});
test('missing old envelope is explicit unavailable; invalid one does not silently omit bad entries', () => {
  const f = rateConditionFixture(), detail = f.details.products[f.productKey];
  const saved = detail.rateConditions!; delete detail.rateConditions;
  expect(scopedRateConditions(f.rows[0], 'TD', f).reason).toContain('does not mean');
  detail.rateConditions = saved; saved.entries[7].id = '0'.repeat(64);
  expect(scopedRateConditions(f.rows[0], 'TD', f).status).toBe('unavailable');
});
test('validation binds ID, source-pointer family and UTF8 bounds while retaining verbatim text', () => {
  const f = rateConditionFixture(), e = f.details.products[f.productKey].rateConditions!;
  const original = e.entries[0]; original.text = '  Exact wording\n€  ';
  expect(validRateConditions(e)).toBe(true); expect(scopedRateConditions(f.rows[0], 'TD', f).entries[0].text).toBe(original.text);
  original.text = '€'.repeat(5500); expect(validRateConditions(e)).toBe(false);
  original.text = 'wording'; original.rateFamily = 'lending'; expect(validRateConditions(e)).toBe(false);
  original.rateFamily = 'deposit'; original.sourcePointer += '/unexpected'; original.id = rateConditionId(e.sourceSha256, original.sourcePointer);
  expect(validRateConditions(e)).toBe(false);
});
test('cached valid JSON needs a matching stored content digest, not just adjacent metadata', async () => {
  const f = rateConditionFixture(), text = JSON.stringify(f.details), identity = await detailsCacheIdentity(text, f.manifest.files.details.sha256);
  const matching = JSON.parse(text); await bindCachedDetails(matching, text, identity, f.manifest.files.details.sha256);
  expect(verifiedDetailsSha(matching)).toBe(f.manifest.files.details.sha256);
  const tamperedText = text.replace('1 million', '2 million'), tampered = JSON.parse(tamperedText);
  await bindCachedDetails(tampered, tamperedText, identity, f.manifest.files.details.sha256);
  expect(verifiedDetailsSha(tampered)).toBeNull();
  const old = JSON.parse(text); await bindCachedDetails(old, text, null, f.manifest.files.details.sha256);
  expect(verifiedDetailsSha(old)).toBeNull(); expect(Crypto.digestStringAsync).toHaveBeenCalled();
});
