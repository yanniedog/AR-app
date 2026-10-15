import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ProductRatesList } from '../src/components/product/ProductDetailParts';
import { ratePresentation } from '../src/data/ratePresentation';
import { formatBalanceRange, formatRate, formatTerm } from '../src/data/format';
import { openProduct } from '../src/lib/nav';
import type { RateRow } from '../src/types';

type Node = { props: Record<string, any>; findAllByType(type: string): Node[]; findByType(type: string): Node };
type Tree = ReactTestRenderer & { root: Node };
let mockMetric: 'comparison' | 'headline' = 'comparison';
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector({ prefs: { mortgageRateMetric: mockMetric } }) }));
jest.mock('../src/lib/nav', () => ({ openProduct: jest.fn() }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/hooks/useAuditExternalLinks', () => ({ useAuditExternalLinks: jest.fn() }));
jest.mock('../src/components/product/RateConditionsDisclosure', () => ({ SelectedRateConditions: 'SelectedRateConditions' }));
jest.mock('../src/data/ratePresentation', () => {
  const actual = jest.requireActual<typeof import('../src/data/ratePresentation')>('../src/data/ratePresentation');
  return { ...actual, ratePresentation: jest.fn(actual.ratePresentation) };
});
jest.mock('../src/data/format', () => {
  const actual = jest.requireActual<typeof import('../src/data/format')>('../src/data/format');
  return { ...actual, formatRate: jest.fn(actual.formatRate), formatTerm: jest.fn(actual.formatTerm), formatBalanceRange: jest.fn(actual.formatBalanceRange) };
});
jest.mock('../src/components/ui', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return { AppText: 'AppText', Button: 'Button', Row: 'Row', Disclosure: ({ open, children, ...props }: any) =>
    R.createElement('Disclosure', { ...props, open }, open ? children : null) };
});

function tiers(): RateRow[] {
  return Array.from({ length: 172 }, (_, index) => ({
    provider: 'NATIONAL AUSTRALIA BANK', product_key: 'nab-tier-fixture', product_name: 'NAB Tailored Home Loan',
    rate: String(0.0589 + index / 100000), comparison_rate: String(0.058 + index / 100000), rate_index: index,
    rate_type: index % 2 ? 'FIXED' : 'VARIABLE', repayment_type: 'PRINCIPAL_AND_INTEREST',
    lvr_tier: index % 2 ? 'LVR_70_80' : 'LVR_60_70',
  }));
}
const formatters = [ratePresentation, formatRate, formatTerm, formatBalanceRange];
function clearFormatting() { formatters.forEach(formatter => jest.mocked(formatter).mockClear()); }
beforeEach(() => { mockMetric = 'comparison'; jest.mocked(openProduct).mockClear(); clearFormatting(); });

test('collapsed172-tier disclosure never traverses or formats rows, including changed metric', () => {
  const rows = tiers(); const map = jest.spyOn(rows, 'map');
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductRatesList rows={rows} section="Mortgage" accent="#123" />) as Tree; });
  try {
    expect(tree.root.findByType('Disclosure').props).toMatchObject({ title: 'Rates (172)', open: false });
    expect(map).not.toHaveBeenCalled(); formatters.forEach(formatter => expect(formatter).not.toHaveBeenCalled());
    expect(tree.root.findAllByType('Button')).toHaveLength(0);
    mockMetric = 'headline';
    act(() => { tree.update(<ProductRatesList rows={rows} section="Mortgage" accent="#123" />); });
    expect(map).not.toHaveBeenCalled(); formatters.forEach(formatter => expect(formatter).not.toHaveBeenCalled());
  } finally { act(() => tree.unmount()); map.mockRestore(); }
});

test('expansion retains every exact tier, both metrics, condition inputs and Open identity; closing defers again', () => {
  const rows = tiers(); const original = JSON.stringify(rows);
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductRatesList rows={rows} section="Mortgage" accent="#123" />) as Tree; });
  try {
    act(() => { tree.root.findByType('Disclosure').props.onToggle(); });
    const actions = tree.root.findAllByType('Button');
    const conditions = tree.root.findAllByType('SelectedRateConditions');
    const text = tree.root.findAllByType('AppText').map(node => String(node.props.children)).join('\n');
    expect(actions).toHaveLength(172); expect(conditions).toHaveLength(172);
    expect(text).toContain('Comparison rate 5.80%'); expect(text).toContain('Advertised rate 5.89%');
    expect(text).toContain('Listed LVR >60%–70%'); expect(text).toContain('Listed LVR >70%–80%');
    actions.forEach((action, index) => {
      expect(action.props.accessibilityLabel).toContain(`Rate index ${index}`);
      expect(conditions[index].props).toMatchObject({ row: rows[index], section: 'Mortgage' });
      expect(conditions[index].props.row).toBe(rows[index]);
      act(() => action.props.onPress());
      expect(openProduct).toHaveBeenNthCalledWith(index + 1, rows[index].product_key, rows[index].rate_index);
    });
    expect(JSON.stringify(rows)).toBe(original);
    clearFormatting();
    act(() => { tree.root.findByType('Disclosure').props.onToggle(); });
    expect(tree.root.findAllByType('Button')).toHaveLength(0);
    formatters.forEach(formatter => expect(formatter).not.toHaveBeenCalled());
  } finally { act(() => tree.unmount()); }
});

test('defaultOpen renders all172 tiers immediately and empty input stays empty', () => {
  const rows = tiers(); let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductRatesList rows={rows} section="Mortgage" accent="#123" defaultOpen />) as Tree; });
  try {
    expect(tree.root.findByType('Disclosure').props.open).toBe(true);
    expect(tree.root.findAllByType('Button')).toHaveLength(172);
    expect(tree.root.findAllByType('SelectedRateConditions')).toHaveLength(172);
    clearFormatting();
    act(() => { tree.update(<ProductRatesList rows={[]} section="Mortgage" accent="#123" defaultOpen />); });
    expect(tree.root.findAllByType('Disclosure')).toHaveLength(0);
    formatters.forEach(formatter => expect(formatter).not.toHaveBeenCalled());
  } finally { act(() => tree.unmount()); }
});
