import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { PublicRateEvidence } from '../src/components/scenario/PublicRateEvidence';
import { AS_OF, catalogue, product, programme } from '../testUtils/publicRateJourney';
import type { PublicProgramme } from '../src/data/publicRateModel';

let mockCatalogue: any;
jest.mock('../src/data/store', () => ({ useStore: (select: (s: any) => unknown) => select({ manifest: null, prefs: {} }) }));
jest.mock('../src/data/publicRateCatalogue', () => ({ usePublicRateCatalogue: () => mockCatalogue }));
jest.mock('../src/hooks/useUserRateScenario', () => ({ useUserRateScenario: () => ({ scenario: undefined }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Disclosure: 'Disclosure' }));
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(AS_OF)); });
afterEach(() => jest.useRealTimers());
function mount(overrides: Partial<PublicProgramme> = {}) {
  const p = programme({ freshness: { state: 'stale', lastSuccessAt: '2026-10-10T03:00:00Z', reasonCodes: [] }, ...overrides });
  mockCatalogue = { ...catalogue([p]), evidence: [], loadProduct: jest.fn(async () => undefined) };
  let tree: any;
  act(() => { tree = TestRenderer.create(<PublicRateEvidence productKey={product.productKey} programmeId={p.programmeId} />); });
  return tree;
}
function buttons(tree: any) { return tree.root.findAllByType('Button'); }
test.each([
  { effectiveTo: '2026-10-12T00:00:00Z' },
  { effectiveFrom: '2026-10-16T00:00:00Z' },
  { conditions: [{ conditionId: 'amount', field: 'amount', operator: 'known' as const, evidenceIds: [] }] },
  { components: [{ ...programme().components[0], value: 'invalid' }] },
])('a non-freshness barrier does not offer an ineffective historical action: %p', overrides => {
  const tree = mount(overrides);
  try { expect(buttons(tree).filter((node: any) => node.props.title === 'Historical pricing assumption')).toHaveLength(0); }
  finally { act(() => tree.unmount()); }
});
test('freshness-only failure offers a working historical assumption and reversible current pricing', () => {
  const tree = mount();
  try {
    const button = buttons(tree).find((node: any) => node.props.title === 'Historical pricing assumption');
    expect(button).toBeDefined();
    act(() => button.props.onPress());
    expect(tree.root.findByType('Disclosure').props.title).not.toContain('Pricing unresolved');
    const current = buttons(tree).find((node: any) => node.props.title === 'Current pricing');
    expect(current).toBeDefined();
    act(() => current.props.onPress());
    expect(tree.root.findByType('Disclosure').props.title).toContain('Pricing unresolved');
  } finally { act(() => tree.unmount()); }
});
