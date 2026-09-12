import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import fixture from './fixtures/bankwest-easy-saver-eligibility-20260913.json';
import { adaptCoreV3ToLegacy } from '../src/contracts/v3/canonicalCoreAdapter';
import { sampleCore } from '../src/data/sample';
import type { ProductDetail, RateRow } from '../src/types';
import { buildGeneration, makeProduct } from '../testUtils/v3TestData';

type TestNode = {
  props: Record<string, any>;
  children: (TestNode | string)[];
  findByProps: (props: Record<string, unknown>) => TestNode;
  findAllByType: (type: string) => TestNode[];
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

jest.mock('../src/components/icons/AppIcon', () => 'AppIcon');
jest.mock('../src/components/ExternalLinkConfirmation', () => ({}));
jest.mock('../src/components/feedback', () => ({}));
jest.mock('../src/components/TouchTarget', () => ({}));
jest.mock('../src/data/store', () => ({}));
jest.mock('../src/lib/nav', () => ({}));
jest.mock('../src/theme/ThemeProvider', () => ({}));
jest.mock('../src/components/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    AppText: 'AppText', Row: 'Row', Divider: 'Divider',
    Disclosure: ({ open, onToggle, children }: any) => React.createElement(
      'Disclosure', { onToggle, open }, open ? children : null,
    ),
  };
});

// eslint-disable-next-line import/first -- render the real component after platform mocks
import { ProductSpecs } from '../src/components/product/ProductDetailParts';

const [ordinary, prize] = fixture.rates as RateRow[];
const detail = fixture.detail as ProductDetail;

function displayedAvailability(row: RateRow, productDetail: ProductDetail | null): string {
  let tree!: InspectableRenderer;
  act(() => {
    tree = TestRenderer.create(<ProductSpecs row={row} section="Savings" detail={productDetail} />) as InspectableRenderer;
  });
  act(() => tree.root.findByProps({ open: false }).props.onToggle());
  const texts = tree.root.findAllByType('AppText').map((node) => node.children.join(''));
  const availability = texts[texts.indexOf('Availability') + 1];
  act(() => tree.unmount());
  return availability;
}

describe('exact-tier availability in Rate details', () => {
  it('avoids a wide-availability claim for the real prize despite unrestricted shared account details', () => {
    expect(displayedAvailability(prize, detail)).toBe('Check tier availability');
  });

  it('retains the real ordinary sibling as widely available', () => {
    expect(displayedAvailability(ordinary, detail)).toBe('Widely available');
  });

  it('keeps the non-standard tier caveat while shared details are still loading', () => {
    expect(displayedAvailability(prize, null)).toBe('Check tier availability');
  });

  it('waits for shared eligibility when the ordinary row has no explicit restriction', () => {
    expect(displayedAvailability(ordinary, null)).toBe('Checking availability');
  });

  it('does not infer special eligibility from an introductory period alone', () => {
    // Controlled presentation variant, not a claim about a published Bankwest tier.
    const introductory = { ...ordinary, rate_type: 'INTRODUCTORY', ribbon_deposit_kind: 'introductory', term_months: '4' };
    expect(displayedAvailability(introductory, detail)).toBe('Widely available');
  });

  it('continues to respect restricted product-level eligibility on a standard row', () => {
    // Controlled product-access variant; the retained source fixture is unchanged.
    const restrictedDetail = { ...detail, eligibility: [{ label: 'OTHER', info: 'Available only to medical practitioners.' }] };
    expect(displayedAvailability(ordinary, restrictedDetail)).toBe('Special eligibility');
    expect(displayedAvailability(prize, restrictedDetail)).toBe('Special eligibility');
  });

  it.each(['pricing', 'identity'] as const)('does not call uncertain canonical %s restricted customer eligibility', (uncertainty) => {
    // Synthetic contract fixture passed through the production v3 adapter.
    const product = makeProduct({ kind: 'savings_account', pricing: uncertainty === 'pricing' ? 'partial' : 'complete' });
    product.rates[0].exact_alert_eligible = false;
    if (uncertainty === 'identity') product.rates[0].identity.rate_identity_status = 'ambiguous';
    const canonical = buildGeneration({ products: [product] }).core;
    const row = adaptCoreV3ToLegacy(canonical, { ...sampleCore, run_date: canonical.observation_date }).sections.Savings.rates[0];
    expect(row.account_class).toBe('non_standard');
    expect(displayedAvailability(row, {})).toBe('Check tier availability');
  });
});
