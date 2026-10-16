import compiler from '../contracts/history-ready/compiler-manifest.json';
import rich from './fixtures/public_rates/history-rich-producer-6d33142.json';
import publishedReady from './fixtures/public_rates/history-ready-producer-6d33142.json';
import { compileHistoricalBankRateReady } from '../src/data/historicalBankRateReadyCompiler';
import { validateHistoricalBankRateReady } from '../src/data/historicalBankRateReadyWire';
import { validateHistoricalBankRateReadyForApp } from '../src/data/historicalBankRateReady';

test('producer history is structurally valid but a different compiler pin remains rejected', () => {
  expect(validateHistoricalBankRateReady(publishedReady)).toBe(true);
  expect(publishedReady.compiler_sha256).not.toBe(compiler.sha256);
  expect(validateHistoricalBankRateReadyForApp(publishedReady)).toBe(false);
});

test('current compiler reproduces all retained producer facts and source receipts', () => {
  const current = compileHistoricalBankRateReady(rich, compiler.sha256);
  expect({ ...current, compiler_sha256: publishedReady.compiler_sha256 }).toEqual(publishedReady);
  expect(validateHistoricalBankRateReadyForApp(current)).toBe(true);
  expect(Object.keys(current.sources)).toEqual(['2026-05-19', '2026-09-25', '2026-09-26']);
  expect(current.run_dates).toHaveLength(131);
  expect(validateHistoricalBankRateReadyForApp({ ...current, compiler_sha256: '0'.repeat(64) })).toBe(false);
});
