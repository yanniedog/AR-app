import { utf8ToBytes } from '@noble/hashes/utils';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { Decimal } from '../../lib/productTermsEngine/decimal';
import { validFact, safeId } from '../customerProfile';
import type { Rule } from '../../lib/productTermsEngine/types';
import { assertWire } from './schemaValidation';
import type { ExecutableTemplate, ExecutableAsset } from './types';
export const identity = (v: object, field: string): string => hashText(canonical(Object.fromEntries(Object.entries(v).filter(([k]) => k !== field))));
export function validateTemplate(raw: unknown): ExecutableTemplate {
  if (utf8ToBytes(JSON.stringify(raw)).length > 256 * 1024) throw new Error('Template exceeds limit');
  assertWire(raw, 'template'); const t = raw as ExecutableTemplate;
  if (identity(t, 'id') !== t.id || t.effectiveFrom >= t.effectiveToExclusive || (t.term.unit === 'months' && t.term.count > 120) || (t.term.unit === 'days' && t.term.count > 3660)) throw new Error('Template identity or scope invalid');
  const { minimum, maximum } = t.principalBounds;
  if ('value' in minimum && 'value' in maximum && (Decimal.parse(minimum.value).compare(Decimal.parse(maximum.value)) > 0 || (Decimal.parse(minimum.value).compare(Decimal.parse(maximum.value)) === 0 && (!minimum.inclusive || !maximum.inclusive)))) throw new Error('Principal bounds inverted');
  const refs = new Set<string>();
  for (const e of t.evidence) {
    const url = new URL(e.sourceUrl);
    if (refs.has(e.id) || e.id !== e.clauseId || !t.documentVersionIds.includes(e.documentVersionId) || url.protocol !== 'https:' || url.username || url.password || hashText(e.quote) !== e.quoteSha256) throw new Error('Template evidence invalid');
    refs.add(e.id);
  }
  const checkRefs = (ids: string[]) => { if (ids.some(id => !refs.has(id))) throw new Error('Template clause missing'); };
  Object.values(t.fieldClauseIds).forEach(checkRefs);
  const definitions = new Map(t.inputDefinitions.map(d => [d.key, d]));
  if (definitions.size !== t.inputDefinitions.length) throw new Error('Duplicate input');
  for (const binding of ['deposit_principal', 'funded_date', 'maturity_date']) if (t.inputDefinitions.filter(d => d.binding === binding).length !== 1) throw new Error('Scenario binding missing');
  for (const d of t.inputDefinitions) {
    checkRefs(d.clauseIds);
    if (!safeId(d.key) || !d.label.trim() || (d.type === 'decimal' ? !d.unit?.trim() : d.unit !== null) ||
      (d.binding === 'deposit_principal' && (d.type !== 'decimal' || d.unit !== 'AUD')) ||
      (['funded_date', 'maturity_date'].includes(d.binding) && d.type !== 'date')) throw new Error('Input definition invalid');
  }
  const ids = new Set<string>(); let nodes = 0;
  function rule(r: Rule, depth: number) {
    if (++nodes > 512 || depth > 16 || ids.has(r.id) || !safeId(r.id)) throw new Error('Eligibility rule limit'); ids.add(r.id);
    if (r.op === 'and' || r.op === 'or') r.rules.forEach(child => rule(child, depth + 1));
    else if (r.op === 'not') rule(r.rule, depth + 1);
    else if (r.op === 'compare') {
      const d = definitions.get(r.field); checkRefs(r.evidenceIds!);
      if (!d || !validFact(r.expected) || d.type !== r.expected.type || (r.expected.type === 'decimal' && d.unit !== r.expected.unit) || (!['eq','ne'].includes(r.comparison) && !['decimal','date'].includes(d.type))) throw new Error('Eligibility input mismatch');
    } else throw new Error('Unsupported eligibility');
  }
  rule(t.eligibility, 0); return t;
}
export function validateAsset(raw: unknown): ExecutableAsset {
  if (utf8ToBytes(JSON.stringify(raw)).length > 512 * 1024) throw new Error('Executable asset exceeds limit');
  assertWire(raw, 'asset'); const a = raw as ExecutableAsset;
  if (identity(a, 'identitySha256') !== a.identitySha256) throw new Error('Executable asset identity mismatch');
  const ids = new Set<string>();
  for (const entry of a.templates) {
    const t = validateTemplate(entry.template);
    if (ids.has(t.id) || entry.approval.templateId !== t.id || !Number.isFinite(Date.parse(entry.approval.reviewedAt)) || t.productKey !== a.productKey || t.runDate !== a.runDate || t.sourceGenerationId !== a.sourceGenerationId || t.selectedRate.coreAssetSha256 !== a.coreAssetSha256) throw new Error('Approval association mismatch');
    ids.add(t.id);
  }
  return a;
}
