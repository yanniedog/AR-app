import { sha256 } from '@noble/hashes/sha256';
import fixture from './fixtures/bankwest-easy-saver-eligibility-20260913.json';
import { RATE_OBSERVATION_FIELDS, rateTierSignature } from '../src/data/bankRateOverview';
import { validateHistoricalBankRateCatalogue, validateHistoricalBankRateCatalogueAsync,
  type HistoricalBankRateCatalogue, type HistoricalRateDescriptor } from '../src/data/historicalBankRateCatalogueWire';
import type { RateRow } from '../src/types';

jest.mock('@noble/hashes/sha256', () => {
  const original = jest.requireActual('@noble/hashes/sha256');
  return { ...original, sha256: Object.assign(jest.fn(original.sha256), original.sha256) };
});

const observed = fixture.rates[0] as RateRow;
const row = Object.fromEntries(Object.entries(observed).filter(([key]) => !RATE_OBSERVATION_FIELDS.has(key))) as HistoricalRateDescriptor;
const signature = (value: HistoricalRateDescriptor) => rateTierSignature(value as RateRow);
const digest = 'a'.repeat(64);
function pack(rows: HistoricalRateDescriptor[]): HistoricalBankRateCatalogue {
  return { schema_version: 2, run_dates: ['2026-09-13'],
    sources: { '2026-09-13': { kind: 'published_core', core_sha256: digest, details_sha256: digest, manifest_sha256: digest } },
    unavailable_dates: {}, evidence: [{ status: 'unknown' }], sections: { Mortgage: [], TD: [],
      Savings: rows.map(descriptor => ({ row: descriptor, spans: [[0, 1, [Number(observed.rate) * 100], 0]] })) } };
}
beforeEach(() => {
  jest.mocked(sha256).mockReset();
  jest.mocked(sha256).mockImplementation(jest.requireActual('@noble/hashes/sha256').sha256);
});

test('captured ordinary descriptors avoid hashing and reject duplicates regardless of key order', () => {
  expect(validateHistoricalBankRateCatalogue(pack([row]))).toBe(true);
  const reordered = Object.fromEntries(Object.entries(row).reverse()) as HistoricalRateDescriptor;
  expect(validateHistoricalBankRateCatalogue(pack([row, reordered]))).toBe(false);
  expect(sha256).not.toHaveBeenCalled();
});

test('duplicate identity remains scoped to its section', () => {
  const catalogue = pack([row]);
  catalogue.sections.Mortgage = catalogue.sections.Savings;
  expect(validateHistoricalBankRateCatalogue(catalogue)).toBe(true);
  expect(sha256).not.toHaveBeenCalled();
});

test('the large-signature fallback bounds escaped length rather than unescaped scalar length', () => {
  // Structural stress only; the captured observed rate is unchanged.
  const escaped = { ...row, product_name: '\u0001'.repeat(800) };
  expect(escaped.product_name.length).toBeLessThan(4096);
  expect(signature(escaped).length).toBeGreaterThan(4096);
  expect(validateHistoricalBankRateCatalogue(pack([escaped]))).toBe(true);
  expect(sha256).toHaveBeenCalledTimes(1);
  expect(validateHistoricalBankRateCatalogue(pack([escaped, { ...escaped }]))).toBe(false);
});

test('distinct large rows survive digest collisions while exact duplicates still fail in both validators', async () => {
  jest.mocked(sha256).mockImplementation(() => new Uint8Array(32));
  const first = { ...row, product_name: '\u0001'.repeat(65_536) };
  const second = { ...first, product_name: first.product_name.slice(0, -1) + '\u0002' };
  const distinct = pack([first, second]);
  expect(validateHistoricalBankRateCatalogue(distinct)).toBe(true);
  expect(await validateHistoricalBankRateCatalogueAsync(distinct, async () => {})).toBe(true);
  const duplicate = pack([first, second, { ...first }]);
  expect(validateHistoricalBankRateCatalogue(duplicate)).toBe(false);
  expect(await validateHistoricalBankRateCatalogueAsync(duplicate, async () => {})).toBe(false);
});

test('the section budget hashes overflow and still rejects duplicates on either side of its boundary', () => {
  const rows: HistoricalRateDescriptor[] = [];
  let characters = 0;
  while (characters <= 16 * 1024 * 1024) {
    const descriptor = { ...row, product_name: `${String(rows.length).padStart(5, '0')}:${'x'.repeat(3000)}` };
    const length = signature(descriptor);
    expect(length.length).toBeLessThan(4096);
    rows.push(descriptor); characters += length.length;
  }
  const source = pack(rows), originalRows = [...source.sections.Savings];
  expect(validateHistoricalBankRateCatalogue(source)).toBe(true);
  expect(sha256).toHaveBeenCalledTimes(1);
  expect(validateHistoricalBankRateCatalogue(pack([...rows, { ...rows[0] }]))).toBe(false);
  expect(validateHistoricalBankRateCatalogue(pack([...rows, { ...rows.at(-1)! }]))).toBe(false);
  expect(source.sections.Savings).toEqual(originalRows);
});

test('metadata and source digest validation still reject invalid input before duplicate insertion', () => {
  const tooLong = pack([{ ...row, product_name: 'x'.repeat(65_537) }]);
  expect(validateHistoricalBankRateCatalogue(tooLong)).toBe(false);
  const invalidReceipt = pack([row]);
  invalidReceipt.sources['2026-09-13'] = { kind: 'published_core', core_sha256: 'invalid', details_sha256: digest, manifest_sha256: digest };
  expect(validateHistoricalBankRateCatalogue(invalidReceipt)).toBe(false);
  expect(sha256).not.toHaveBeenCalled();
});
