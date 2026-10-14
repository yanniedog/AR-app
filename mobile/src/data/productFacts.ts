import { featureEvidenceScope, normalizedProductFacts, productMatchesFactCriterion, factCriterionId, productFactSignature, factOptionCriterion as optionCriterion, isFactScalar as isScalar, type FactCriterion } from './productFactsCore';
import { humanizeEnum } from './format';
import { uiNormalizedProductFact } from '../lib/productUiFacts';
import { uiCount, uiJoin, uiLabel, type UiLabel, type UiText } from '../lib/uiCopy';
import type {
  NormalizedProductFact,
  NormalizedProductFactKind,
  ProductDetail,
  RateRow,
  SectionKey,
} from '../types';
export * from './productFactsCore';

export interface PublishedFactFilterOption {
  id: string;
  label: UiText;
  criterion: FactCriterion;
}

const MAX_SEARCH_TERMS = 16;
const MAX_SEARCH_FIELD_LENGTH = 240;

function safeSearchText(value: unknown, rejectUrl = false): string | null {
  if (!isScalar(value)) return null;
  const text = String(value).trim().slice(0, MAX_SEARCH_FIELD_LENGTH);
  if (!text) return null;
  if (rejectUrl && /(?:https?:\/\/|www\.|:\/\/)/i.test(text)) return null;
  return text;
}

/** Explicit searchable fields only; ids, source enums and unknown object text stay private. */
export function productFactsSearchText(detail: ProductDetail | null | undefined): string[] {
  const chunks: string[] = [];
  for (const fact of normalizedProductFacts(detail)) {
    chunks.push(fact.canonicalKey);
    const label = safeSearchText(fact.label);
    chunks.push(label ?? humanizeEnum(fact.canonicalKey.split(/[.:/]/).filter(Boolean).at(-1) ?? fact.canonicalKey));
    for (const value of [fact.value, fact.minValue, fact.maxValue]) {
      const text = safeSearchText(value);
      if (text) chunks.push(text);
    }
    for (const value of fact.appliesTo?.slice(0, MAX_SEARCH_TERMS) ?? []) {
      const text = safeSearchText(value);
      if (text) chunks.push(text, humanizeEnum(text));
    }
    const condition = safeSearchText(fact.condition);
    if (condition) chunks.push(condition);
    for (const value of fact.searchTerms?.slice(0, MAX_SEARCH_TERMS) ?? []) {
      const text = safeSearchText(value, true);
      if (text) chunks.push(text);
    }
  }
  return chunks;
}

export function productFactValue(fact: NormalizedProductFact): UiText | null {
  if (fact.value === undefined && fact.minValue === undefined && fact.maxValue === undefined && !fact.cadence) return null;
  return uiNormalizedProductFact(fact).value;
}
export function productFactLabel(fact: NormalizedProductFact): UiText {
  return uiJoin(uiNormalizedProductFact(fact).label);
}

function criterionOptionLabel(fact: NormalizedProductFact, criterion: FactCriterion): UiText {
  const label = productFactLabel(fact);
  if (criterion.operator === 'exists' || criterion.value === true) return label;
  if (criterion.value === false) return uiJoin('No', ' ', label);
  const value = productFactValue(fact);
  if (!value) return label;
  return uiJoin(label, ': ', value);
}

/** Curated, bounded model for the collapsed FilterSheet disclosure. */
export function publishedFactFilterOptions(
  rows: RateRow[],
  lookup: Record<string, ProductDetail> | null | undefined,
  section?: SectionKey,
): PublishedFactFilterOption[] {
  if (!lookup) return [];
  const options = new Map<string, PublishedFactFilterOption>();
  const seenProducts = new Set<string>();
  for (const row of rows) {
    const scope = featureEvidenceScope(row.product_key, row, section);
    const scopeKey = JSON.stringify(scope);
    if (seenProducts.has(scopeKey)) continue;
    seenProducts.add(scopeKey);
    for (const fact of normalizedProductFacts(lookup[row.product_key])) {
      const criterion = optionCriterion(fact);
      if (!criterion) continue;
      if (fact.kind === 'feature' && !productMatchesFactCriterion(lookup[row.product_key], criterion, scope)) continue;
      const id = factCriterionId(criterion);
      if (!options.has(id)) options.set(id, { id, label: criterionOptionLabel(fact, criterion), criterion });
    }
  }
  return [...options.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }),
  );
}

function selectedCriterionOption(criterion: FactCriterion): PublishedFactFilterOption {
  const id = factCriterionId(criterion);
  const rawLabel = criterion.sourceType
    ?? criterion.canonicalKey?.split('.').filter(Boolean).at(-1)
    ?? 'Product';
  const label = humanizeEnum(rawLabel) || uiLabel('Product');
  if (criterion.operator === 'exists' || criterion.value === true) return { id, label, criterion };
  if (criterion.value === false) return { id, label: uiJoin('No', ' ', label), criterion };
  const displayValue = productFactValue({
    id,
    kind: 'attribute',
    canonicalKey: criterion.canonicalKey ?? criterion.sourceType ?? 'published.detail',
    label,
    value: criterion.value,
    unit: criterion.unit,
  });
  return {
    id,
    label: displayValue ? uiJoin(label, ': ', displayValue) : label,
    criterion,
  };
}

