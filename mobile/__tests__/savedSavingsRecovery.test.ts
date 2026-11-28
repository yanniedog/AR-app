import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { advertisedTermMonths } from '../src/data/calc';
import { formatTerm, humanizeEnum } from '../src/data/format';
import { publicInterestPayment } from '../src/data/scenarioPublicCost';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { EMPTY_PROFILE } from '../src/data/profile';
import { selectProfileRows } from '../src/data/profileSelection';
import { isExplicitTermDepositProduct } from '../src/data/sectionIntegrity';
import { EMPTY_FILTERS, prepareSearchRows } from '../src/data/selectors';
import { buildSearchLabel } from '../src/data/subscriptions';
import type { CorePayload } from '../src/types';

const fixture = path.resolve(__dirname, '../__fixtures__/public-2026-09-11/core.json.gz');
const core: CorePayload = JSON.parse(gunzipSync(fs.readFileSync(fixture)).toString('utf8'));
const profile = { ...EMPTY_PROFILE, depositKinds: ['base'] };
const filters = { ...EMPTY_FILTERS, includeNonStandard: true, includeLowSavingsRates: true };

afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));

test('recovery includes low positive published rates within the saved Savings requirements', async () => {
  installMandatoryEligibility(selectMandatoryEligibility(core, profile, null));
  const rows = core.sections.Savings.rates;
  const result = await prepareSearchRows(rows, filters, 'rate', 'Savings', null, null,
    'base', 'comparison', { yieldControl: async () => {} });
  expect(result?.some(r => r.provider === 'bankWAW' && r.product_name === 'Club and Community Transact' && Number(r.rate) === 0.0001)).toBe(true);
  expect(result?.every(r => r.ribbon_deposit_kind === 'base')).toBe(true);
  expect(result?.some(r => r.rate != null && r.rate !== '' && Number(r.rate) <= 0)).toBe(false);
  expect(buildSearchLabel('Savings', [], '', filters)).toContain('Includes low rates');
});

test('a producer-classified Savings section accepts the original Rabobank notice account identities', () => {
  const noticeRows = core.sections.TD.rates.filter(row => row.provider === 'Rabobank' && /Notice Saver/i.test(row.product_name));
  expect(noticeRows).toHaveLength(60);
  expect(noticeRows.every(row => row.category === 'TERM_DEPOSITS' && !isExplicitTermDepositProduct(row))).toBe(true);
  expect(selectProfileRows(noticeRows, profile, 'Savings', null)).toEqual(noticeRows);
});

test('published day and compound terms override the derived month count', () => {
  const alex = core.sections.TD.rates.filter(row => row.provider === 'Alex.Bank' && row.term === 'P1Y6M');
  expect(alex).toHaveLength(6);
  for (const row of alex) {
    expect(formatTerm(row)).toBe('18 mo');
    expect(advertisedTermMonths(row)).toBe(18);
  }
  const sevenDays = core.sections.TD.rates.find(row => row.provider === 'ANZ' && row.term === 'P7D');
  expect(sevenDays).toBeDefined();
  expect(formatTerm(sevenDays!)).toBe('7 days');
  expect(advertisedTermMonths(sevenDays!)).toBeNull();
});

test('published fortnightly and four-weekly schedules remain distinct from monthly', () => {
  for (const [cadence, label] of [
    ['fortnightly', 'Paid fortnightly'], ['four_weekly', 'Paid every 4 weeks'],
    ['fortnightly_or_monthly', 'Fortnightly or monthly'],
  ]) {
    expect(humanizeEnum(cadence)).toBe(label);
    expect(publicInterestPayment(cadence)).toBe('unknown');
  }
});
