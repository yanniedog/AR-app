import type { NormalizedProductFact, ProductDetail } from '../types';

function semanticIdentity(fact: NormalizedProductFact): string {
  return JSON.stringify(Object.entries(fact).filter(([key]) => key !== 'sourcePath' && key !== 'sourcePathBasis')
    .sort(([a], [b]) => a.localeCompare(b)));
}

/** Feature semantics remain the admitted financial details' conservative facts.
 * Only identical source-bound copies can add an original-document pointer. */
export function projectProductCriteria(legacy: ProductDetail | undefined, descriptive: ProductDetail): ProductDetail {
  const criteria = (descriptive.facts ?? []).filter(fact => fact.kind !== 'feature');
  const enrichedKeys = new Set(criteria.map(fact => `${fact.kind}:${fact.canonicalKey}`));
  const features = new Map((descriptive.facts ?? []).filter(fact => fact.kind === 'feature').map(fact => [fact.id, fact]));
  const facts = (legacy?.facts ?? []).filter(fact => fact.kind === 'feature' || !enrichedKeys.has(`${fact.kind}:${fact.canonicalKey}`))
    .map(fact => {
      const annotation = fact.kind === 'feature' && features.get(fact.id);
      return annotation && annotation.sourcePathBasis === 'raw-cdr' && annotation.sourcePath
        && semanticIdentity(annotation) === semanticIdentity(fact)
        ? { ...fact, sourcePath: annotation.sourcePath, sourcePathBasis: annotation.sourcePathBasis } : fact;
    });
  return { ...legacy, ...descriptive, facts: [...facts, ...criteria] };
}
