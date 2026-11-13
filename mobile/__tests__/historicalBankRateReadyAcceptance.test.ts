import compiler from '../contracts/history-ready/compiler-manifest.json';
import compatibility from '../contracts/history-ready/compatible-compilers.json';
import rich from './fixtures/public_rates/history-rich-producer-6d33142.json';
import { compileHistoricalBankRateReady } from '../src/data/historicalBankRateReadyCompiler';
import { validateHistoricalBankRateReadyForApp } from '../src/data/historicalBankRateReady';
import { ACCEPTED_READY_COMPILERS, validateAcceptedHistoricalBankRateReady } from '../src/data/historicalBankRateReadyAcceptance';

const current = compileHistoricalBankRateReady(rich, compiler.sha256);

test('accepts the current pin and listed compatible pins only', () => {
  expect(ACCEPTED_READY_COMPILERS.has(compiler.sha256)).toBe(true);
  for (const entry of compatibility.compatible) expect(ACCEPTED_READY_COMPILERS.has(entry.sha256)).toBe(true);
  expect(validateAcceptedHistoricalBankRateReady(current)).toBe(true);
});

test('history from a listed earlier compiler is adopted, unlike the strict pin', () => {
  const earlier = { ...current, compiler_sha256: compatibility.compatible[0].sha256 };
  expect(validateHistoricalBankRateReadyForApp(earlier)).toBe(false);
  expect(validateAcceptedHistoricalBankRateReady(earlier)).toBe(true);
});

test('unlisted compilers and malformed history stay rejected', () => {
  expect(validateAcceptedHistoricalBankRateReady({ ...current, compiler_sha256: '0'.repeat(64) })).toBe(false);
  expect(validateAcceptedHistoricalBankRateReady({ ...current, compiler_sha256: compatibility.compatible[0].sha256, run_dates: [] })).toBe(false);
  expect(validateAcceptedHistoricalBankRateReady(null)).toBe(false);
});
