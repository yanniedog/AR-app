import mockReact from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { OptionSelect, OptionStrip } from '../src/components/selectors';

jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/lib/haptics', () => ({ hapticSelection: jest.fn() }));
jest.mock('../src/components/icons/LedgerIcon', () => ({ LedgerIcon: 'LedgerIcon' }));
// The real sheet is native-modal plumbing; this stand-in shows children only while visible.
jest.mock('../src/components/SheetSurface', () => ({
  SheetSurface: ({ visible, children, footer }: any) => visible ? mockReact.createElement('Sheet', null, children, footer) : null,
}));

const OPTIONS = Array.from({ length: 12 }, (_, i) => ({ label: `Option ${i}`, value: `o${i}` }));
const pressable = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];

test('a collapsed multi-select shows its summary, opens a scrollable tick list and selects every option', () => {
  const onChange = jest.fn(); const onClear = jest.fn(); let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<OptionSelect label="Features" options={OPTIONS} value={['o3', 'o7']} multiple onChange={onChange} onClear={onClear} />); });
  expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
  act(() => pressable(tree, 'Features: Option 3 +1').props.onPress());
  // Twelve rows plus Any sit inside a ScrollView, so none is clipped by the sheet height.
  const { ScrollView } = jest.requireActual('react-native');
  const list = tree.root.findByType(ScrollView);
  const rows = new Set(list.findAll(node => node.props.accessibilityRole === 'checkbox' && typeof node.props.onPress === 'function').map(node => node.props.accessibilityLabel));
  expect(rows.size).toBe(12);
  act(() => pressable(tree, 'Option 11').props.onPress());
  expect(onChange).toHaveBeenLastCalledWith('o11');
  expect(pressable(tree, 'Option 3').props.accessibilityState.checked).toBe(true);
  act(() => pressable(tree, 'Any').props.onPress());
  expect(onClear).toHaveBeenCalled();
  act(() => tree.unmount());
});

test('a single-select closes after a choice; the strip keeps 48 dp touch targets', () => {
  const onChange = jest.fn(); let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<OptionSelect label="Y-axis" variant="button" options={OPTIONS.slice(0, 3)} value="o0" onChange={onChange} />); });
  act(() => pressable(tree, 'Y-axis: Option 0').props.onPress());
  act(() => pressable(tree, 'Option 2').props.onPress());
  expect(onChange).toHaveBeenCalledWith('o2');
  expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
  act(() => tree.update(<OptionStrip options={OPTIONS.slice(0, 3)} value="o1" onChange={onChange} />));
  const tab = pressable(tree, 'Option 1');
  expect(tab.props.accessibilityState.selected).toBe(true);
  act(() => pressable(tree, 'Option 2').props.onPress());
  expect(onChange).toHaveBeenLastCalledWith('o2');
  const { StyleSheet } = jest.requireActual('react-native');
  const target = tree.root.findAll(node => node.props.accessibilityLabel === 'Option 1' && node.props.accessibilityRole === 'tab')
    .map(node => StyleSheet.flatten(node.props.style)).find(style => style?.minHeight != null);
  expect(target?.minHeight ?? 48).toBeGreaterThanOrEqual(48);
  act(() => tree.unmount());
});

test('a single-select with a clear action shows Any first, clears and closes', () => {
  const onChange = jest.fn(); const onClear = jest.fn(); let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<OptionSelect label="Repayment" options={OPTIONS.slice(0, 3)} value={['o1']} onChange={onChange} onClear={onClear} />); });
  act(() => pressable(tree, 'Repayment: Option 1').props.onPress());
  expect(pressable(tree, 'Option 1').props.accessibilityRole).toBe('radio');
  act(() => pressable(tree, 'Any').props.onPress());
  expect(onClear).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
  act(() => tree.unmount());
});