/** Keep every applied criterion visible/removable, then fill the remaining
 * bounded disclosure capacity with available unselected options. */
export function boundedPublishedFactFilterOptions(
  options: readonly PublishedFactFilterOption[],
  selected: readonly FactCriterion[],
  limit = 32,
): PublishedFactFilterOption[] {
  const available = new Map(options.map((option) => [option.id, option]));
  const selectedOptions = selected.map((criterion) => {
    const id = factCriterionId(criterion);
    return available.get(id) ?? selectedCriterionOption(criterion);
  });
  const selectedIds = new Set(selectedOptions.map((option) => option.id));
  const remaining = options.filter((option) => !selectedIds.has(option.id));
  return [...selectedOptions, ...remaining.slice(0, Math.max(0, limit - selectedOptions.length))];
}

export interface ProductFactGroup {
  key: 'product' | 'features' | 'eligibility' | 'fees';
  title: UiLabel;
  facts: NormalizedProductFact[];
}

export interface ProductFactCluster {
  id: string;
  label: UiText;
  summary: UiText;
  facts: NormalizedProductFact[];
}

export interface ProductFactDisplayModel {
  groups: ProductFactGroup[];
  rateClusters: ProductFactCluster[];
}

const GROUPS: (Omit<ProductFactGroup, 'facts'> & { kinds: Set<NormalizedProductFactKind> })[] = [
  { key: 'product', title: 'Product facts', kinds: new Set(['rate', 'tier', 'bundle', 'attribute']) },
  { key: 'features', title: 'Features', kinds: new Set(['feature']) },
  { key: 'eligibility', title: 'Eligibility', kinds: new Set(['eligibility', 'constraint', 'condition']) },
  { key: 'fees', title: 'Fees', kinds: new Set(['fee']) },
];

export function groupProductFacts(
  detail: ProductDetail | null | undefined,
  options?: { excludeFees?: boolean },
): ProductFactGroup[] {
  const facts = normalizedProductFacts(detail);
  return GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    facts: facts.filter((fact) => group.kinds.has(fact.kind) && !(options?.excludeFees && fact.kind === 'fee')),
  })).filter((group) => group.facts.length > 0);
}

function factAssociationId(
  fact: NormalizedProductFact,
  byId: Map<string, NormalizedProductFact>,
): string | null {
  if (fact.groupId) return `group:${fact.groupId}`;
  if (!fact.parentId) return null;
  const parent = byId.get(fact.parentId);
  return parent?.groupId ? `group:${parent.groupId}` : `parent:${fact.parentId}`;
}

function clusterLabel(_facts: NormalizedProductFact[], index: number): UiText { return uiJoin('Tier', ' ', uiCount(index + 1)); }
function clusterSummary(facts: NormalizedProductFact[]): UiText {
  const values = facts.filter(fact => fact.kind === 'tier').map(productFactValue).filter((value): value is UiText => Boolean(value));
  const conditions = facts.filter(fact => fact.kind === 'condition' && fact.condition?.trim()).length;
  return uiJoin(...values.flatMap((value, i) => i ? [uiLabel(' · '), value] : [value]), conditions ? uiJoin(' · ', uiCount(conditions), ' ', 'Conditions') : null);
}

/**
 * Calm detail-page model. Rate/tier clusters stay associated and collapsed;
 * raw advertised/comparison rate facts remain searchable but are not repeated
 * beside the product hero and legacy ProductRatesList.
 */
export function productFactDisplayModel(
  detail: ProductDetail | null | undefined,
  options?: { excludeFees?: boolean },
): ProductFactDisplayModel {
  const facts = normalizedProductFacts(detail);
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  const associated = new Map<string, NormalizedProductFact[]>();
  for (const fact of facts) {
    const id = factAssociationId(fact, byId);
    if (!id) continue;
    const group = associated.get(id) ?? [];
    group.push(fact);
    associated.set(id, group);
  }
  const clusteredSignatures = new Set<string>();
  const rateClusters = [...associated.entries()]
    .filter(([, group]) => group.some((fact) => fact.kind === 'rate' || fact.kind === 'tier'))
    .map(([id, group], index) => {
      group.forEach((fact) => clusteredSignatures.add(productFactSignature(fact)));
      // The exact advertised/comparison figures already appear in the product
      // hero/rate list. Keep their tier relationship without repeating them.
      const displayFacts = group.filter(
        (fact) => fact.kind !== 'rate' && !(options?.excludeFees && fact.kind === 'fee'),
      );
      return {
        id,
        label: clusterLabel(group, index),
        summary: clusterSummary(group),
        facts: displayFacts,
      };
    })
    .filter((cluster) => cluster.facts.length > 0);

  const groups = groupProductFacts(detail, options)
    .map((group) => ({
      ...group,
      facts: group.facts.filter((fact) =>
        fact.kind !== 'rate' &&
        !(fact.kind === 'tier' && clusteredSignatures.has(productFactSignature(fact))) &&
        !clusteredSignatures.has(productFactSignature(fact)),
      ),
    }))
    .filter((group) => group.facts.length > 0 || (group.key === 'product' && rateClusters.length > 0));
  if (rateClusters.length > 0 && !groups.some((group) => group.key === 'product')) {
    groups.unshift({ key: 'product', title: 'Product facts', facts: [] });
  }
  return { groups, rateClusters };
}
