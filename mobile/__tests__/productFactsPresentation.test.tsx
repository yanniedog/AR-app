import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { DetailGroup, ProductFacts, ProductRatesList } from '../src/components/product/ProductDetailParts';
import { rateConditionFixture } from '../testUtils/rateConditions';
import { openProduct } from '../src/lib/nav';
import type { NormalizedProductFact, ProductDetail } from '../src/types';

let mockState: Record<string, unknown>;
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: typeof mockState) => unknown) => selector(mockState) }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/hooks/useAuditExternalLinks', () => ({ useAuditExternalLinks: jest.fn() }));
jest.mock('../src/lib/nav', () => ({ openProduct: jest.fn() }));
jest.mock('../src/components/ui', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return { AppText: 'AppText', Button: 'Button', Row: 'Row', Disclosure: ({ children, open, ...props }: any) => R.createElement('Disclosure', { ...props, open }, open ? children : null) };
});
type Node = { props: Record<string, any>; findAllByType(type: unknown): Node[]; findByProps(props: Record<string, unknown>): Node };
type Tree = ReactTestRenderer & { root: Node };
const bodyText = (tree: Tree) => tree.root.findAllByType('AppText').map(node => String(node.props.children));

// Existing productFacts.test normalized/legacy compatibility contract, not an
// observed current publication. Add a second same-key occurrence to verify it
// survives the rich fee surface rather than deduplicating charges by name.
const facts: NormalizedProductFact[] = [
  { id: 'feature-1', kind: 'feature', canonicalKey: 'OFFSET', value: true },
  { id: 'fee-1', kind: 'fee', canonicalKey: 'ANNUAL_FEE', value: 100, unit: 'AUD' },
  { id: 'fee-2', kind: 'fee', canonicalKey: 'ANNUAL_FEE', value: 0, unit: 'AUD', condition: 'With package' },
];

test('legacy Fees owns every occurrence while Product facts omits normalized fee copies', () => {
  const detail: ProductDetail = { facts, fees: [{ label: 'ANNUAL_FEE', amount: 100 }, { label: 'ANNUAL_FEE', amount: 0, info: 'With package' }] };
  const original = JSON.stringify(detail);
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<><DetailGroup title="Fees" icon="cash-outline" items={detail.fees} loading={false} /><ProductFacts productDetails={detail} /></>) as Tree; });
  try {
    act(() => tree.root.findAllByType('Disclosure').find(node => node.props.title === 'Fees')!.props.onToggle());
    act(() => tree.root.findByProps({ title: 'Product facts' }).props.onToggle());
    const text = bodyText(tree);
    expect(text.filter(value => value === '$100')).toHaveLength(1);
    expect(text.filter(value => value === '$0')).toHaveLength(1);
    expect(text.filter(value => value === 'ANNUAL_FEE')).toHaveLength(2);
    expect(text).toContain('Source review required · Source 2');
    expect(text).toContain('Offset account');
    expect(text).not.toContain('With package');
    expect(JSON.stringify(detail)).toBe(original);
  } finally { act(() => tree.unmount()); }
});

test.each([undefined, []])('normalized fee-only payload preserves both variants when legacy fees=%j', fees => {
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductFacts productDetails={{ facts: facts.slice(1), fees }} />) as Tree; });
  try {
    act(() => tree.root.findByProps({ title: 'Product facts' }).props.onToggle());
    expect(bodyText(tree)).toContain('$100');
    expect(bodyText(tree)).toContain('$0');
    expect(bodyText(tree)).toContain('Source review required · Source fee-2');
    expect(bodyText(tree)).not.toContain('With package');
  } finally { act(() => tree.unmount()); }
});

test('captured Macquarie alternate rates expose distinct factual Open labels and retain exact indices', () => {
  const fixture = rateConditionFixture();
  const rows = fixture.rows.slice(0, 2);
  const original = JSON.stringify(rows);
  mockState = { ...fixture, prefs: { mortgageRateMetric: 'headline' } };
  jest.mocked(openProduct).mockClear();
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductRatesList rows={rows} section="TD" accent="#123" defaultOpen />) as Tree; });
  try {
    const actions = tree.root.findAllByType('Button').filter(node => node.props.title === 'Open');
    expect(actions).toHaveLength(2);
    expect(new Set(actions.map(node => node.props.accessibilityLabel)).size).toBe(2);
    expect(actions[0].props.accessibilityLabel).toContain(rows[0].product_name);
    expect(actions[0].props.accessibilityLabel).toContain('Rate 5.05%');
    expect(actions[0].props.accessibilityLabel).toContain('3 mo, Rate index 1');
    expect(actions[1].props.accessibilityLabel).toContain('Rate 5.15%');
    expect(actions[1].props.accessibilityLabel).toContain('6 mo, Rate index 2');
    act(() => { actions[0].props.onPress(); actions[1].props.onPress(); });
    expect(openProduct).toHaveBeenNthCalledWith(1, fixture.productKey, 1);
    expect(openProduct).toHaveBeenNthCalledWith(2, fixture.productKey, 2);
    expect(JSON.stringify(rows)).toBe(original);
  } finally { act(() => tree.unmount()); }
});
