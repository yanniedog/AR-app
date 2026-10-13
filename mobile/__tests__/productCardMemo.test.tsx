import React from 'react';
import mockReact from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { create } from 'zustand';

import { ProductCard } from '../src/components/ProductCard';
import type { RateRow } from '../src/types';
import type { MortgageRateMetric } from '../src/data/selectors';

const mockCardRender = jest.fn();
const mockToggleSavedRate = jest.fn();
interface TestStoreState {
  favorite: boolean;
  isRateSaved: () => boolean;
  toggleSavedRate: typeof mockToggleSavedRate;
  details: null;
  prefs: { mortgageRateMetric: MortgageRateMetric };
}
const mockStore = create<TestStoreState>(() => ({
  favorite: false,
  isRateSaved: (): boolean => mockStore.getState().favorite,
  toggleSavedRate: mockToggleSavedRate,
  details: null,
  prefs: { mortgageRateMetric: 'headline' },
}));
const mockTheme = {
  colors: { primaryMuted: '#eee', primary: '#123', text: '#222', textFaint: '#666', warning: '#a60' },
  radius: { sm: 4 }, ledger: { rule: '#ddd' },
};
const mockThemeContext = React.createContext(mockTheme);
jest.mock('../src/data/store', () => ({ useStore: (select: any) => mockStore(select) }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/icons/AppIcon', () => ({ __esModule: true, default: 'Icon' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Row: 'Row', androidRipple: () => undefined }));
jest.mock('../src/components/product/ProductRateChangeLine', () => ({
  ProductRateChangeSummaryLine: 'ProductRateChangeSummaryLine',
  useProductRateChangeSummary: () => null,
  productRateChangeText: () => '',
}));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => {
  mockCardRender();
  return mockReact.useContext(mockThemeContext);
} }));
jest.mock('../src/lib/nav', () => ({ openBank: jest.fn() }));

const row: RateRow = { product_key: 'loan', provider: 'Bank', product_name: 'Loan',
  rate: '0.04', comparison_rate: '0.06', rate_index: 7 };
type Node = { props: Record<string, any>; findAllByProps: (props: Record<string, unknown>) => Node[] };
type Renderer = ReactTestRenderer & { root: Node };

test('unchanged list commits skip card work while saved/ranking/theme subscriptions remain live', () => {
  const onPress = jest.fn();
  const card = () => <ProductCard row={row} section="Mortgage" onPress={onPress} />;
  const screen = (theme = mockTheme) => <mockThemeContext.Provider value={theme}>{card()}</mockThemeContext.Provider>;
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(screen()) as Renderer; });
  try {
    const initial = mockCardRender.mock.calls.length;
    act(() => tree.update(screen()));
    expect(mockCardRender).toHaveBeenCalledTimes(initial);
    act(() => mockStore.setState({ favorite: true }));
    expect(mockCardRender).toHaveBeenCalledTimes(initial + 1);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Remove this rate from saved' }).length).toBeGreaterThan(0);
    act(() => mockStore.setState({ prefs: { mortgageRateMetric: 'comparison' } }));
    expect(tree.root.findAllByProps({ accessibilityRole: 'button' }).some(node =>
      String(node.props.accessibilityLabel).includes('Comparison rate 6.00%'))).toBe(true);
    const beforeTheme = mockCardRender.mock.calls.length;
    act(() => tree.update(screen({ ...mockTheme, colors: { ...mockTheme.colors, text: '#fff' } })));
    expect(mockCardRender.mock.calls.length).toBeGreaterThan(beforeTheme);
    const button = tree.root.findAllByProps({ accessibilityRole: 'button' }).find(node =>
      String(node.props.accessibilityLabel).startsWith('Loan,'))!;
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});
