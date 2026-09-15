import placeholders from './fixtures/published-descriptive-placeholders-20260915.json';
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import fixture from './fixtures/bankwest-easy-saver-eligibility-20260913.json';
import mortgageFixture from './fixtures/the-mac-bridging-loan-details-20260914.json';
import type { ProductDetail } from '../src/types';
type Inspectable = ReactTestRenderer & { root: any; toJSON: () => unknown };

jest.mock('../src/components/icons/AppIcon', () => 'AppIcon');
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/components/feedback', () => ({}));
jest.mock('../src/components/TouchTarget', () => ({}));
jest.mock('../src/components/product/ProductTermsDisclosure', () => ({ ProductTermsDisclosure: 'ProductTermsDisclosure' }));
jest.mock('../src/data/store', () => ({}));
jest.mock('../src/lib/nav', () => ({}));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('../src/components/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    AppText: 'AppText', Row: 'Row', Divider: 'Divider', Card: 'Card',
    Disclosure: ({ title, open, onToggle, children }: any) => React.createElement(
      'Disclosure', { title, onToggle, open }, open ? children : null),
  };
});
// eslint-disable-next-line import/first -- platform mocks above
import { ComparisonDisclosures } from '../src/components/product/ComparisonDisclosures';

test('real Bankwest detail exposes every published fee and eligibility condition, including zero', () => {
  const detail = fixture.detail as ProductDetail;
  let tree!: Inspectable;
  act(() => { tree = TestRenderer.create(<ComparisonDisclosures
    name="Bankwest Easy Saver" provider="Bankwest" productKey={fixture.rates[0].product_key}
    detail={detail} loading={false} />) as Inspectable; });
  const root = tree.root as any;
  act(() => root.findByProps({ title: 'Fees', open: false }).props.onToggle());
  const rendered = JSON.stringify(tree.toJSON());
  for (const fee of detail.fees!) {
    if (fee.name) expect(rendered).toContain(fee.name);
    if (fee.info) expect(rendered).toContain(fee.info);
  }
  expect(rendered).toContain('$0 monthly');
  expect(rendered).toContain('Eligibility has not been assessed for you.');
  act(() => root.findByProps({ title: 'Eligibility', open: false }).props.onToggle());
  const eligibility = JSON.stringify(tree.toJSON());
  for (const criterion of detail.eligibility!) {
    if (criterion.info) expect(eligibility).toContain(criterion.info);
  }
  act(() => tree.unmount());
});

test('retained The Mac mortgage exposes all four fees and all three criteria', () => {
  const detail = mortgageFixture.detail as ProductDetail;
  let tree!: Inspectable;
  act(() => { tree = TestRenderer.create(<ComparisonDisclosures name="BRIDGING LOAN"
    provider="The Mac" productKey={mortgageFixture.product_key} detail={detail} loading={false} />) as Inspectable; });
  const root = tree.root as any;
  act(() => root.findByProps({ title: 'Fees', open: false }).props.onToggle());
  act(() => root.findByProps({ title: 'Eligibility', open: false }).props.onToggle());
  const text = root.findAllByType('AppText').map((node: any) => node.children.join('')).join('\n');
  expect(detail.fees).toHaveLength(4);
  expect(detail.eligibility).toHaveLength(3);
  for (const item of [...detail.fees!, ...detail.eligibility!]) {
    if (item.name) expect(text).toContain(item.name);
    if (item.info) expect(text).toContain(item.info);
  }
  act(() => tree.unmount());
});

test('original published descriptive placeholders are hidden while labels remain visible', () => {
  const { DetailGroup } = require('../src/components/product/ProductDetailParts');
  for (const kind of ['features', 'eligibility']) {
    const items = placeholders.items.filter(i => i.kind === kind).map(i => i.item);
    let tree!: Inspectable;
    act(() => { tree = TestRenderer.create(<DetailGroup title={kind} icon="list" items={items} loading={false} />) as Inspectable; });
    act(() => tree.root.findByType('Disclosure').props.onToggle());
    const textNodes = tree.root.findAllByType('AppText').map((n: any) => n.children.join(''));
    expect(textNodes.some((text: string) => /^(null|none)$/i.test(text.trim()))).toBe(false);
    expect(textNodes.length).toBeGreaterThanOrEqual(items.length);
    act(() => tree.unmount());
  }
});
