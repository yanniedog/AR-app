import { SECTION_KEYS, type ProductDetail, type RateRow, type SectionKey } from '../types';
import { isValidCalendarDate } from '../lib/calendarDate';
import { normalizedProductFacts } from './productFacts';
import { RATE_OBSERVATION_FIELDS, rateTierSignature } from './bankRateOverview';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export type HistoricalRateDescriptor = Omit<RateRow, 'rate' | 'comparison_rate' | 'ongoing_rate' | 'last_updated' | 'rate_index' | 'exact_alert_eligible' | 'bank_rate_tier'>;
export type HistoricalCatalogueSource =
  | { kind: 'selected_contract'; generation_id: string; contract_digest: string; banks_sha256: string; bytes: number }
  | { kind: 'retained_legacy_export'; banks_sha256: string; bytes: number }
  | { kind: 'published_core'; core_sha256: string; details_sha256: string; manifest_sha256: string };
export type HistoricalCatalogueEvidence = { status: 'unknown' } | {
  status: 'known';
  identity: { provider: string; product_id: string; product_key: string; category: string; dataset: SectionKey };
  detail: Pick<ProductDetail, 'description' | 'eligibility' | 'constraints' | 'facts'>;
};
/** Percentage-point observations, with original row multiplicity retained. */
export type HistoricalCatalogueSpan = [start: number, count: number, rates: number[], evidenceId: number];
export interface HistoricalCatalogueTier { row: HistoricalRateDescriptor; spans: HistoricalCatalogueSpan[] }
export interface HistoricalBankRateCatalogue {
  schema_version: 2;
  run_dates: string[];
  sources: Record<string, HistoricalCatalogueSource>;
  unavailable_dates: Record<string, string>;
  evidence: HistoricalCatalogueEvidence[];
  sections: Record<SectionKey, HistoricalCatalogueTier[]>;
}

export const HISTORICAL_CATALOGUE_LIMITS = {
  days: 5000, tiers: 100_000, evidence: 100_000, spans: 1_000_000,
  cells: 10_000_000, ratesPerSpan: 10_000, metadataCharacters: 64 * 1024 * 1024,
} as const;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 65_536;
const sha = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const numericFields = new Set(['term_months', 'ribbon_fixed_term', 'balance_min', 'balance_max']);
const rowFields = new Set(['provider', 'product_id', 'product_key', 'product_name', 'category', 'rate_type',
  'repayment_type', 'loan_purpose', 'term', 'term_months', 'lvr_tier', 'ribbon_normalized', 'security_purpose',
  'ribbon_repayment_type', 'ribbon_rate_structure', 'ribbon_fixed_term', 'account_type', 'ribbon_deposit_kind',
  'balance_min', 'balance_max', 'interest_payment', 'feature_set', 'account_class', 'taxonomy_path']);

export function validateHistoricalCatalogueSource(value: unknown): value is HistoricalCatalogueSource {
  if (!record(value)) return false;
  if (value.kind === 'published_core') return sha(value.core_sha256) && sha(value.details_sha256) && sha(value.manifest_sha256);
  if (value.kind !== 'selected_contract' && value.kind !== 'retained_legacy_export') return false;
  return sha(value.banks_sha256) && Number.isSafeInteger(value.bytes) && Number(value.bytes) > 0 && Number(value.bytes) <= 128 * 1024 * 1024 &&
    (value.kind === 'retained_legacy_export' || (text(value.generation_id) && sha(value.contract_digest)));
}

function validDescriptor(value: unknown): value is HistoricalRateDescriptor {
  return record(value) && ['provider', 'product_key', 'product_name'].every(key => text(value[key])) &&
    Object.entries(value).every(([key, field]) => rowFields.has(key) && !RATE_OBSERVATION_FIELDS.has(key) &&
      (key === 'ribbon_normalized' ? typeof field === 'boolean' :
        typeof field === 'string' ? field.length <= 65_536 : numericFields.has(key) && typeof field === 'number' && Number.isFinite(field)));
}

/** Bounded shallow evidence: unexpected nested objects cannot reach classifiers. */
export function validateHistoricalCatalogueEvidence(value: unknown): value is HistoricalCatalogueEvidence {
  if (!record(value)) return false;
  if (value.status === 'unknown') return Object.keys(value).length === 1;
  if (value.status !== 'known' || !record(value.identity) || !record(value.detail)) return false;
  const identity = value.identity, detail = value.detail;
  if (Object.keys(value).some(key => !['status', 'identity', 'detail'].includes(key)) ||
      Object.keys(identity).some(key => !['provider', 'product_id', 'product_key', 'category', 'dataset'].includes(key))) return false;
  if (!['provider', 'product_id', 'product_key', 'category'].every(key => text(identity[key])) ||
      !SECTION_KEYS.includes(identity.dataset as SectionKey)) return false;
  if (Object.keys(detail).some(key => !['description', 'eligibility', 'constraints', 'facts'].includes(key))) return false;
  if (!Object.values(detail).some(item => typeof item === 'string' ? item.trim().length > 0 : Array.isArray(item) && item.length > 0)) return false;
  if (detail.description !== undefined && (typeof detail.description !== 'string' || detail.description.length > 65_536)) return false;
  for (const key of ['eligibility', 'constraints']) {
    const items = detail[key];
    if (items === undefined) continue;
    if (!Array.isArray(items) || items.length > 4096 || !items.every(item => record(item) && Object.entries(item).every(([field, content]) =>
      ['label', 'name', 'info', 'value'].includes(field) && (typeof content === 'string' ? content.length <= 65_536 :
        field === 'value' && typeof content === 'number' && Number.isFinite(content))))) return false;
  }
  if (detail.facts === undefined) return true;
  if (!Array.isArray(detail.facts) || detail.facts.length > 4096) return false;
  // Reject malformed variants rather than allowing normalization to drop a veto.
  return normalizedProductFacts(detail as ProductDetail).length === detail.facts.length && detail.facts.every(fact =>
    record(fact) && fact.kind === 'feature' && Object.values(fact).every(field =>
      typeof field === 'string' ? field.length <= 65_536 :
        Array.isArray(field) ? field.length <= 128 && field.every(item => typeof item === 'string' && item.length <= 65_536) :
          typeof field === 'boolean' || (typeof field === 'number' && Number.isFinite(field))));
}

