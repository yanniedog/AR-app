import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { DetailGroup, ProductFacts } from '../src/components/product/ProductDetailParts';
import { ProductPageLinks } from '../src/components/product/ProductPageLink';
import type { NormalizedProductFact, ProductDetail } from '../src/types';

const mockState: Record<string, unknown> = {};
const mockRequestExternalUrl = jest.fn();
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: typeof mockState) => unknown) => selector(mockState) }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: mockRequestExternalUrl }) }));
jest.mock('../src/components/icons/AppIcon', () => 'AppIcon');
jest.mock('../src/hooks/useAuditExternalLinks', () => ({ useAuditExternalLinks: jest.fn() }));
jest.mock('../src/components/ui', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return { AppText: 'AppText', Button: 'Button', Row: 'Row', Disclosure: ({ children, open, ...props }: any) => R.createElement('Disclosure', { ...props, open }, open ? children : null) };
});
type Node = { props: Record<string, any>; findAllByType(type: unknown): Node[]; findByProps(props: Record<string, unknown>): Node };
type Tree = ReactTestRenderer & { root: Node };
const bodyText = (tree: Tree) => tree.root.findAllByType('AppText').map(node => String(node.props.children));

test.each([
  ['https://www.bankwest.com.au/savings-accounts/high-interest?s=ba', false],
  ['https://www.bankwest.com.au/?campaign=1', false],
  ['https://www.bankwest.com.au/home', false],
  ['https://www.bankwest.com.au/cds-au/v1/banking/products/123', false],
  ['https://api.bankwest.com.au/v1/products/123', false],
  ['https://www.bankwest.com.au/%61pi/products/123', false],
  ['https://www.bankwest.com.au/products/123.json', false],
  [undefined, false],
] as const)('an overview never substitutes for an eligibility citation (%s)', (overview, linked) => {
  mockRequestExternalUrl.mockClear();
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductPageLinks overview={overview}>
    <DetailGroup title="Eligibility" icon="person-outline" items={[
      { label: 'MIN_AGE', value: '18' },
      { label: 'RESIDENCY_STATUS', info: 'A source condition requiring interpretation.' },
      { label: 'OTHER', info: 'A published requirement.' },
    ]} loading={false} />
  </ProductPageLinks>) as Tree; });
  try {
    act(() => tree.root.findAllByType('Disclosure').find(node => node.props.title === 'Eligibility')!.props.onToggle());
    expect(bodyText(tree)).toEqual(['Minimum age', '18 years', 'Residency status', 'Unknown', 'Other', 'Unknown']);
    if (!linked) {
      expect(() => tree.root.findByProps({ accessibilityRole: 'link' })).toThrow();
    } else {
      for (const accessibilityLabel of ['Minimum age, 18 years', 'Residency status, Unknown', 'Other, Unknown']) {
        act(() => tree.root.findByProps({ accessibilityRole: 'link', accessibilityLabel }).props.onPress());
      }
      expect(mockRequestExternalUrl.mock.calls).toEqual(Array(3).fill([
        { url: overview, purpose: 'lender_source', label: 'Product' },
      ]));
    }
  } finally { act(() => tree.unmount()); }
});

// Existing productFacts.test normalized/legacy compatibility contract, not an
// observed current publication. Add a second same-key occurrence to verify it
// survives the rich fee surface rather than deduplicating charges by name.
const facts: NormalizedProductFact[] = [
  { id: 'feature-1', kind: 'feature', canonicalKey: 'OFFSET', value: true },
  { id: 'fee-1', kind: 'fee', canonicalKey: 'ANNUAL_FEE', value: 100, unit: 'AUD' },
  { id: 'fee-2', kind: 'fee', canonicalKey: 'ANNUAL_FEE', value: 0, unit: 'AUD', condition: 'With package' },
];

