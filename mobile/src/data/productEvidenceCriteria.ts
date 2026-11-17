/** Descriptive source criteria. No pricing, eligibility, or absence inference. */
import { parseBoundedEvidenceJson } from './productEvidenceJson';
import { EvidenceError, type EvidenceFact } from './productEvidenceWire';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export const CRITERIA_KINDS = ['all', 'fee', 'eligibility', 'constraint', 'feature', 'rate', 'tier', 'condition', 'attribute', 'bundle'] as const;
export type CriteriaKind = (typeof CRITERIA_KINDS)[number];
export interface CriteriaQuery { kind: CriteriaKind; text: string; record: number; page: number; alignment?: string }
export type CriterionState = 'observed' | 'conditional' | 'conflicting' | 'source_review' | 'ambiguous';
export interface CriteriaProjection {
  total: number; matching: number; typed: number; conditional: number; unsupported: number;
  record: number; sourceRecord: number | null; state: CriterionState | 'unknown';
  alignment: string | null;
  page: number; pages: number; start: number; end: number; characters: number; text: string;
}
const CHARACTERS = 4096;
const NUMERIC = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const CHECK_FIELDS = ['canonical_key', 'source_path', 'source_pattern', 'value_json', 'source_value_json', 'qualifiers_json'] as const;

