import * as compiler from '../contracts/history-ready/compiler-manifest.json';
import { prepareHistoricalBankRateReady } from '../src/data/historicalBankRateCatalogue';
import { syncProductHistoryFromDailyPayloads } from '../src/data/productHistorySync';
import { HISTORY_DERIVATION_VERSION } from '../src/data/historyDerivation';
import type { HistoricalBankRateReady } from '../src/data/historicalBankRateReadyWire';
import type { ProductHistoryPayload } from '../src/data/productHistoryModel';
import type { CorePayload } from '../src/types';
import { downloadDatedCore, fetchDatesIndexJson } from '../src/data/historyDaily';

jest.mock('../src/data/historyDaily', () => ({ ...jest.requireActual('../src/data/historyDaily'),
  fetchDatesIndexJson: jest.fn(), downloadDatedCore: jest.fn() }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: jest.fn(async () => {}) }));
const day = '2026-09-26', today = '2026-09-27', sha = 'a'.repeat(64);
const identity = (banks: string) => `prepared:${compiler.sha256}:${banks}`;
const publicIdentity = `revision:2:${sha}:${sha}`;
const current = { run_date: today, sections: { Mortgage: { rates: [] }, TD: { rates: [] }, Savings: {
  rates: [{ provider: 'Bank', product_key: 'P', product_name: 'Savings', rate: '0.07' }] } } } as unknown as CorePayload;
function ready(banks = sha, rate = 5): HistoricalBankRateReady {
  return { schema_version: 1, semantic_revision: 'ar-history-ready-v1', compiler_sha256: compiler.sha256,
    run_dates: [day], sources: { [day]: { kind: 'selected_contract', banks_sha256: banks, bytes: 100,
      generation_id: 'selected', contract_digest: sha } }, unavailable_dates: {}, quarantined_tier_count: 0,
    sections: { Mortgage: [], TD: [], Savings: [['Bank', [null], false, false, 0, [[0, [[rate, 1]]], [1, [[rate, -1]]]]]] },
    products: { Mortgage: [], TD: [], Savings: [['P', [[0, 1, rate]]]] } };
}
function existing(source = identity(sha)): ProductHistoryPayload {
  return { schema_version: 3, derivation_version: HISTORY_DERIVATION_VERSION, run_date: today, run_dates: [day, today],
    products: { P: [0.05, 0.07] }, source_identities: { [day]: source } };
}
beforeEach(() => jest.clearAllMocks());

test.each(['unavailable', 'rejected'])('current independent ready identity replaces an older cached producer when public index is %s', async mode => {
  const prior = existing();
  if (mode === 'unavailable') jest.mocked(fetchDatesIndexJson).mockRejectedValue(new Error('offline'));
  else {
    prior.revision_high_water = { [day]: publicIdentity };
    jest.mocked(fetchDatesIndexJson).mockResolvedValue({ dates: [day, today], revision_heads: { [day]: {
      revision: 1, bundle_sha256: sha, manifest_sha256: sha } } } as never);
  }
  const banks = 'b'.repeat(64), catalogue = prepareHistoricalBankRateReady(ready(banks, 6))!;
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: today, currentCore: current, existing: prior, catalogue, preparedOnly: true });
  expect(result.products.P).toEqual([0.06, 0.07]);
  expect(result.source_identities?.[day]).toBe(identity(banks));
  if (mode === 'rejected') expect(result.revision_high_water?.[day]).toBe(publicIdentity);
  expect(downloadDatedCore).not.toHaveBeenCalled();
});

test('independent dates absent from the current payload become gaps even without an index', async () => {
  const catalogue = prepareHistoricalBankRateReady(ready(), [])!;
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: today, currentCore: current,
    existing: existing(), catalogue, preparedOnly: true, allowNetwork: false });
  expect(result.products.P).toEqual([null, 0.07]);
  expect(result.source_identities?.[day]).toBeUndefined();
  expect(downloadDatedCore).not.toHaveBeenCalled();
});

test('an identical independent receipt remains reusable without an index', async () => {
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: today, currentCore: current,
    existing: existing(), catalogue: prepareHistoricalBankRateReady(ready()), preparedOnly: true, allowNetwork: false });
  expect(result.products.P).toEqual([0.05, 0.07]);
  expect(result.source_identities?.[day]).toBe(identity(sha));
});

test('a rejected public index still retains a verified higher public revision', async () => {
  const value = ready(); value.sources[day] = { kind: 'published_core', core_sha256: sha, details_sha256: sha, manifest_sha256: sha };
  jest.mocked(fetchDatesIndexJson).mockResolvedValue({ dates: [day, today], revision_heads: { [day]: {
    revision: 1, bundle_sha256: sha, manifest_sha256: sha } } } as never);
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: today, currentCore: current,
    existing: existing(publicIdentity), catalogue: prepareHistoricalBankRateReady(value), preparedOnly: true });
  expect(result.products.P).toEqual([0.05, 0.07]);
  expect(result.source_identities?.[day]).toBe(publicIdentity);
  expect(downloadDatedCore).not.toHaveBeenCalled();
});
