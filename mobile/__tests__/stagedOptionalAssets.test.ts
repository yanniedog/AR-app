import { bindStagedSpread, normalizeStagedOptionalAsset, stagedSpreadFor } from '../src/data/stagedOptionalAssets';
import { revisionManifest } from '../testUtils/payloadRevision';
import { sampleManifest } from '../src/data/sample';

const manifest = () => revisionManifest(2, { files: { ...sampleManifest.files,
  bank_spread_history: { name: 'spread.json.gz', bytes: 123, sha256: 'a'.repeat(64), url: '' },
  rba_calendar: { name: 'calendar.json.gz', bytes: 123, sha256: 'b'.repeat(64), url: '' },
} });
const spread = (day: string) => ({ schema_version: 1, run_date: day, run_dates: [day],
  method: 'mean_rate_rows_per_product_then_mean_products_per_provider',
  cohorts: { mortgage: 'variable', savings: 'base' }, banks: { Example: {
    mortgage_mean: [.06], savings_mean: [.04], gap: [.02], mortgage_count: [1], savings_count: [1],
    mortgage_hash: ['m1'], savings_hash: ['s1'], quality: ['complete'],
  } } });

test('staged spread is semantically checked once and reusable only for its exact adopted core/asset', () => {
  const edition = manifest();
  const value = normalizeStagedOptionalAsset('bank_spread_history', spread(edition.run_date), edition).bankSpreadHistory!;
  expect(stagedSpreadFor(edition)).toBeNull();
  bindStagedSpread(edition, value);
  expect(stagedSpreadFor(edition)).toBe(value);
  expect(stagedSpreadFor({ ...edition })).toBeNull();
  expect(Object.isFrozen(value.banks.Example.gap)).toBe(true);
  edition.files.bank_spread_history = { ...edition.files.bank_spread_history!, sha256: 'c'.repeat(64) };
  expect(stagedSpreadFor(edition)).toBeNull();
});

test('staged spread receipt cannot survive a changed core binding', () => {
  const edition = manifest();
  bindStagedSpread(edition, normalizeStagedOptionalAsset('bank_spread_history', spread(edition.run_date), edition).bankSpreadHistory!);
  edition.files.core = { ...edition.files.core, sha256: 'c'.repeat(64) };
  expect(stagedSpreadFor(edition)).toBeNull();
});

test.each(['search_index', 'history_banks', 'bank_history', 'bank_spread_history', 'rba_calendar'])(
  'rejects invalid %s before its staged data can be installed', key => {
    const edition = manifest();
    expect(() => normalizeStagedOptionalAsset(key, { run_date: edition.run_date }, edition)).toThrow('validation');
  },
);

test('calendar staging retains its asset identity while normalizing its supported shape', () => {
  const edition = manifest();
  const normalized = normalizeStagedOptionalAsset('rba_calendar', { timezone: 'Australia/Sydney',
    decisions: [{ date: edition.run_date, effective: null, rate: 4, delta_bps: 0, outcome: 'hold' }], schedule: [] }, edition);
  expect(normalized.rbaCalendar?.decisions).toHaveLength(1);
  expect(normalized.rbaCalendarSha).toBe(edition.files.rba_calendar!.sha256);
});