export function checkedCriteriaQuery(query: CriteriaQuery): CriteriaQuery {
  if (!query || !CRITERIA_KINDS.includes(query.kind) || typeof query.text !== 'string' || query.text.length > 256 ||
      !Number.isSafeInteger(query.record) || query.record < 0 || !Number.isSafeInteger(query.page) || query.page < 0 ||
      (query.alignment !== undefined && !/^[a-f0-9]{64}$/.test(query.alignment))) {
    throw new EvidenceError('invalid', 'Invalid source criteria query');
  }
  return { ...query };
}
function metadata(fact: EvidenceFact) {
  const qualifiers = parseBoundedEvidenceJson(fact.qualifiers_json, 512 * 1024) as Record<string, unknown>;
  if (!qualifiers || typeof qualifiers !== 'object' || Array.isArray(qualifiers)) throw new EvidenceError('invalid', 'Invalid criteria scope');
  const conditional = /(?:applicabilityConditions|discounts|eligibility)\[/.test(fact.source_path) ||
    ['additionalInfo', 'description', 'title'].some(key => typeof qualifiers[key] === 'string' && qualifiers[key] !== '');
  // JSON lexemes remain strings. In particular, never round source money/integers through Number().
  const typed = fact.mapping === 'canonical' && (
    (fact.value_type === 'boolean' && fact.unit === 'boolean' && ['true', 'false'].includes(fact.value_json)) ||
    (fact.value_type === 'money' && /^[A-Z]{3}$/.test(fact.unit) && NUMERIC.test(fact.value_json)) ||
    (fact.value_type === 'rate' && fact.unit === 'fraction' && NUMERIC.test(fact.value_json)) ||
    (fact.value_type === 'number' && ['count', 'day', 'month', 'year'].includes(fact.unit) && NUMERIC.test(fact.value_json)) ||
    (fact.value_type === 'enum' && fact.unit === 'enum' && fact.value_json.startsWith('"')) ||
    (fact.value_type === 'duration' && fact.unit === 'duration' && /^"P[0-9YMWDTHS.]+"$/.test(fact.value_json)));
  // Original scope text keeps group/parent and numeric precision; no parsed scope may collapse large integers.
  const scope = JSON.stringify([fact.kind, fact.canonical_key, fact.unit, fact.value_type, fact.source_pattern,
    fact.group_id, fact.parent_id, fact.qualifiers_json, fact.min_value_json, fact.max_value_json]);
  return { typed, conditional, scope, alignment: typed ? comparisonScope(fact, qualifiers) : null };
}
const scopeDigest = (scope: string) => bytesToHex(sha256(utf8ToBytes(scope)));
/** Resolve only these known product-root entities. Nested conditional parents stay unknown. */
function comparisonScope(fact: EvidenceFact, qualifiers: Record<string, unknown>): string | null {
  const path = /^(fees|features|eligibility|constraints)\[\d+\]\.([A-Za-z]+|fixedAmount\.(?:amount|currency))$/.exec(fact.source_path);
  if (!path || fact.source_pattern !== fact.source_path.replace(/\[\d+\]/g, '[]') || fact.group_id || fact.parent_id) return null;
  const discriminator = { fees: 'feeType', features: 'featureType', eligibility: 'eligibilityType', constraints: 'constraintType' }[path[1]]!;
  const sourceType = qualifiers[discriminator] ?? qualifiers.sourceType;
  if (typeof sourceType !== 'string' || !sourceType || (path[2].includes('.') && qualifiers.feeMethodUType !== 'fixedAmount')) return null;
  const values: [string, string][] = [];
  const threshold = ['constraint.min_balance', 'constraint.max_balance', 'eligibility.min_age'].includes(fact.canonical_key);
  for (const key of Object.keys(qualifiers).sort()) {
    const value = qualifiers[key];
    if (key === 'groupId' || key === 'parentId') { if (typeof value !== 'string' || !/^[a-f0-9]{16}$/.test(value)) return null; continue; }
    if (key === 'sourcePattern') { if (value !== fact.source_pattern) return null; continue; }
    // This is the value being compared, not a scope discriminator. Original text remains displayed.
    if (key === 'additionalValue' && (threshold || path[2] === 'additionalValue')) continue;
    // Never round or flatten unfamiliar qualifiers into a supposedly equivalent scope.
    if (typeof value !== 'string') return null;
    values.push([key, value]);
  }
  return scopeDigest(JSON.stringify([fact.kind, fact.canonical_key, fact.unit, fact.value_type, fact.source_pattern, sourceType, values]));
}
function matches(fact: EvidenceFact, query: CriteriaQuery, needle: string) {
  return (query.kind === 'all' || fact.kind === query.kind) && (!needle || CHECK_FIELDS.some(key => fact[key].toLocaleLowerCase().includes(needle)));
}
function textSlice(text: string, page: number) {
  const pages = Math.max(1, Math.ceil(text.length / CHARACTERS));
  // A shared comparison page may exceed a shorter column. Keep its real count; never block longer columns.
  if (page >= pages) return { page, pages, start: text.length, end: text.length, characters: text.length, text: '' };
  const boundary = (at: number) => at > 0 && at < text.length && /[\uD800-\uDBFF]/.test(text[at - 1]) && /[\uDC00-\uDFFF]/.test(text[at]) ? at - 1 : at;
  const start = boundary(page * CHARACTERS), end = boundary(Math.min(text.length, (page + 1) * CHARACTERS));
  return { page, pages, start, end, characters: text.length, text: text.slice(start, end) };
}
/** Every field is retained in literal pages, including unsupported mappings and precision. */
export function criteriaRecordText(fact: EvidenceFact): string {
  return Object.entries(fact).map(([key, value]) => `${key}: ${value}`).join('\n');
}
export async function projectSourceCriteria(facts: readonly EvidenceFact[], queryValue: CriteriaQuery,
  checkpoint: () => Promise<void>): Promise<CriteriaProjection> {
  const query = checkedCriteriaQuery(queryValue), needle = query.text.toLocaleLowerCase();
  let matching = 0, typed = 0, conditional = 0, unsupported = 0, selected: EvidenceFact | null = null, sourceRecord: number | null = null;
  for (let at = 0; at < facts.length; at++) {
    if (at % 64 === 0) await checkpoint();
    const fact = facts[at], meta = metadata(fact);
    if (meta.typed) typed++; else unsupported++;
    if (meta.conditional) conditional++;
    if (matches(fact, query, needle) && (!query.alignment || meta.alignment === query.alignment)) {
      if (matching === query.record) { selected = fact; sourceRecord = at; } matching++;
    }
  }
  const counts = { total: facts.length, matching, typed, conditional, unsupported, record: query.record, sourceRecord };
  if (!selected) return { ...counts, alignment: null, state: 'unknown', page: 0, pages: 0, start: 0, end: 0, characters: 0, text: '' };
  const meta = metadata(selected);
  let state: CriterionState = !meta.typed ? 'source_review' : meta.conditional ? 'conditional' : 'observed';
  // Only an exact-scope explicit boolean contradiction is inferred. Different numeric lexemes/scopes are not comparable evidence.
  if (state === 'observed' && selected.value_type === 'boolean') {
    for (let at = 0; at < facts.length; at++) {
      if (at % 64 === 0) await checkpoint();
      const other = facts[at];
      if (other.value_type !== 'boolean' || other.value_json === selected.value_json) continue;
      const otherMeta = metadata(other);
      if (otherMeta.typed && !otherMeta.conditional && otherMeta.scope === meta.scope) { state = 'conflicting'; break; }
    }
  }
  await checkpoint();
  if (query.alignment && matching > 1 && state !== 'conflicting') state = 'ambiguous';
  return { ...counts, alignment: meta.alignment, state, ...textSlice(criteriaRecordText(selected), query.page) };
}
