import { projectProductCriteria } from '../src/data/productCriteriaProjection';
import type { NormalizedProductFact } from '../src/types';

const feature: NormalizedProductFact = { id: 'feature-control', kind: 'feature', canonicalKey: 'feature.offset', value: true, unit: 'boolean' };
const pointer = { sourcePath: '/features/3', sourcePathBasis: 'raw-cdr' as const };
test('adds only a pointer from a semantically identical feature copy and preserves core scoped facts', () => {
  const rate: NormalizedProductFact = { id: 'rate-control', kind: 'rate', canonicalKey: 'rate.variable', value: '0.05' };
  const legacy = { facts: [feature, rate] };
  expect(projectProductCriteria(legacy, { facts: [{ ...feature, ...pointer }] }).facts).toEqual([{ ...feature, ...pointer }, rate]);
  expect(legacy.facts).toEqual([feature, rate]);
  expect(projectProductCriteria(legacy, { facts: [{ ...feature, ...pointer, value: false }] }).facts).toEqual(legacy.facts);
  expect(projectProductCriteria(undefined, { facts: [{ ...feature, ...pointer }] }).facts).toEqual([]);
});
