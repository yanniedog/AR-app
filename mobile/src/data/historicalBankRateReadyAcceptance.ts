import * as compiler from '../../contracts/history-ready/compiler-manifest.json';
import * as compatibility from '../../contracts/history-ready/compatible-compilers.json';
import { validateHistoricalBankRateReady, READY_SEMANTIC_REVISION, type HistoricalBankRateReady } from './historicalBankRateReadyWire';

/** Exact reviewed compiler digests whose ready history the app may adopt: the
 * current pin plus explicitly listed earlier pins with the same semantic
 * revision and wire. A lagging producer must not strand every chart at the
 * bundled fallback, and an unlisted digest stays rejected. */
export const ACCEPTED_READY_COMPILERS: ReadonlySet<string> = new Set([
  compiler.sha256,
  ...(compatibility.semantic_revision === READY_SEMANTIC_REVISION
    ? compatibility.compatible.map(entry => entry.sha256).filter(sha => /^[a-f0-9]{64}$/.test(sha))
    : []),
]);

const validated = new WeakSet<object>();

export function validateAcceptedHistoricalBankRateReady(value: unknown): value is HistoricalBankRateReady {
  if (!value || typeof value !== 'object') return false;
  if (validated.has(value)) return true;
  const sha = (value as { compiler_sha256?: unknown }).compiler_sha256;
  if (typeof sha !== 'string' || !ACCEPTED_READY_COMPILERS.has(sha) || !validateHistoricalBankRateReady(value, sha)) return false;
  validated.add(value); return true;
}
