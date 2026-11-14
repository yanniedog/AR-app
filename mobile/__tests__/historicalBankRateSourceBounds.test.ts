import rich from './fixtures/public_rates/history-rich-producer-6d33142.json';
import compiler from '../contracts/history-ready/compiler-manifest.json';
import { MAX_HISTORICAL_SOURCE_BYTES, validateHistoricalCatalogueSource, validateHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueWire';
import { compileHistoricalBankRateReady } from '../src/data/historicalBankRateReadyCompiler';
import { READY_HISTORY_LIMITS, validateHistoricalBankRateReady } from '../src/data/historicalBankRateReadyWire';
import { ACCEPTED_READY_COMPILERS } from '../src/data/historicalBankRateReadyAcceptance';

// Provenance size controls only; all financial observations remain the retained real fixture.
const source = { kind: 'selected_contract', generation_id: 'obs-2026-11-14-0000000000000000',
  contract_digest: 'a'.repeat(64), banks_sha256: 'b'.repeat(64), bytes: 188_525_991 };

test.each(['selected_contract', 'retained_legacy_export'])('expanded original %s provenance fits without larger app assets', kind => {
  expect(validateHistoricalCatalogueSource({ ...source, kind })).toBe(true);
  expect(validateHistoricalCatalogueSource({ ...source, kind, bytes: MAX_HISTORICAL_SOURCE_BYTES })).toBe(true);
  const catalogue = JSON.parse(JSON.stringify(rich));
  for (const day of Object.keys(catalogue.sources)) catalogue.sources[day] = { ...source, kind };
  expect(validateHistoricalBankRateCatalogue(catalogue)).toBe(true);
  const ready = compileHistoricalBankRateReady(catalogue, compiler.sha256);
  expect(validateHistoricalBankRateReady(ready, compiler.sha256)).toBe(true);
  expect(ready.sources).toEqual(catalogue.sources);
  expect(READY_HISTORY_LIMITS.decodedBytes).toBe(4 * 1024 * 1024);
});

test.each([0, -1, 512 * 1024 * 1024 + 1, Number.MAX_SAFE_INTEGER + 1, 1.5, Infinity, NaN, '188525991'])('invalid source bytes %s stay rejected', bytes => {
  expect(validateHistoricalCatalogueSource({ ...source, bytes })).toBe(false);
});

test('source integrity fields and unknown kinds remain required', () => {
  expect(validateHistoricalCatalogueSource({ ...source, banks_sha256: 'bad' })).toBe(false);
  expect(validateHistoricalCatalogueSource({ ...source, contract_digest: 'bad' })).toBe(false);
  expect(validateHistoricalCatalogueSource({ ...source, generation_id: '' })).toBe(false);
  expect(validateHistoricalCatalogueSource({ ...source, kind: 'unsupported' })).toBe(false);
});

test('previously released producer compiler remains explicitly accepted', () => {
  expect(ACCEPTED_READY_COMPILERS.has('c6d1ff733a579a5fef1d17105922aee20bf73d96e66adc60aaa637ff2c1cec9b')).toBe(true);
});
