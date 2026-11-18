import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ProviderRateFilters } from '../src/components/ProviderRateFilters';
import { EMPTY_PROFILE } from '../src/data/profile';
import type { RateRow } from '../src/types';
type TestNode = { type: unknown; props: Record<string, any> };
type Renderer = ReactTestRenderer & { root: { findAll(predicate: (node: TestNode) => boolean): TestNode[] } };
jest.mock('../src/components/ui', () => ({ Chip: 'Chip', Row: 'Row', AppText: 'AppText', Button: 'Button' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {} }) }));
test('each dimension uses one compact control and selection updates the shared profile without a second sheet', () => {
  const onChange = jest.fn();
  const rows = ['lvr_0-60%', 'lvr_60-80%', 'lvr_80-90%'].map((lvr_tier, index) => ({
    provider: 'Alpha', product_key: String(index), product_name: 'Loan', rate: '0.06', lvr_tier,
    loan_purpose: 'OWNER_OCCUPIED', repayment_type: 'PRINCIPAL_AND_INTEREST', rate_type: 'VARIABLE',
  })) as RateRow[];
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<ProviderRateFilters rows={rows} profile={EMPTY_PROFILE} onChange={onChange} />) as Renderer; });
  try {
    const chips = () => tree.root.findAll(node => node.type === ('Chip' as never));
    expect(chips()).toHaveLength(5);
    act(() => chips().find(node => String(node.props.label).startsWith('LVR'))!.props.onPress());
    expect(chips()).toHaveLength(9);
    const band = chips().find(node => /60(?:\.0)?%/.test(String(node.props.label)) && !String(node.props.label).includes('All'))!;
    act(() => band.props.onPress());
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_PROFILE, lvrTiers: ['lvr_0-60%'] });
    expect(chips()).toHaveLength(5);
  } finally { act(() => tree.unmount()); }
});
