import { isValidCalendarDate } from '../lib/calendarDate';

/** Additive public evidence contract. Raw document bodies remain on the producer. */
export const TERMS_STAGES = ['discovery', 'acquisition', 'extraction', 'interpretation', 'calculation'] as const;
export type TermsStage = typeof TERMS_STAGES[number];
export type TermsStageStatus = 'unknown' | 'pending' | 'partial' | 'complete' | 'failed' | 'not_applicable';
export interface TermsStageCoverage {
  status: TermsStageStatus;
  expected: number | null;
  observed: number;
}
export type TermsCoverage = Record<TermsStage, TermsStageCoverage> & { gaps: string[] };
export interface DocumentVersion {
  document_version_id: string;
  source_url: string;
  content_sha256: string;
  media_type: string;
  byte_size: number;
  observed_at: string;
  effective_from: string | null;
  effective_to: string | null;
}
export interface SourceClause {
  clause_id: string;
  document_version_id: string;
  locator: { start: number; end: number; page?: number; section?: string };
  text: string;
  excerpt_truncated?: boolean;
  disposition: 'uninterpreted' | 'interpreted' | 'not_applicable';
  reason?: string;
}
/** Null means unknown scope, never universal applicability. */
export interface ProductApplicability {
  product_key: string;
  tier: string | null;
  package: string | null;
  cohort: string | null;
  effective_from: string | null;
  effective_to: string | null;
}
export interface TermRevision {
  term_revision_id: string;
  parameter_key: string;
  value: unknown;
  unit: string | null;
  applicability: ProductApplicability;
  clause_ids: string[];
  rule_set_id: string | null;
  status: 'validated';
  observed_at: string;
}
export interface TermChange {
  term_change_id: string;
  before_revision_id: string | null;
  after_revision_id: string | null;
  kind: 'added' | 'changed' | 'removed' | 'extraction_corrected';
  observed_at: string;
}
export interface ProductTerms {
  schema_version: 1;
  product_key: string;
  identity_sha256: string;
  documents: DocumentVersion[];
  clauses: SourceClause[];
  revisions: TermRevision[];
  coverage: TermsCoverage;
  changes: TermChange[];
}

