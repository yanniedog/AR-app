import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { AppText } from '../src/components/ui';
import { LedgerText } from '../src/components/ledger/LedgerText';
import { uiLabel } from '../src/lib/uiCopy';

let mockFontScale = 1;
const mockMount = jest.fn();
const mockUnmount = jest.fn();
const mockLayout = jest.fn();

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => ({ width: 360, height: 800, scale: 3, fontScale: mockFontScale }),
}));

type TestNode = {
  props: {
    children?: unknown;
    style?: StyleProp<TextStyle>;
    onPress?: () => void;
    onLayout?: unknown;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { selected?: boolean };
    allowFontScaling?: boolean;
    maxFontSizeMultiplier?: number;
    adjustsFontSizeToFit?: boolean;
  };
  findByType: (type: React.ElementType) => TestNode;
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
};
let tree: ReactTestRenderer & { root: TestNode };
const control = () => tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0];

function StatefulLabel({ kind }: { kind: 'app' | 'ledger' }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => { mockMount(); return () => { mockUnmount(); }; }, []);
  const label = saved ? uiLabel('Saved') : uiLabel('Rates');
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: saved }} onPress={() => setSaved(value => !value)}>
    {kind === 'app' ? <AppText variant="small" style={{ lineHeight: 18 }} accessibilityLabel={uiLabel('Saved')} onLayout={mockLayout}>
      {label}
    </AppText> : <LedgerText variant="caption" style={{ lineHeight: 18 }} accessibilityLabel={uiLabel('Saved')} onLayout={mockLayout}>
      {label}
    </LedgerText>}
  </Pressable>;
}

beforeEach(() => {
  mockFontScale = 1;
  mockMount.mockClear(); mockUnmount.mockClear(); mockLayout.mockClear();
});
afterEach(() => act(() => tree?.unmount()));

it.each([
  { name: 'AppText', kind: 'app', component: AppText },
  { name: 'LedgerText', kind: 'ledger', component: LedgerText },
] as const)('$name refreshes native text through 1→2→1.5→1 without resetting the business parent or control', ({ kind, component }) => {
  act(() => { tree = TestRenderer.create(<StatefulLabel kind={kind} />) as typeof tree; });
  const target = control();
  const foundation = tree.root.findByType(component);
  act(() => target.props.onPress!());
  let previousText = tree.root.findByType(Text);
  expect(previousText.props.children).toBe('Saved');
  expect(StyleSheet.flatten(previousText.props.style)?.lineHeight).toBe(18);

  for (const scale of [2, 1.5, 1]) {
    mockFontScale = scale;
    act(() => tree.update(<StatefulLabel kind={kind} />));
    const text = tree.root.findByType(Text);
    expect(text).not.toBe(previousText);
    expect(tree.root.findByType(component)).toBe(foundation);
    expect(control()).toBe(target);
    expect(target.props.accessibilityState?.selected).toBe(true);
    expect(text.props.children).toBe('Saved');
    expect(text.props.accessibilityLabel).toBe('Saved');
    expect(text.props.onLayout).toBe(mockLayout);
    expect(text.props.allowFontScaling).toBe(true);
    expect(text.props.maxFontSizeMultiplier).toBeUndefined();
    expect(text.props.adjustsFontSizeToFit).not.toBe(true);
    expect(StyleSheet.flatten(text.props.style)?.fontSize).toBe(14);
    expect(StyleSheet.flatten(text.props.style)?.lineHeight).toBe(scale > 1 ? undefined : 18);
    previousText = text;
  }
  expect(mockMount).toHaveBeenCalledTimes(1);
  expect(mockUnmount).not.toHaveBeenCalled();
  act(() => tree.update(<StatefulLabel kind={kind} />));
  expect(tree.root.findByType(Text)).toBe(previousText);
  act(() => target.props.onPress!());
  expect(tree.root.findByType(Text).props.children).toBe('Rates');
  expect(target.props.accessibilityState?.selected).toBe(false);
});
