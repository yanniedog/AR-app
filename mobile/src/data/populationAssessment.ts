import type { CorePayload, Manifest } from '../types';

/** This is an observed subset, never an estimate of the registered population. */
export interface PopulationAssessmentV1 {
  schema_version: 1;
  scope: 'observed-products';
  observed_on: string;
  total_population: null;
  missing_product_count: null;
  observed_counts: { products: number; rates: number; providers: number };
  affected_providers: {
    provider_id: string;
    provider_name: string;
    register_status: 'registered';
    membership_status: 'unknown';
    reason: 'register-endpoint-conflict';
    missing_product_count: null;
    register_url: string;
    endpoint_url: string;
  }[];
}

const fail = (): never => { throw new Error('Invalid observed population assessment'); };
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(result, key))) return fail();
  return result;
}
function identity(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) return fail();
  return value;
}
function url(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return fail();
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) return fail();
  } catch { return fail(); }
  return value;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return fail();
  return value;
}
const providerKey = (value: string) => value.normalize('NFKC').trim().toLowerCase();

/** Absence is legacy; null, unknown versions/keys and numeric substitutes for unknown fail closed. */
export function parsePopulationAssessment(value: unknown): PopulationAssessmentV1 | undefined {
  if (value === undefined) return undefined;
  const a = record(value, ['schema_version', 'scope', 'observed_on', 'total_population', 'missing_product_count', 'observed_counts', 'affected_providers']);
  if (a.schema_version !== 1 || a.scope !== 'observed-products' || a.total_population !== null || a.missing_product_count !== null
    || typeof a.observed_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.observed_on)
    || !Number.isFinite(Date.parse(a.observed_on)) || new Date(a.observed_on).toISOString().slice(0, 10) !== a.observed_on) return fail();
  const counts = record(a.observed_counts, ['products', 'rates', 'providers']);
  if (!Array.isArray(a.affected_providers) || a.affected_providers.length < 1 || a.affected_providers.length > 1000) return fail();
  const ids = new Set<string>(), names = new Set<string>();
  const providers = a.affected_providers.map(value => {
    const p = record(value, ['provider_id', 'provider_name', 'register_status', 'membership_status', 'reason', 'missing_product_count', 'register_url', 'endpoint_url']);
    if (p.register_status !== 'registered' || p.membership_status !== 'unknown' || p.reason !== 'register-endpoint-conflict' || p.missing_product_count !== null) return fail();
    const id = identity(p.provider_id), name = identity(p.provider_name);
    if (ids.has(providerKey(id)) || names.has(providerKey(name))) return fail();
    ids.add(providerKey(id)); names.add(providerKey(name));
    return { provider_id: id, provider_name: name, register_status: 'registered' as const, membership_status: 'unknown' as const,
      reason: 'register-endpoint-conflict' as const, missing_product_count: null,
      register_url: url(p.register_url), endpoint_url: url(p.endpoint_url) };
  });
  return { schema_version: 1, scope: 'observed-products', observed_on: a.observed_on, total_population: null, missing_product_count: null,
    observed_counts: { products: count(counts.products), rates: count(counts.rates), providers: count(counts.providers) }, affected_providers: providers };
}

/** Run on raw remote AND cached cores, before normalization/quarantine changes the count basis. */
export function validatePopulationAssessment(core: CorePayload): PopulationAssessmentV1 | undefined {
  const a = parsePopulationAssessment(core.coverage?.population_assessment);
  if (!a) return undefined;
  if (a.observed_on !== core.run_date || (core.coverage?.observed_on !== undefined && core.coverage.observed_on !== a.observed_on)) return fail();
  const rows = Object.values(core.sections).flatMap(section => section.rates);
  const affected = new Set(a.affected_providers.flatMap(p => [providerKey(p.provider_id), providerKey(p.provider_name)]));
  if (rows.some(row => typeof row.provider !== 'string' || !row.provider.trim() || !row.product_key || affected.has(providerKey(row.provider)))) return fail();
  const observed = a.observed_counts;
  if (observed.rates !== rows.length || observed.products !== new Set(rows.map(row => row.product_key)).size
    || observed.providers !== new Set(rows.map(row => row.provider)).size) return fail();
  return a;
}

/** This first contract covers legacy core rows only, not independently synthesized catalogue offers. */
export function validatePopulationEdition(core: CorePayload, manifest: Manifest): void {
  if (parsePopulationAssessment(core.coverage?.population_assessment) &&
    (core.run_date !== manifest.run_date || manifest.public_rate_catalogue !== undefined)) {
    throw new Error('Observed population edition has an unsupported public pricing catalogue or date');
  }
}