/** Walk only the already validated, shallow scalar/array records. Stop before
 * serializing oversized metadata or allocating a second full catalogue string. */
function metadataSize(value: unknown, remaining: number): number {
  const pending: unknown[] = [value];
  let size = 0;
  while (pending.length && size <= remaining) {
    const item = pending.pop();
    size += typeof item === 'string' ? item.length : 1;
    if (Array.isArray(item)) pending.push(...item);
    else if (record(item)) for (const [key, child] of Object.entries(item)) { size += key.length; pending.push(child); }
  }
  return pending.length ? Infinity : size;
}

function evidenceMatches(row: HistoricalRateDescriptor, evidence: HistoricalCatalogueEvidence, section: SectionKey): boolean {
  return evidence.status === 'unknown' || (evidence.identity.dataset === section &&
    (['provider', 'product_id', 'product_key', 'category'] as const).every(key => evidence.identity[key] === row[key]));
}

/** Transport SHA/revision verification remains the caller's responsibility. */
export function validateHistoricalBankRateCatalogue(value: unknown): value is HistoricalBankRateCatalogue {
  if (!record(value) || value.schema_version !== 2 || !Array.isArray(value.run_dates) || !value.run_dates.length ||
      value.run_dates.length > HISTORICAL_CATALOGUE_LIMITS.days || !record(value.sources) || !record(value.unavailable_dates) ||
      !record(value.sections) || !Array.isArray(value.evidence) || !value.evidence.length ||
      value.evidence.length > HISTORICAL_CATALOGUE_LIMITS.evidence || !record(value.evidence[0]) || value.evidence[0].status !== 'unknown') return false;
  const dates = value.run_dates;
  if (!dates.every((day, index) => isValidCalendarDate(day) && (!index || Date.parse(day) - Date.parse(dates[index - 1]) === 86_400_000))) return false;
  const axis = new Set(dates);
  if (!Object.entries(value.sources).every(([day, source]) => axis.has(day) && validateHistoricalCatalogueSource(source)) ||
      !Object.entries(value.unavailable_dates).every(([day, reason]) => axis.has(day) && text(reason))) return false;
  let metadata = 0;
  if (!value.evidence.every(evidence => validateHistoricalCatalogueEvidence(evidence) &&
      (metadata += metadataSize(evidence, HISTORICAL_CATALOGUE_LIMITS.metadataCharacters - metadata)) <= HISTORICAL_CATALOGUE_LIMITS.metadataCharacters)) return false;
  const pack = value as unknown as HistoricalBankRateCatalogue;
  const absent = [0];
  dates.forEach(day => absent.push(absent.at(-1)! + (!Object.hasOwn(pack.sources, day) || Object.hasOwn(pack.unavailable_dates, day) ? 1 : 0)));
  let tiers = 0, spans = 0, cells = 0;
  return SECTION_KEYS.every(section => {
    const items = pack.sections[section];
    if (!Array.isArray(items) || (tiers += items.length) > HISTORICAL_CATALOGUE_LIMITS.tiers) return false;
    const identities = new Set<string>();
    return items.every(tier => {
      if (!record(tier) || !validDescriptor(tier.row) || !Array.isArray(tier.spans) ||
          (metadata += metadataSize(tier.row, HISTORICAL_CATALOGUE_LIMITS.metadataCharacters - metadata)) > HISTORICAL_CATALOGUE_LIMITS.metadataCharacters ||
          (spans += tier.spans.length) > HISTORICAL_CATALOGUE_LIMITS.spans) return false;
      const identity = bytesToHex(sha256(utf8ToBytes(rateTierSignature(tier.row as RateRow))));
      if (identities.has(identity)) return false;
      identities.add(identity);
      let end = 0;
      return tier.spans.every(span => {
        if (!Array.isArray(span) || span.length !== 4) return false;
        const [start, count, rates, evidenceId] = span;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || start < end || count < 1 || start + count > dates.length ||
            !Number.isSafeInteger(evidenceId) || evidenceId < 0 || evidenceId >= pack.evidence.length ||
            !Array.isArray(rates) || !rates.length || rates.length > HISTORICAL_CATALOGUE_LIMITS.ratesPerSpan ||
            !rates.every((rate, i) => typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && (!i || rate >= rates[i - 1])) ||
            absent[start + count] !== absent[start] || !evidenceMatches(tier.row, pack.evidence[evidenceId], section)) return false;
        end = start + count;
        cells += count * rates.length;
        return cells <= HISTORICAL_CATALOGUE_LIMITS.cells;
      });
    });
  });
}