test('legacy Fees retains conditions without an overview while Product facts omits normalized fee copies', () => {
  const detail: ProductDetail = { facts, fees: [
    { label: 'ANNUAL_FEE', amount: 100 },
    { label: 'ANNUAL_FEE', amount: 0, info: 'With package', discounts: [{ amount: 5, eligibility: [{ additionalInfo: 'With bundle' }] }] },
  ] };
  const original = JSON.stringify(detail);
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<><DetailGroup title="Fees" icon="cash-outline" items={detail.fees} loading={false} /><ProductFacts productDetails={detail} /></>) as Tree; });
  try {
    act(() => tree.root.findAllByType('Disclosure').find(node => node.props.title === 'Fees')!.props.onToggle());
    act(() => tree.root.findByProps({ title: 'Product facts' }).props.onToggle());
    const text = bodyText(tree);
    expect(text.filter(value => value === '$100')).toHaveLength(1);
    expect(text.filter(value => value === '$0 · Conditions: Unverified')).toHaveLength(1);
    expect(text).toContain('Discount: $5 · Conditions: Unverified');
    expect(text.filter(value => value === 'ANNUAL_FEE')).toHaveLength(2);
    expect(text).not.toContain('Source review required');
    expect(text).toContain('Offset account');
    expect(text).not.toContain('With package');
    expect(text).not.toContain('With bundle');
    expect(JSON.stringify(detail)).toBe(original);
  } finally { act(() => tree.unmount()); }
});

test.each([undefined, []])('normalized fee-only payload preserves both variants when legacy fees=%j', fees => {
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductFacts productDetails={{ facts: facts.slice(1), fees }} />) as Tree; });
  try {
    act(() => tree.root.findByProps({ title: 'Product facts' }).props.onToggle());
    expect(bodyText(tree)).toContain('$100');
    expect(bodyText(tree)).toContain('$0 · Conditions: Unverified');
    expect(bodyText(tree)).not.toContain('Source fee-2');
    expect(bodyText(tree)).not.toContain('With package');
  } finally { act(() => tree.unmount()); }
});

test('unlinked published facts preserve caps, discounts, tier and conditions without fabricated citations', () => {
  let tree!: Tree;
  act(() => {
    tree = TestRenderer.create(<ProductPageLinks overview="https://www.bankwest.com.au/savings-accounts/high-interest">
      <DetailGroup title="Fees" icon="cash-outline" loading={false} items={[{
        label: 'ANNUAL_FEE', amount: 0, info: 'With package', feeCap: 25, feeCapPeriod: 'P1Y',
        discounts: [{ amount: 5, eligibility: [{ additionalInfo: 'With bundle' }] }],
      }]} />
      <ProductFacts productDetails={{ facts: [{ ...facts[2], appliesTo: ['OWNER_OCCUPIED'] }] }} />
    </ProductPageLinks>) as Tree;
  });
  try {
    act(() => tree.root.findAllByType('Disclosure').find(node => node.props.title === 'Fees')!.props.onToggle());
    act(() => tree.root.findByProps({ title: 'Product facts' }).props.onToggle());
    expect(bodyText(tree)).toContain('Fee cap: $25 · per year');
    expect(bodyText(tree)).toContain('Discount: $5 · Conditions: Unverified');
    expect(() => tree.root.findByProps({ accessibilityRole: 'link' })).toThrow();
  } finally { act(() => tree.unmount()); }
});


test('a fact with verified raw-source applicability opens its exact document page', () => {
  mockRequestExternalUrl.mockClear();
  const fact: NormalizedProductFact = { ...facts[0], sourcePath: '/features/0', sourcePathBasis: 'raw-cdr' };
  const detail: ProductDetail = { facts: [fact], sourceDocuments: [{
    url: 'https://up.com.au/docs/Up-Home-Loan-Booklet.pdf', sourcePath: '/features/0/additionalInfoUri', relation: 'terms',
    specificity: 'exact-product', relevance: 'verified', citations: [{ page: 4 }],
  }] };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductPageLinks overview="https://up.com.au/" detail={detail}><ProductFacts productDetails={detail} /></ProductPageLinks>) as Tree; });
  try {
    act(() => tree.root.findByProps({ title: 'Product facts' }).props.onToggle());
    act(() => tree.root.findByProps({ accessibilityRole: 'link' }).props.onPress());
    expect(mockRequestExternalUrl).toHaveBeenCalledWith({ url: detail.sourceDocuments![0].url, purpose: 'lender_source', label: 'Source', page: 4 });
  } finally { act(() => tree.unmount()); }
});