const SHA = /^[a-f0-9]{64}$/;
const STATUSES: TermsStageStatus[] = ['unknown', 'pending', 'partial', 'complete', 'failed', 'not_applicable'];
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid product terms: ${message}`);
}
function record(value: unknown): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), 'expected object');
  return value as Record<string, unknown>;
}
function fields(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  const row = record(value);
  requireValue(required.every((key) => Object.hasOwn(row, key)), 'missing fields');
  requireValue(Object.keys(row).every((key) => required.includes(key) || optional.includes(key)), 'unknown fields');
  return row;
}
function text(value: unknown): value is string { return typeof value === 'string'; }
function sha(value: unknown): value is string { return text(value) && SHA.test(value); }
function nullableText(value: unknown): boolean { return value === null || text(value); }
function effectiveDate(value: unknown): { precision: 'day' | 'instant'; order: bigint } | null {
  if (value === null) return null;
  requireValue(text(value), 'applicability calendar dates');
  if (isValidCalendarDate(value)) return { precision: 'day', order: BigInt(Date.parse(value)) * 1000n };
  const parts = /^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,6}))?(Z|[+-][0-9]{2}:[0-9]{2})$/.exec(value);
  requireValue(parts && isValidCalendarDate(parts[1]) && Number(parts[2]) < 24
    && Number(parts[3]) < 60 && Number(parts[4]) < 60, 'applicability calendar dates');
  const zone = parts[6];
  requireValue(zone === 'Z' || (Number(zone.slice(1, 3)) < 24 && Number(zone.slice(4)) < 60), 'applicability timezone');
  const millis = Date.parse(`${parts[1]}T${parts[2]}:${parts[3]}:${parts[4]}${zone}`);
  requireValue(Number.isFinite(millis), 'applicability calendar dates');
  return { precision: 'instant', order: BigInt(millis) * 1000n + BigInt((parts[5] ?? '').padEnd(6, '0')) };
}
function validateEffectiveDates(row: Record<string, unknown>): void {
  const from = effectiveDate(row.effective_from), to = effectiveDate(row.effective_to);
  if (from === null || to === null) return;
  requireValue(from.precision === to.precision, 'mixed applicability date precision');
  // Frozen producer evidence intervals permit equal endpoints; do not invent
  // exclusive-end semantics or discard source timezone/microsecond precision.
  requireValue(from.order <= to.order, 'reversed applicability interval');
}
function timestamp(value: unknown): boolean {
  return text(value) && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}
function integer(value: unknown, minimum = 0): boolean {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}
function array(value: unknown): unknown[] {
  requireValue(Array.isArray(value), 'expected array');
  return value;
}
function uniqueIds(values: unknown[], key: string): Set<string> {
  const ids = values.map((value) => record(value)[key]);
  requireValue(ids.every(sha) && new Set(ids).size === ids.length, 'duplicate or invalid identifiers');
  return new Set(ids as string[]);
}

function validateDocument(value: unknown): void {
  const row = fields(value, ['document_version_id', 'source_url', 'content_sha256', 'media_type', 'byte_size', 'observed_at', 'effective_from', 'effective_to']);
  requireValue(sha(row.document_version_id) && sha(row.content_sha256) && text(row.media_type) && integer(row.byte_size, 1), 'document metadata');
  let url: URL;
  try { url = new URL(String(row.source_url)); } catch { throw new Error('Invalid product terms: source URL'); }
  requireValue(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, 'source URL');
  requireValue(timestamp(row.observed_at), 'document observation date');
  validateEffectiveDates(row);
}
function validateClause(value: unknown, documents: Set<string>): void {
  const row = fields(value, ['clause_id', 'document_version_id', 'locator', 'text', 'disposition'], ['excerpt_truncated', 'reason']);
  requireValue(documents.has(String(row.document_version_id)) && text(row.text) && Array.from(row.text).length > 0 && Array.from(row.text).length <= 2000, 'clause source');
  requireValue(['uninterpreted', 'interpreted', 'not_applicable'].includes(String(row.disposition)), 'clause disposition');
  const locator = fields(row.locator, ['start', 'end'], ['page', 'section']);
  requireValue(integer(locator.start) && integer(locator.end, 1) && Number(locator.end) > Number(locator.start), 'clause offsets');
  requireValue(locator.page === undefined || integer(locator.page, 1), 'page');
  requireValue(locator.section === undefined || text(locator.section), 'section');
  requireValue(row.reason === undefined || text(row.reason), 'clause reason');
  requireValue(row.excerpt_truncated === undefined || typeof row.excerpt_truncated === 'boolean', 'excerpt flag');
}
function validateRevision(value: unknown, productKey: string, clauses: Set<string>): void {
  const row = fields(value, ['term_revision_id', 'parameter_key', 'value', 'unit', 'applicability', 'clause_ids', 'rule_set_id', 'status', 'observed_at']);
  requireValue(row.status === 'validated' && text(row.parameter_key) && row.parameter_key.length > 0, 'unvalidated revision');
  requireValue(nullableText(row.unit) && (row.rule_set_id === null || sha(row.rule_set_id)) && timestamp(row.observed_at), 'revision metadata');
  const refs = array(row.clause_ids);
  requireValue(refs.length > 0 && new Set(refs).size === refs.length && refs.every((id) => clauses.has(String(id))), 'revision source references');
  const scope = fields(row.applicability, ['product_key', 'tier', 'package', 'cohort', 'effective_from', 'effective_to']);
  requireValue(scope.product_key === productKey && Object.entries(scope).every(([key, item]) => key === 'product_key' || nullableText(item)), 'revision scope');
  validateEffectiveDates(scope);
}
function validateCoverage(value: unknown): void {
  const row = fields(value, [...TERMS_STAGES, 'gaps']);
  requireValue(array(row.gaps).every(text), 'coverage gaps');
  for (const stage of TERMS_STAGES) {
    const item = fields(row[stage], ['status', 'expected', 'observed']);
    requireValue(STATUSES.includes(item.status as TermsStageStatus) && integer(item.observed) && (item.expected === null || integer(item.expected)), 'coverage stage');
    requireValue(item.status !== 'complete' || (item.expected !== null && item.observed === item.expected), 'unmeasured completeness');
  }
}
function validateChange(value: unknown): void {
  const row = fields(value, ['term_change_id', 'before_revision_id', 'after_revision_id', 'kind', 'observed_at']);
  requireValue(['added', 'changed', 'removed', 'extraction_corrected'].includes(String(row.kind)) && timestamp(row.observed_at), 'change');
  requireValue((row.before_revision_id === null || sha(row.before_revision_id)) && (row.after_revision_id === null || sha(row.after_revision_id)), 'change revisions');
  requireValue(row.before_revision_id !== null || row.after_revision_id !== null, 'change without revisions');
}

/** Public data is evidence only. Validation never authorizes executable rules. */
export function validateProductTerms(raw: unknown, productKey: string): ProductTerms {
  const obj = fields(raw, ['schema_version', 'product_key', 'identity_sha256', 'documents', 'clauses', 'revisions', 'coverage', 'changes']);
  requireValue(obj.schema_version === 1 && obj.product_key === productKey && sha(obj.identity_sha256), 'envelope identity');
  const documents = array(obj.documents), clauses = array(obj.clauses), revisions = array(obj.revisions), changes = array(obj.changes);
  const documentIds = uniqueIds(documents, 'document_version_id');
  const clauseIds = uniqueIds(clauses, 'clause_id');
  uniqueIds(revisions, 'term_revision_id'); uniqueIds(changes, 'term_change_id');
  documents.forEach(validateDocument);
  clauses.forEach((clause) => validateClause(clause, documentIds));
  revisions.forEach((revision) => validateRevision(revision, productKey, clauseIds));
  changes.forEach(validateChange);
  validateCoverage(obj.coverage);
  canonicalTermsJson(raw); // Reject floats/non-JSON values before any use.
  return obj as unknown as ProductTerms;
}

function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a), right = Array.from(b);
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const difference = left[index].codePointAt(0)! - right[index].codePointAt(0)!;
    if (difference) return difference;
  }
  return left.length - right.length;
}

/** Cross-runtime identity: Unicode code-point key order; decimals are strings. */
export function canonicalTermsJson(raw: unknown): string {
  if (raw === null || typeof raw === 'string' || typeof raw === 'boolean') return JSON.stringify(raw);
  if (typeof raw === 'number') {
    requireValue(Number.isSafeInteger(raw), 'numeric quantities must be integers or decimal strings');
    return JSON.stringify(raw);
  }
  if (Array.isArray(raw)) return `[${raw.map(canonicalTermsJson).join(',')}]`;
  const obj = record(raw);
  return `{${Object.keys(obj).sort(compareCodePoints).map((key) => `${JSON.stringify(key)}:${canonicalTermsJson(obj[key])}`).join(',')}}`;
}
